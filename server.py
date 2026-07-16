"""Serve the Meesho Image Generator SPA with own local API."""
import base64
import json
import mimetypes
import os
import re
import socketserver
import subprocess
import threading
import time
import uuid
from http.server import SimpleHTTPRequestHandler
from pathlib import Path

REPO = Path(__file__).resolve().parent
ROOT = REPO
PORT = int(os.environ.get("PORT", "8000"))

mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("application/wasm", ".wasm")
CATEGORIES_FILE = ROOT / "data" / "product-types.json"
OPTIMIZE_SCRIPT = REPO / "scripts" / "optimize-stdin.mjs"
BROWSER_OPTIMIZE_SCRIPT = REPO / "scripts" / "browser-optimize.mjs"

MOCK_REQUESTS: dict[str, dict] = {}
REQUESTS_DIR = Path(os.environ.get("MEESHO_REQUESTS_DIR", "/tmp/meesho-requests"))
REQUEST_TTL_SEC = int(os.environ.get("MEESHO_REQUEST_TTL_SEC", str(6 * 3600)))
GUEST_USER = {
    "id": "guest-local",
    "email": "guest@localhost",
    "name": "Local Guest",
    "credits": 999,
    "role": "USER",
    "picture": None,
}


def _ensure_requests_dir() -> None:
    REQUESTS_DIR.mkdir(parents=True, exist_ok=True)


def _request_record_path(request_id: str) -> Path:
    return REQUESTS_DIR / f"{request_id}.json"


def _serialize_request(req: dict) -> dict:
    return {
        "created_at": req.get("created_at"),
        "tag_id": req.get("tag_id", ""),
        "tag_name": req.get("tag_name", "Product"),
        "frame_style": req.get("frame_style") or {},
        "status": req.get("status", "processing"),
        "results": req.get("results") or [],
        "error": req.get("error"),
        "progress": req.get("progress", 0),
        "progressLabel": req.get("progressLabel", ""),
        "processing": bool(req.get("processing")),
    }


def _persist_request_disk(request_id: str, req: dict) -> None:
    try:
        _ensure_requests_dir()
        payload = _serialize_request(req)
        payload["request_id"] = request_id
        _request_record_path(request_id).write_text(json.dumps(payload), encoding="utf-8")
    except OSError as exc:
        print(f"[persist] {request_id}: {exc}")


def _load_request_disk(request_id: str) -> dict | None:
    path = _request_record_path(request_id)
    if not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if time.time() - float(data.get("created_at") or 0) > REQUEST_TTL_SEC:
            path.unlink(missing_ok=True)
            return None
        return {
            "created_at": data.get("created_at", time.time()),
            "tag_id": data.get("tag_id", ""),
            "tag_name": data.get("tag_name", "Product"),
            "frame_style": data.get("frame_style") or {},
            "image_bytes": None,
            "status": data.get("status", "processing"),
            "results": data.get("results") or [],
            "error": data.get("error"),
            "progress": data.get("progress", 0),
            "progressLabel": data.get("progressLabel", ""),
            "processing": False,
        }
    except (OSError, json.JSONDecodeError, TypeError):
        return None


def _get_request(request_id: str) -> dict | None:
    req = MOCK_REQUESTS.get(request_id)
    if req:
        return req
    loaded = _load_request_disk(request_id)
    if loaded:
        MOCK_REQUESTS[request_id] = loaded
    return loaded


def _hydrate_requests_from_disk() -> None:
    try:
        _ensure_requests_dir()
        for path in REQUESTS_DIR.glob("*.json"):
            rid = path.stem
            if rid in MOCK_REQUESTS:
                continue
            loaded = _load_request_disk(rid)
            if loaded:
                MOCK_REQUESTS[rid] = loaded
    except OSError as exc:
        print(f"[hydrate] {exc}")


class SPAHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):
        print(f"[{self.command}] {args[0]}")

    def _clean_path(self) -> str:
        path, _, query = self.path.partition("?")
        if path.startswith("/supplierhub.in/"):
            path = "/" + path[len("/supplierhub.in/") :]
        elif path == "/supplierhub.in":
            path = "/"
        self.path = path + ("?" + query if query else "")
        return path

    def _api_path(self) -> str:
        return self.path.split("?", 1)[0]

    def _disk_file(self, path: str) -> Path:
        return (ROOT / path.lstrip("/")).resolve()

    def _is_real_file(self, path: str) -> bool:
        try:
            f = self._disk_file(path)
            return f.is_file() and str(f).startswith(str(ROOT.resolve()))
        except OSError:
            return False

    def _should_handle_api(self) -> bool:
        p = self._api_path()
        return p.startswith("/api/") or p.startswith("/auth/")

    def _json_response(self, status: int, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_body(self) -> bytes:
        length = int(self.headers.get("Content-Length", 0))
        return self.rfile.read(length) if length else b""

    def _parse_multipart(self, body: bytes) -> dict:
        import cgi
        import io

        content_type = self.headers.get("Content-Type", "")
        form = cgi.FieldStorage(
            fp=io.BytesIO(body),
            environ={
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": content_type,
                "CONTENT_LENGTH": str(len(body)),
            },
            keep_blank_values=True,
        )
        parsed: dict = {}
        for key in form.keys():
            field = form[key]
            if isinstance(field, list):
                parsed[key] = field[0].value if field else None
            elif getattr(field, "filename", None):
                parsed[key] = {
                    "filename": field.filename,
                    "bytes": field.file.read(),
                    "type": field.type or "image/jpeg",
                }
            else:
                parsed[key] = field.value
        return parsed

    def _optimize_image(self, image_bytes: bytes, tag_name: str, frame_style: dict | None = None) -> list[dict]:
        is_auto = "auto" in str(tag_name or "").lower()
        is_lingerie = "collage" in str(tag_name or "").lower() or "multi-scenario" in str(tag_name or "").lower()
        is_flatlay = "flat-lay" in str(tag_name or "").lower() or "flatlay" in str(tag_name or "").lower() or "apparel lowest" in str(tag_name or "").lower()
        is_model = "model photo" in str(tag_name or "").lower() or "model lowest" in str(tag_name or "").lower() or "on-person" in str(tag_name or "").lower()
        is_full_length = "full-length" in str(tag_name or "").lower() or "full length" in str(tag_name or "").lower() or "enlarged" in str(tag_name or "").lower() or "kaftan" in str(tag_name or "").lower()
        timeout = 600 if is_auto or is_lingerie or is_flatlay or is_model or is_full_length else 180
        style = frame_style or {}
        payload = json.dumps(
            {
                "imageBase64": "data:image/jpeg;base64," + base64.b64encode(image_bytes).decode("ascii"),
                "tagName": tag_name,
                "frameStyle": {
                    "frameBorderColor": style.get("frameBorderColor") or style.get("borderColor") or "#7C3AED",
                    "frameStickerTemplate": style.get("frameStickerTemplate")
                    or style.get("stickerTemplate")
                    or "limited_time",
                },
            }
        ).encode("utf-8")

        if BROWSER_OPTIMIZE_SCRIPT.exists() and os.environ.get("MEESHO_USE_SHARP") != "1":
            proc = subprocess.run(
                ["node", str(BROWSER_OPTIMIZE_SCRIPT), str(PORT)],
                input=payload,
                capture_output=True,
                cwd=str(REPO),
                timeout=timeout,
            )
            if proc.returncode == 0:
                return json.loads(proc.stdout.decode("utf-8"))

        proc = subprocess.run(
            ["node", str(OPTIMIZE_SCRIPT), tag_name, json.dumps(style)],
            input=image_bytes,
            capture_output=True,
            cwd=str(REPO),
            timeout=timeout,
        )
        if proc.returncode != 0:
            err = proc.stderr.decode("utf-8", errors="replace")
            raise RuntimeError(err or "Image optimization failed")
        return json.loads(proc.stdout.decode("utf-8"))

    def _process_request(self, request_id: str) -> None:
        req = _get_request(request_id)
        if not req or req.get("status") != "processing":
            return
        req["processing"] = True
        req["progress"] = 5
        req["progressLabel"] = "Server received image…"
        _persist_request_disk(request_id, req)
        try:
            req["progress"] = 12
            req["progressLabel"] = "Server optimizing (same logic as browser)…"
            _persist_request_disk(request_id, req)
            req["results"] = self._optimize_image(req["image_bytes"], req["tag_name"], req.get("frame_style"))
            req["status"] = "completed"
            req["progress"] = 100
            req["progressLabel"] = "Done"
            req["image_bytes"] = None
        except Exception as exc:
            req["status"] = "failed"
            req["error"] = str(exc)
            req["progressLabel"] = "Failed"
        finally:
            req["processing"] = False
            req["image_bytes"] = None
            _persist_request_disk(request_id, req)

    def _start_process(self, request_id: str) -> None:
        thread = threading.Thread(target=self._process_request, args=(request_id,), daemon=True)
        thread.start()

    def _handle_api(self) -> bool:
        path = self._api_path()

        if path == "/api/health" and self.command == "GET":
            self._json_response(
                200,
                {
                    "ok": True,
                    "api": "own",
                    "service": "server.py",
                    "processing": "server",
                    "engine": "browser-headless",
                    "version": 93,
                },
            )
            return True

        if path == "/auth/me" and self.command == "GET":
            self._json_response(200, GUEST_USER)
            return True

        if path == "/auth/logout" and self.command == "POST":
            self._json_response(200, {"ok": True})
            return True

        if path == "/api/meesho/fetchCategoryTreeOrder" and self.command == "GET":
            if not CATEGORIES_FILE.exists():
                self._json_response(503, {"message": "Categories file missing"})
                return True
            self._json_response(200, json.loads(CATEGORIES_FILE.read_text(encoding="utf-8")))
            return True

        if path == "/api/meesho/fetchAllRequestId" and self.command == "GET":
            history = []
            for request_id, req in sorted(
                MOCK_REQUESTS.items(), key=lambda x: x[1]["created_at"], reverse=True
            ):
                done = req.get("status") == "completed"
                history.append(
                    {
                        "requestId": request_id,
                        "status": done
                        and "completed"
                        or ("failed" if req.get("status") == "failed" else "processing"),
                        "tagName": req["tag_name"],
                        "createdAt": int(req["created_at"] * 1000),
                        "results": req.get("results", []) if done else [],
                    }
                )
            self._json_response(200, {"data": history, "credits": GUEST_USER["credits"]})
            return True

        if path == "/api/meesho/getLowestShippingCharge" and self.command == "POST":
            form = self._parse_multipart(self._read_body())
            image = form.get("image")
            if not image or not isinstance(image, dict) or not image.get("bytes"):
                self._json_response(400, {"message": "Image is required"})
                return True
            request_id = uuid.uuid4().hex[:12]
            frame_style = {
                "frameBorderColor": form.get("frameBorderColor") or "#FF7900",
                "frameStickerTemplate": form.get("frameStickerTemplate") or "classic_promo",
            }
            MOCK_REQUESTS[request_id] = {
                "created_at": time.time(),
                "tag_id": form.get("tagId", ""),
                "tag_name": form.get("tagName", "Product"),
                "frame_style": frame_style,
                "image_bytes": image["bytes"],
                "status": "processing",
                "results": [],
                "processing": False,
                "progress": 2,
                "progressLabel": "Queued on server…",
            }
            _persist_request_disk(request_id, MOCK_REQUESTS[request_id])
            self._start_process(request_id)
            self._json_response(200, {"requestId": request_id})
            return True

        request_match = re.fullmatch(r"/api/meesho/request(?:-status)?/([^/]+)", path)
        if request_match and self.command == "GET":
            request_id = request_match.group(1)
            req = _get_request(request_id)
            if not req:
                self._json_response(404, {"message": "Request not found"})
                return True
            if req.get("status") == "failed":
                self._json_response(
                    200,
                    {
                        "status": "failed",
                        "progress": req.get("progress", 0),
                        "progressLabel": req.get("progressLabel") or req.get("error") or "Failed",
                        "results": [],
                        "message": req.get("error"),
                    },
                )
                return True
            if req.get("status") != "completed":
                if not req.get("processing") and req.get("status") == "processing":
                    self._start_process(request_id)
                self._json_response(
                    200,
                    {
                        "status": "processing",
                        "progress": req.get("progress", 10),
                        "progressLabel": req.get("progressLabel", "Server optimizing…"),
                        "results": [],
                    },
                )
                return True
            self._json_response(
                200,
                {
                    "status": "completed",
                    "progress": 100,
                    "progressLabel": req.get("progressLabel") or "Done",
                    "results": req.get("results", []),
                },
            )
            return True

        self._json_response(404, {"message": "Not found", "route": path})
        return True

    def _serve_static_or_spa(self) -> None:
        path = self._clean_path()
        if path == "/cdn-cgi/rum":
            self.send_response(204)
            self.end_headers()
            return
        if self._should_handle_api():
            self._handle_api()
            return
        if not self._is_real_file(path):
            self.path = "/index.html" + ("?" + self.path.partition("?")[2] if "?" in self.path else "")
        return super().do_GET()

    def do_GET(self) -> None:
        self._serve_static_or_spa()

    def do_HEAD(self) -> None:
        path = self._clean_path()
        if self._should_handle_api():
            return self._handle_api()
        if not self._is_real_file(path):
            self.path = "/index.html"
        return super().do_HEAD()

    def do_OPTIONS(self) -> None:
        self._clean_path()
        if self._should_handle_api():
            self.send_response(204)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
            self.end_headers()
            return
        self.send_error(405)

    def do_POST(self) -> None:
        self._clean_path()
        if self._api_path() == "/cdn-cgi/rum":
            self.send_response(204)
            self.end_headers()
            return
        if self._should_handle_api():
            self._handle_api()
            return
        self.send_error(405)

    def do_PUT(self) -> None:
        self._clean_path()
        if self._should_handle_api():
            self._handle_api()
            return
        self.send_error(405)

    def do_PATCH(self) -> None:
        self._clean_path()
        if self._should_handle_api():
            self._handle_api()
            return
        self.send_error(405)

    def do_DELETE(self) -> None:
        self._clean_path()
        if self._should_handle_api():
            self._handle_api()
            return
        self.send_error(405)


class ReuseTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


def free_port(port: int) -> None:
    if os.name != "nt":
        return
    try:
        out = subprocess.check_output(
            f"netstat -ano | findstr :{port} | findstr LISTENING",
            shell=True,
            text=True,
            stderr=subprocess.DEVNULL,
        )
        for line in out.splitlines():
            pid = line.split()[-1]
            if pid.isdigit():
                subprocess.run(["taskkill", "/F", "/PID", pid], capture_output=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        pass


if __name__ == "__main__":
    os.chdir(ROOT)
    _hydrate_requests_from_disk()
    free_port(PORT)
    try:
        httpd = ReuseTCPServer(("", PORT), SPAHandler)
    except OSError:
        print(f"\nERROR: Port {PORT} is busy.")
        print("Close other terminals using port 8000, then run:  python server.py\n")
        raise SystemExit(1)
    print(f"\n  Meesho Image Generator running")
    print(f"  Open: http://localhost:{PORT}/\n")
    with httpd:
        httpd.serve_forever()
