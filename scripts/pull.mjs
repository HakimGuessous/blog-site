#!/usr/bin/env node
// Fetches the articles into the content folder from wherever they're kept, for builds on
// a machine that doesn't have them (CI, a new laptop). Set CONTENT_SOURCE to one of:
//
//   gs://my-bucket/articles            Google Cloud Storage (needs gsutil or gcloud)
//   s3://my-bucket/articles            Amazon S3 (needs the aws CLI)
//   git@github.com:me/articles.git     a separate private repo (needs git)
//   /Users/me/Dropbox/blog             any folder on this machine
//
//   CONTENT_SOURCE=gs://my-bucket/articles npm run pull

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "./build.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = loadConfig();
const src = process.env.CONTENT_SOURCE;
const dest = path.resolve(ROOT, process.env.CONTENT_DIR || cfg.contentDir);
if (!src) {
  console.error("Set CONTENT_SOURCE to a gs://, s3://, git or local path. See the comment at the top of this file.");
  process.exit(1);
}
const run = (cmd, args) => { console.log(`$ ${cmd} ${args.join(" ")}`); execFileSync(cmd, args, { stdio: "inherit" }); };
const has = (cmd) => { try { execFileSync(cmd, ["--version"], { stdio: "ignore" }); return true; } catch { return false; } };

fs.mkdirSync(dest, { recursive: true });
if (src.startsWith("gs://")) {
  if (has("gcloud")) run("gcloud", ["storage", "rsync", "--recursive", "--delete-unmatched-destination-objects", src, dest]);
  else run("gsutil", ["-m", "rsync", "-r", "-d", src, dest]);
} else if (src.startsWith("s3://")) {
  run("aws", ["s3", "sync", "--delete", src, dest]);
} else if (/^(git@|https:\/\/.*\.git$|ssh:\/\/)/.test(src)) {
  if (fs.existsSync(path.join(dest, ".git"))) run("git", ["-C", dest, "pull", "--ff-only"]);
  else { fs.rmSync(dest, { recursive: true, force: true }); run("git", ["clone", "--depth", "1", src, dest]); }
} else {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(path.resolve(src), dest, { recursive: true });
}
console.log(`Articles are in ${path.relative(ROOT, dest)}/`);
