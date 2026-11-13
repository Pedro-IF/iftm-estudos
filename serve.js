#!/usr/bin/env node
// Tiny static server for the study website.
// Usage: node serve.js [port]   ->  http://127.0.0.1:8000/site/
"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = __dirname;
const PORT = Number(process.argv[2] || process.env.PORT || 8000);
const HOME = "/site/";
const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".md": "text/plain; charset=utf-8",
};

function send(res, status, body, type) {
    res.writeHead(status, { "Content-Type": type || "text/plain; charset=utf-8" });
    res.end(body);
}

function resolve(pathname) {
    try {
        const file = path.join(ROOT, decodeURIComponent(pathname));
        return file === ROOT || file.startsWith(ROOT + path.sep) ? file : null;
    } catch (err) {
        return null;  // malformed percent-encoding
    }
}

function serve(req, res) {
    const pathname = new URL(req.url, "http://localhost").pathname;
    if (pathname === "/") {
        res.writeHead(302, { Location: HOME });
        res.end();
        return;
    }
    let file = resolve(pathname);
    if (!file) {
        send(res, 403, "Forbidden");
        return;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        file = path.join(file, "index.html");
    }
    fs.readFile(file, function (err, data) {
        if (err) {
            send(res, 404, "Not found: " + pathname);
            return;
        }
        res.setHeader("Cache-Control", "no-cache");
        send(res, 200, data, TYPES[path.extname(file).toLowerCase()]);
        console.log(req.method + " " + pathname);
    });
}

http.createServer(serve).listen(PORT, "127.0.0.1", function () {
    console.log("Study site: http://127.0.0.1:" + PORT + HOME + "  (Ctrl+C to stop)");
});
