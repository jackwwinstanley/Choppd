#!/usr/bin/env python3
"""
SearTune dev server — like `python3 -m http.server` but sends no-cache
headers so the browser never serves stale app.js/styles.css after edits.

Usage:  python3 serve.py   (run from the mvp/ directory)
"""
import http.server
import socketserver

PORT = 4173
HOST = "127.0.0.1"


# Threaded so one slow/stuck request can't block every other asset (the single-
# threaded TCPServer would hang the whole dev server under concurrent loads).
class ThreadingHTTPServer(socketserver.ThreadingMixIn, socketserver.TCPServer):
    daemon_threads = True
    allow_reuse_address = True


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # force the browser to always re-fetch local assets
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    # HTTP Range support (SimpleHTTPRequestHandler has none): without 206
    # responses Chrome reports audio as non-seekable (seekable = [0,0]) and
    # every currentTime seek clamps to 0 — so cook-clock re-sync and skip
    # navigation silently break in LOCAL DEV only (prod Caddy serves ranges).
    def send_head(self):
        import os, re
        rng = self.headers.get("Range")
        if not rng:
            return super().send_head()
        path = self.translate_path(self.path)
        if os.path.isdir(path) or not os.path.exists(path):
            return super().send_head()
        m = re.match(r"bytes=(\d*)-(\d*)$", rng.strip())
        if not m:
            return super().send_head()
        size = os.path.getsize(path)
        start = int(m.group(1)) if m.group(1) else max(0, size - int(m.group(2) or 0))
        end = int(m.group(2)) if (m.group(1) and m.group(2)) else size - 1
        if start >= size:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.end_headers()
            return None
        end = min(end, size - 1)
        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        # cap the body at the requested range (copyfile would send to EOF)
        remaining = end - start + 1
        data = f.read(remaining)
        f.close()
        import io
        return io.BytesIO(data)

    def log_message(self, *args):
        pass  # quiet


if __name__ == "__main__":
    with ThreadingHTTPServer((HOST, PORT), NoCacheHandler) as httpd:
        print(f"Choppd (no-cache, threaded) serving on http://{HOST}:{PORT}")
        httpd.serve_forever()
