#!/usr/bin/env node
// Local preview with drafts and examples, rebuilt and reloaded whenever a file changes.
//   npm run dev            http://localhost:4321
//   PORT=8080 npm run dev

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, loadConfig } from "./build.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, ".dev");
const PORT = Number(process.env.PORT || 4321);
const cfg = loadConfig();
const opts = { drafts: true, examples: cfg.examples !== "never", dev: true, out: OUT };

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".xml": "application/xml", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".gif": "image/gif", ".webp": "image/webp", ".avif": "image/avif", ".mp4": "video/mp4", ".webm": "video/webm",
  ".woff2": "font/woff2", ".ico": "image/x-icon", ".pdf": "application/pdf",
};

const clients = new Set();
const rebuild = () => {
  try { build(opts); } catch (e) { console.error(`Build failed: ${e.message}`); }
  for (const res of clients) res.write("data: reload\n\n");
};
rebuild();

let timer;
const watchDirs = ["src", "examples", process.env.CONTENT_DIR || cfg.contentDir || "content"].map((d) => path.resolve(ROOT, d));
for (const dir of watchDirs) {
  if (!fs.existsSync(dir)) continue;
  fs.watch(dir, { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(rebuild, 120); });
}
fs.watch(path.join(ROOT, "site.config.json"), () => { clearTimeout(timer); timer = setTimeout(rebuild, 120); });

http.createServer((req, res) => {
  const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (url === "/__reload") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    res.write("\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return;
  }
  let file = path.join(OUT, url);
  if (!file.startsWith(OUT)) { res.writeHead(403).end(); return; }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file)) {
    if (!url.endsWith("/") && fs.existsSync(path.join(OUT, url, "index.html"))) { res.writeHead(301, { location: `${url}/` }).end(); return; }
    res.writeHead(404, { "content-type": TYPES[".html"] }).end(fs.readFileSync(path.join(OUT, "404.html")));
    return;
  }
  const stat = fs.statSync(file);
  const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
  const range = req.headers.range?.match(/bytes=(\d*)-(\d*)/); // Safari needs ranges for video
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Number(range[2]) : stat.size - 1;
    res.writeHead(206, { "content-type": type, "content-range": `bytes ${start}-${end}/${stat.size}`, "accept-ranges": "bytes", "content-length": end - start + 1 });
    fs.createReadStream(file, { start, end }).pipe(res);
    return;
  }
  res.writeHead(200, { "content-type": type, "content-length": stat.size, "accept-ranges": "bytes", "cache-control": "no-store" });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => console.log(`\nPreview at http://localhost:${PORT} (drafts and examples included)\n`));
