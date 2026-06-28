"""Serve the SupplierHub SPA with a local mock API for no-login image generation."""
import base64
import cgi
import io
import json
import os
import re
import socketserver
import time
import urllib.error
import urllib.request
import uuid
from http.server import SimpleHTTPRequestHandler
from pathlib import Path

ROOT = Path(__file__).resolve().parent / "supplierhub.in"
BACKEND = "https://backend.supplierhub.in"
PORT = 8000
MOCK_MODE = True

HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}

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

    def _should_proxy(self) -> bool:
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

    def _mock_results(self, request_id: str) -> list[dict]:
        req = MOCK_REQUESTS[request_id]
        image = req["image"]
        tag_name = req["tag_name"]
        image_url = f"data:{image['type']};base64,{base64.b64encode(image['bytes']).decode()}"
        charges = ["38", "45", "52", "61"]
        return [
            {
                "shippingCharge": charge,
                "imageUrl": image_url,
                "tagName": tag_name,
                "lowest": charge == "38",
            }
            for charge in charges
        ]

    def _handle_mock(self) -> bool:
        if not MOCK_MODE:
            return False

        path = self._api_path()

        if path == "/auth/me" and self.command == "GET":
            self._json_response(200, GUEST_USER)
            return True

        if path == "/auth/logout" and self.command == "POST":
            self._json_response(200, {"ok": True})
            return True

        if path == "/api/meesho/fetchAllRequestId" and self.command == "GET":
            history = []
            for request_id, req in sorted(
                MOCK_REQUESTS.items(),
                key=lambda item: item[1]["created_at"],
                reverse=True,
            ):
                if time.time() - req["created_at"] >= 5:
                    history.append(
                        {
                            "requestId": request_id,
                            "status": "completed",
                            "tagName": req["tag_name"],
                            "createdAt": req["created_at"] * 1000,
                            "results": self._mock_results(request_id),
                        }
                    )
                else:
                    history.append(
                        {
                            "requestId": request_id,
                            "status": "processing",
                            "tagName": req["tag_name"],
                            "createdAt": req["created_at"] * 1000,
                            "results": [],
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
                "image": image,
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

            if time.time() - req["created_at"] < 5:
                self._json_response(200, {"status": "processing", "results": []})
                return True

            self._json_response(
                200,
                {"status": "completed", "results": self._mock_results(request_id)},
            )
            return True

        return False

    def _proxy(self) -> None:
        url = f"{BACKEND}{self.path}"
        body = self._read_body() if self.command in {"POST", "PUT", "PATCH", "DELETE"} else None

        headers = {}
        for key, value in self.headers.items():
            lower = key.lower()
            if lower in HOP_BY_HOP or lower == "host":
                continue
            headers[key] = value

        request = urllib.request.Request(url, data=body, headers=headers, method=self.command)
        try:
            with urllib.request.urlopen(request) as response:
                self.send_response(response.status)
                for key, value in response.headers.items():
                    if key.lower() not in HOP_BY_HOP:
                        self.send_header(key, value)
                self.end_headers()
                self.wfile.write(response.read())
        except urllib.error.HTTPError as error:
            self.send_response(error.code)
            for key, value in error.headers.items():
                if key.lower() not in HOP_BY_HOP:
                    self.send_header(key, value)
            self.end_headers()
            self.wfile.write(error.read())

    def _handle_api(self) -> None:
        if self._handle_mock():
            return
        self._proxy()

    def _send_cors_preflight(self) -> None:
        origin = self.headers.get("Origin", "http://localhost:8000")
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.end_headers()

    def do_OPTIONS(self) -> None:
        if self._should_proxy():
            return self._send_cors_preflight()
        return super().do_OPTIONS()

    def do_GET(self) -> None:
        if self._should_proxy():
            return self._handle_api()
        if self.path.startswith("/assets/") or Path(self.path).suffix:
            return super().do_GET()
        self.path = "/index.html"
        return super().do_GET()

    def do_HEAD(self) -> None:
        if self._should_proxy():
            return self._handle_api()
        if self.path.startswith("/assets/") or Path(self.path).suffix:
            return super().do_HEAD()
        self.path = "/index.html"
        return super().do_HEAD()

    def do_POST(self) -> None:
        if self._should_proxy():
            return self._handle_api()
        self.send_error(405, "Method Not Allowed")

    def do_PUT(self) -> None:
        if self._should_proxy():
            return self._handle_api()
        self.send_error(405)

    def do_PATCH(self) -> None:
        if self._should_proxy():
            return self._handle_api()
        self.send_error(405)

    def do_DELETE(self) -> None:
        if self._should_proxy():
            return self._handle_api()
        self.send_error(405)


if __name__ == "__main__":
    os.chdir(ROOT)
    with socketserver.TCPServer(("", PORT), SPAHandler) as httpd:
        print(f"Serving {ROOT} at http://localhost:{PORT}")
        print(f"Mock mode: {MOCK_MODE} (generate works without login)")
        print(f"Categories proxy -> {BACKEND}")
        print(f"Open http://localhost:{PORT}/meesho-image-generator")
        httpd.serve_forever()
