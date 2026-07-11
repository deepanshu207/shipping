"""Serve the Meesho Image Generator SPA with own local API."""
import json
import mimetypes
import os
import re
import socketserver
import subprocess
import time
import uuid
from http.server import SimpleHTTPRequestHandler
from pathlib import Path

REPO = Path(__file__).resolve().parent
ROOT = REPO
PORT = 8000

mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("application/wasm", ".wasm")
CATEGORIES_FILE = ROOT / "data" / "product-types.json"
OPTIMIZE_SCRIPT = REPO / "scripts" / "optimize-stdin.mjs"

MOCK_REQUESTS: dict[str, dict] = {}
GUEST_USER = {
    "id": "guest-local",
    "email": "guest@localhost",
    "name": "Local Guest",
    "credits": 999,
    "role": "USER",
    "picture": None,
}


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

    def _optimize_image(self, image_bytes: bytes, tag_name: str) -> list[dict]:
        is_auto = "auto" in str(tag_name or "").lower()
        proc = subprocess.run(
            ["node", str(OPTIMIZE_SCRIPT), tag_name],
            input=image_bytes,
            capture_output=True,
            cwd=str(REPO),
            timeout=300 if is_auto else 120,
        )
        if proc.returncode != 0:
            err = proc.stderr.decode("utf-8", errors="replace")
            raise RuntimeError(err or "Image optimization failed")
        return json.loads(proc.stdout.decode("utf-8"))

    def _process_request(self, request_id: str) -> None:
        req = MOCK_REQUESTS.get(request_id)
        if not req or req.get("status") == "completed" or req.get("processing"):
            return
        req["processing"] = True
        try:
            req["results"] = self._optimize_image(req["image_bytes"], req["tag_name"])
            req["status"] = "completed"
            req["image_bytes"] = None
        except Exception as exc:
            req["status"] = "failed"
            req["error"] = str(exc)
        finally:
            req["processing"] = False

    def _handle_api(self) -> bool:
        path = self._api_path()

        if path == "/api/health" and self.command == "GET":
            self._json_response(200, {"ok": True, "api": "own", "service": "server.py"})
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
            MOCK_REQUESTS[request_id] = {
                "created_at": time.time(),
                "tag_id": form.get("tagId", ""),
                "tag_name": form.get("tagName", "Product"),
                "image_bytes": image["bytes"],
                "status": "processing",
                "results": [],
                "processing": False,
            }
            self._json_response(200, {"requestId": request_id})
            return True

        request_match = re.fullmatch(r"/api/meesho/request(?:-status)?/([^/]+)", path)
        if request_match and self.command == "GET":
            request_id = request_match.group(1)
            req = MOCK_REQUESTS.get(request_id)
            if not req:
                self._json_response(404, {"message": "Request not found"})
                return True
            if req.get("status") != "completed" and not req.get("processing"):
                self._process_request(request_id)
            if req.get("status") == "failed":
                self._json_response(200, {"status": "failed", "results": []})
                return True
            if time.time() - req["created_at"] < 3 or req.get("status") != "completed":
                self._json_response(200, {"status": "processing", "results": []})
                return True
            self._json_response(200, {"status": "completed", "results": req.get("results", [])})
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
