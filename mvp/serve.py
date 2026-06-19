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


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # force the browser to always re-fetch local assets
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, *args):
        pass  # quiet


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((HOST, PORT), NoCacheHandler) as httpd:
        print(f"SearTune (no-cache) serving on http://{HOST}:{PORT}")
        httpd.serve_forever()
