#!/usr/bin/env node
// Starts a new article as a draft:  npm run new "Will LLMs Generalise? (3/3)"
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig, slugify } from "./build.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const title = process.argv.slice(2).join(" ").trim();
if (!title) {
  console.error('Give the article a title: npm run new "My title"');
  process.exit(1);
}
const cfg = loadConfig();
const dir = path.join(path.resolve(ROOT, process.env.CONTENT_DIR || cfg.contentDir), slugify(title));
if (fs.existsSync(dir)) {
  console.error(`${path.relative(ROOT, dir)} already exists.`);
  process.exit(1);
}
const today = new Date().toISOString().slice(0, 10);
fs.mkdirSync(path.join(dir, "images"), { recursive: true });
fs.writeFileSync(
  path.join(dir, "index.md"),
  `---
title: ${JSON.stringify(title)}
date: ${today}
description: One or two sentences that sit under the title and in the article list.
draft: true
---

## Introduction

Write here.

## References

**Introduction**

- [Source title](https://example.com) (Publisher, Mon ${today.slice(0, 4)})
`,
);
console.log(`Created ${path.relative(ROOT, dir)}/index.md as a draft. Change "draft: true" to "draft: false", or delete the line, to publish it.`);
