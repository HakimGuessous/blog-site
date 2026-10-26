#!/usr/bin/env node
// Builds the site into dist/ from articles kept outside the repo.
//
//   node scripts/build.mjs                 production build: no drafts, no examples
//   node scripts/build.mjs --drafts        include articles marked as drafts
//   node scripts/build.mjs --examples      include the committed example article(s)
//   CONTENT_DIR=/path/to/articles ...      read articles from anywhere, not just ./content
//
// An article is a folder holding an index.md (or index.html) plus any images, clips and
// widget files it uses, or a single .md or .html file. See README.md for the format.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { articlePage, indexPage, notFoundPage, feed, sitemap } from "../src/templates.mjs";
import { renderMarkdown, ArticleError } from "../src/markdown.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function loadConfig(overrides = {}) {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
  Object.assign(cfg, overrides);
  return cfg;
}

// ---------- reading articles ----------

const attrs = (tag) => {
  const out = {};
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[m[1].toLowerCase()] = m[2] ?? m[3];
  return out;
};

const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&nbsp;/g, " ");

const stripTags = (s) => decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

export const slugify = (s) =>
  s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/&[a-z]+;/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

function parseArticle(file, slug, { loose = false } = {}) {
  const src = fs.readFileSync(file, "utf8");
  const dir = path.dirname(file);
  let meta = {}, body, refs = new Set();

  if (file.endsWith(".md")) {
    let out;
    try { out = renderMarkdown(src, { dir }); }
    catch (e) { if (e instanceof ArticleError) throw new Error(`${path.relative(ROOT, file)}: ${e.message}`); throw e; }
    meta = Object.fromEntries(Object.entries(out.meta).map(([k, v]) => [k, Array.isArray(v) ? v.join(",") : String(v)]));
    body = out.html;
  } else {
    for (const m of src.matchAll(/<meta\b[^>]*>/gi)) {
      const a = attrs(m[0]);
      if (a.name && a.content !== undefined) meta[a.name.toLowerCase()] = decode(a.content);
    }
    meta.title ||= stripTags(src.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    body =
      src.match(/<article\b[^>]*>([\s\S]*)<\/article>/i)?.[1] ??
      src.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ??
      src.replace(/<head\b[\s\S]*?<\/head>/i, "").replace(/<\/?(html|!doctype)[^>]*>/gi, "");
  }

  let title = meta.title || "";
  const h1 = body.match(/^\s*<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) {
    title ||= stripTags(h1[1]);
    body = body.slice(h1.index + h1[0].length); // the template renders the title
  }
  title ||= slug;

  const date = meta.date ? new Date(`${meta.date.slice(0, 10)}T00:00:00Z`) : null;
  if (date && isNaN(date)) throw new Error(`${path.relative(ROOT, file)}: the date must be YYYY-MM-DD, got "${meta.date}"`);

  // Every file the article points at must exist, so a missing upload fails here, not on the live site.
  for (const m of body.matchAll(/\s(?:src|poster)\s*=\s*"([^"]+)"/gi)) refs.add(decode(m[1]));
  const local = [...refs].filter((r) => !/^([a-z]+:|\/|#)/i.test(r));
  if (loose && local.length)
    throw new Error(`${path.relative(ROOT, file)} uses ${local.join(", ")}. An article with files of its own needs a folder: move it to ${slug}/index${path.extname(file)} with the files beside it.`);
  const missing = local.filter((r) => !fs.existsSync(path.join(dir, r.split(/[?#]/)[0])));
  if (missing.length)
    throw new Error(`${path.relative(ROOT, file)} refers to ${missing.length > 1 ? "files that aren't" : "a file that isn't"} in its folder:\n  ${missing.join("\n  ")}`);

  const text = body.replace(/<(style|script|svg)\b[\s\S]*?<\/\1>/gi, " ");
  const words = stripTags(text).split(" ").filter(Boolean).length;
  return {
    slug: meta.slug ? slugify(meta.slug) : slug,
    title,
    description: meta.description || "",
    author: meta.author || "",
    date,
    tags: (meta.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
    draft: /^(true|yes|1)$/i.test(meta.draft || ""),
    words,
    minutes: Math.max(1, Math.round(words / 230)),
    html: transform(body),
  };
}

// Small, predictable touches to the article's own HTML. Nothing else is rewritten.
function transform(html) {
  const used = new Set();
  // Heading anchors on h2/h3.
  html = html.replace(/<(h[23])\b([^>]*)>([\s\S]*?)<\/\1>/gi, (all, tag, rest, inner) => {
    const a = attrs(rest);
    let id = a.id || slugify(stripTags(inner)) || "section";
    let n = 2;
    while (used.has(id)) id = `${a.id || slugify(stripTags(inner))}-${n++}`;
    used.add(id);
    const restNoId = rest.replace(/\sid\s*=\s*("[^"]*"|'[^']*')/i, "");
    return `<${tag} id="${id}"${restNoId}>${inner}<a class="anchor" href="#${id}" aria-label="Link to this section"></a></${tag}>`;
  });
  // "Fig. 3 – Caption" gets its number marked up so styles can set it apart.
  html = html.replace(/(<figcaption\b[^>]*>\s*)(?:<em>)?\s*(Fig(?:ure)?\.?\s*\d+[a-z]?)\s*[–—-]\s*([\s\S]*?)(?:<\/em>)?(\s*<\/figcaption>)/gi,
    (all, open, no, text, close) => `${open}<span class="fig-no">${no}</span> <span class="fig-text">${text}</span>${close}`);
  // Lazy-load images below the fold.
  html = html.replace(/<img\b(?![^>]*\bloading=)/gi, '<img loading="lazy" decoding="async"');
  // Autoplaying clips must be muted and inline to play on phones.
  html = html.replace(/<video\b([^>]*)>/gi, (all, rest) => {
    if (!/\bautoplay\b/i.test(rest)) return all;
    let r = rest;
    if (!/\bmuted\b/i.test(r)) r += " muted";
    if (!/\bplaysinline\b/i.test(r)) r += " playsinline";
    return `<video${r}>`;
  });
  // Tables scroll sideways on small screens instead of breaking the page.
  html = html.replace(/<table\b[\s\S]*?<\/table>/gi, (t) => `<div class="table-wrap">${t}</div>`);
  // Everything after a "References" heading is set as a references block.
  html = html.replace(/(<h2 id="references[^"]*"[\s\S]*)$/i, '<section class="references" aria-label="References">$1</section>');
  // Links out of the site open normally but don't leak the opener.
  html = html.replace(/<a\b([^>]*\bhref="https?:[^"]*"[^>]*)>/gi, (all, rest) =>
    /\brel=/.test(rest) ? all : `<a${rest} rel="noopener">`);
  return html;
}

function collect(dir, { example = false } = {}) {
  if (!fs.existsSync(dir)) return [];
  const posts = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".") || entry.name.startsWith("_")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const md = path.join(full, "index.md"), html = path.join(full, "index.html");
      const hasMd = fs.existsSync(md), hasHtml = fs.existsSync(html);
      if (hasMd && hasHtml) throw new Error(`${path.relative(ROOT, full)} has both index.md and index.html. Keep one.`);
      if (!hasMd && !hasHtml) continue;
      const file = hasMd ? md : html;
      posts.push({ ...parseArticle(file, slugify(entry.name)), assets: full, source: file, example });
    } else if (entry.isFile() && /\.(md|html)$/.test(entry.name)) {
      posts.push({ ...parseArticle(full, slugify(entry.name.replace(/\.(md|html)$/, "")), { loose: true }), assets: null, example });
    }
  }
  return posts;
}

// Copies a folder. For an article (skip = its source file), Markdown files are left out too,
// so notes kept beside a post never reach the public site.
function copyDir(from, to, skip) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue;
    const a = path.join(from, e.name), b = path.join(to, e.name);
    if (a === skip || (skip && e.isFile() && e.name.endsWith(".md"))) continue;
    if (e.isDirectory()) copyDir(a, b, skip);
    else fs.copyFileSync(a, b);
  }
}

// ---------- build ----------

export function build({ drafts = false, examples = false, dev = false, out = path.join(ROOT, "dist"), config = {} } = {}) {
  const t0 = Date.now();
  const cfg = loadConfig(config);
  const contentDir = path.resolve(ROOT, process.env.CONTENT_DIR || cfg.contentDir || "content");
  cfg.contentDir = path.relative(ROOT, contentDir) || contentDir;

  let posts = collect(contentDir);
  if (examples) posts.push(...collect(path.join(ROOT, "examples"), { example: true }));
  posts = posts.filter((p) => drafts || !p.draft);

  const seen = new Map();
  for (const p of posts) {
    if (seen.has(p.slug)) throw new Error(`Two articles share the slug "${p.slug}". Rename a folder or set <meta name="slug">.`);
    seen.set(p.slug, p);
  }
  posts.sort((a, b) => (b.date?.getTime() ?? Infinity) - (a.date?.getTime() ?? Infinity) || a.title.localeCompare(b.title));

  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  copyDir(path.join(ROOT, "src", "assets"), path.join(out, "assets"));

  const linkFrom = (root) => (p) => `${root}${p.slug}/${cfg.prettyUrls ? "" : "index.html"}`;

  posts.forEach((post, i) => {
    const dir = path.join(out, post.slug);
    if (post.assets) copyDir(post.assets, dir, post.source);
    else fs.mkdirSync(dir, { recursive: true });
    const html = articlePage({ cfg, post, prev: posts[i + 1], next: posts[i - 1], root: "../", link: linkFrom("../"), dev });
    fs.writeFileSync(path.join(dir, "index.html"), html);
  });

  fs.writeFileSync(path.join(out, "index.html"), indexPage({ cfg, posts, root: "", link: linkFrom(""), dev }));
  fs.writeFileSync(path.join(out, "404.html"), notFoundPage({ cfg, dev }));
  const live = posts.filter((p) => !p.draft && !p.example);
  fs.writeFileSync(path.join(out, "feed.xml"), feed({ cfg, posts: live }));
  if (cfg.url) fs.writeFileSync(path.join(out, "sitemap.xml"), sitemap({ cfg, posts: live }));

  const ms = Date.now() - t0;
  console.log(`Built ${posts.length} article${posts.length === 1 ? "" : "s"} from ${cfg.contentDir}/ in ${ms} ms → ${path.relative(process.cwd(), out) || out}`);
  for (const p of posts) console.log(`  ${p.slug}${p.draft ? " (draft)" : ""}${p.example ? " (example)" : ""}`);
  return posts;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const cfg = loadConfig();
  const flag = (f) => args.includes(f);
  const outArg = args.find((a) => a.startsWith("--out="))?.slice(6);
  try {
    build({
      drafts: flag("--drafts"),
      examples: flag("--examples") || cfg.examples === "always",
      out: outArg ? path.resolve(outArg) : undefined,
      config: flag("--file-urls") ? { prettyUrls: false } : {},
    });
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
