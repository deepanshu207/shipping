"""Serve the SupplierHub SPA with a local API (no SupplierHub backend)."""
import json
import os
import re
import socketserver
import subprocess
import time
import uuid
from http.server import SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "supplierhub.in"
REPO = Path(__file__).resolve().parent
PORT = 8000
CATEGORIES_FILE = ROOT / "data" / "meesho-categories.json"
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

    def _api_path(self) -> str:
        return self.path.split("?", 1)[0]

    def _should_handle_api(self) -> bool:
        return self._api_path().startswith("/api/") or self._api_path().startswith("/auth/")

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
        proc = subprocess.run(
            ["node", str(OPTIMIZE_SCRIPT), tag_name],
            input=image_bytes,
            capture_output=True,
            cwd=str(REPO),
            timeout=120,
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

        if path == "/auth/me" and self.command == "GET":
            self._json_response(200, GUEST_USER)
            return True

        if path == "/auth/logout" and self.command == "POST":
            self._json_response(200, {"ok": True})
            return True

        if path == "/api/meesho/fetchCategoryTreeOrder" and self.command == "GET":
            if not CATEGORIES_FILE.exists():
                self._json_response(503, {"message": "Categories file missing. Run fetch script."})
                return True
            self._json_response(200, json.loads(CATEGORIES_FILE.read_text(encoding="utf-8")))
            return True

        if path == "/api/meesho/fetchAllRequestId" and self.command == "GET":
            history = []
            for request_id, req in sorted(
                MOCK_REQUESTS.items(),
                key=lambda item: item[1]["created_at"],
                reverse=True,
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

            self._json_response(
                200,
                {"status": "completed", "results": req.get("results", [])},
            )
            return True

        self._json_response(404, {"message": "Not found", "route": path})
        return True

    def _send_cors_preflight(self) -> None:
        origin = self.headers.get("Origin", "http://localhost:8000")
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.end_headers()

    def do_OPTIONS(self) -> None:
        if self._should_handle_api():
            return self._send_cors_preflight()
        return super().do_OPTIONS()

    def do_GET(self) -> None:
        if self._should_handle_api():
            return self._handle_api()
        if self.path.startswith("/assets/") or Path(self.path).suffix:
            return super().do_GET()
        self.path = "/index.html"
        return super().do_GET()

    def do_HEAD(self) -> None:
        if self._should_handle_api():
            return self._handle_api()
        if self.path.startswith("/assets/") or Path(self.path).suffix:
            return super().do_HEAD()
        self.path = "/index.html"
        return super().do_HEAD()

    def do_POST(self) -> None:
        if self._should_handle_api():
            return self._handle_api()
        self.send_error(405, "Method Not Allowed")

    def do_PUT(self) -> None:
        if self._should_handle_api():
            return self._handle_api()
        self.send_error(405)

    def do_PATCH(self) -> None:
        if self._should_handle_api():
            return self._handle_api()
        self.send_error(405)

    def do_DELETE(self) -> None:
        if self._should_handle_api():
            return self._handle_api()
        self.send_error(405)


if __name__ == "__main__":
    os.chdir(ROOT)
    with socketserver.TCPServer(("", PORT), SPAHandler) as httpd:
        print(f"Serving {ROOT} at http://localhost:{PORT}")
        print("Own API (categories + image optimize) — no SupplierHub proxy")
        print(f"Open http://localhost:{PORT}/meesho-image-generator")
        httpd.serve_forever()
