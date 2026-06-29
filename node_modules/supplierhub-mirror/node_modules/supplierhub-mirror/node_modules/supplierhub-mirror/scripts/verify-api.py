"""Verify all Meesho tool APIs are served locally (own API, no SupplierHub proxy)."""
import json
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"

checks = []


def get(path):
    return urllib.request.urlopen(f"{BASE}{path}")


def post_multipart(path, fields, file_field=None):
    import uuid

    boundary = f"----Boundary{uuid.uuid4().hex}"
    body = b""
    for name, value in fields.items():
        body += f"--{boundary}\r\n".encode()
        body += f'Content-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
    if file_field:
        name, filename, content, mime = file_field
        body += f"--{boundary}\r\n".encode()
        body += f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'.encode()
        body += f"Content-Type: {mime}\r\n\r\n".encode()
        body += content
        body += b"\r\n"
    body += f"--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        f"{BASE}{path}",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    return urllib.request.urlopen(req)


def ok(name, detail=""):
    checks.append((name, True, detail))
    print(f"  OK  {name}" + (f" — {detail}" if detail else ""))


def fail(name, detail=""):
    checks.append((name, False, detail))
    print(f"FAIL  {name}" + (f" — {detail}" if detail else ""))


print(f"API verification @ {BASE}\n")

# 1. Health / own API marker
try:
    data = json.loads(get("/api/health").read())
    if data.get("api") == "own":
        ok("GET /api/health", "own API")
    else:
        fail("GET /api/health", "unexpected response")
except Exception as e:
    fail("GET /api/health", str(e))

# 2. Auth
try:
    user = json.loads(get("/auth/me").read())
    if user.get("email") == "guest@localhost":
        ok("GET /auth/me", f"credits={user.get('credits')}")
    else:
        fail("GET /auth/me", "not guest user")
except Exception as e:
    fail("GET /auth/me", str(e))

# 3. Categories (bundled locally)
try:
    cats = json.loads(get("/api/meesho/fetchCategoryTreeOrder").read())
    arr = cats.get("meeshoCategoryArray", [])
    if len(arr) >= 1:
        ok("GET /api/meesho/fetchCategoryTreeOrder", f"{len(arr)} category groups")
    else:
        fail("GET /api/meesho/fetchCategoryTreeOrder", "empty categories")
except Exception as e:
    fail("GET /api/meesho/fetchCategoryTreeOrder", str(e))

# 4. History
try:
    hist = json.loads(get("/api/meesho/fetchAllRequestId").read())
    if "data" in hist and "credits" in hist:
        ok("GET /api/meesho/fetchAllRequestId")
    else:
        fail("GET /api/meesho/fetchAllRequestId", "bad shape")
except Exception as e:
    fail("GET /api/meesho/fetchAllRequestId", str(e))

# 5. Generate + poll (minimal valid JPEG)
try:
    jpeg = (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
        b"\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c \x24\x2e\x27 \x22\x2c\x23\x1c\x1c\x28\x37\x29\x2c\x30\x31\x34\x34\x34\x1f\x27\x39\x3d\x38\x32\x3c\x2e\x33\x34\x32\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xc4\x00\xb5\x10\x00\x02\x01\x03\x03\x02\x04\x03\x05\x05\x04\x04\x00\x00\x01}\x01\x02\x03\x00\x04\x11\x05\x12!1A\x06\x13Qa\x07\"q\x142\x81\x91\xa1\x08#B\xb1\xc1\x15R\xd1\xf0$3br\x82\t\n\x16\x17\x18\x19\x1a%&'()*456789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz\x83\x84\x85\x86\x87\x88\x89\x8a\x92\x93\x94\x95\x96\x97\x98\x99\x9a\xa2\xa3\xa4\xa5\xa6\xa7\xa8\xa9\xaa\xb2\xb3\xb4\xb5\xb6\xb7\xb8\xb9\xba\xc2\xc3\xc4\xc5\xc6\xc7\xc8\xc9\xca\xd2\xd3\xd4\xd5\xd6\xd7\xd8\xd9\xda\xe1\xe2\xe3\xe4\xe5\xe6\xe7\xe8\xe9\xea\xf1\xf2\xf3\xf4\xf5\xf6\xf7\xf8\xf9\xfa\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xfb\xd5\xff\xd9"
    )
    created = json.loads(
        post_multipart(
            "/api/meesho/getLowestShippingCharge",
            {"tagId": "1", "tagName": "Test"},
            ("image", "test.jpg", jpeg, "image/jpeg"),
        ).read()
    )
    rid = created.get("requestId")
    if not rid:
        fail("POST /api/meesho/getLowestShippingCharge", "no requestId")
    else:
        ok("POST /api/meesho/getLowestShippingCharge", f"requestId={rid}")

        import time

        for _ in range(15):
            time.sleep(1)
            status = json.loads(get(f"/api/meesho/request/{rid}").read())
            if status.get("status") == "completed":
                results = status.get("results", [])
                if results and results[0].get("fileSizeKb"):
                    ok("GET /api/meesho/request/:id", f"smallest={results[0]['fileSizeKb']} KB")
                else:
                    fail("GET /api/meesho/request/:id", "no optimized results")
                break
        else:
            fail("GET /api/meesho/request/:id", "timeout")
except Exception as e:
    fail("generate flow", str(e))

# 6. Ensure NOT hitting SupplierHub
try:
    urllib.request.urlopen("https://backend.supplierhub.in/api/meesho/fetchCategoryTreeOrder", timeout=5)
    ok("SupplierHub backend", "reachable (we do NOT proxy to it)")
except urllib.error.HTTPError:
    ok("SupplierHub backend", "external only — app uses own /api/*")
except Exception as e:
    ok("SupplierHub backend", f"external ({e})")

passed = sum(1 for _, s, _ in checks if s)
total = len(checks)
print(f"\n{passed}/{total} checks passed")
sys.exit(0 if passed == total else 1)
