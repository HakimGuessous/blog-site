// Turns an article written in Markdown into the HTML the templates expect.
//
// Standard Markdown (GitHub flavour: tables, strikethrough, raw HTML) plus:
//
//   Front matter    --- title / date / description / author / draft / slug / tags ---
//                   or, for older drafts, a "# Title" line followed by a date line.
//   Figures         an image on its own line, optionally followed by {width=60%} and by an
//                   italic "*Fig. N – caption*" line. Images ending .mp4/.webm become looping
//                   clips, and a .gif with a same-named file in a sibling mp4/ folder
//                   is swapped for the MP4.
//   ```widget       an HTML file shown in the article. See renderWidget below.
//   ```video        a clip with options (controls, poster, once).
//   ```wide         Markdown that may run wider than the text column.
//
// Every custom block's first line is the block name, then its options; the lines inside
// are the caption (or, for wide, the content). Unknown options stop the build, so a
// typo never silently changes a figure.

import fs from "node:fs";
import path from "node:path";
import { Marked } from "marked";

const esc = (s = "") =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const stripTags = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

export class ArticleError extends Error {}

// ---------- front matter ----------

function parseValue(v) {
  v = v.trim();
  if (!/^["']/.test(v)) v = v.replace(/\s+#.*$/, ""); // a trailing "# comment"
  if (/^(true|yes)$/i.test(v)) return true;
  if (/^(false|no)$/i.test(v)) return false;
  if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(",").map((s) => parseValue(s)).filter((s) => s !== "");
  if (/^".*"$|^'.*'$/.test(v)) return v.slice(1, -1);
  return v;
}

export function splitFrontMatter(src) {
  src = src.replace(/^﻿/, "").replace(/\r\n/g, "\n");
  const meta = {};
  const fm = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    for (const line of fm[1].split("\n")) {
      if (!line.trim() || line.trim().startsWith("#")) continue;
      const m = line.match(/^([A-Za-z][\w-]*)\s*:\s*(.*)$/);
      if (!m) throw new ArticleError(`front matter line not understood: "${line}" (expected "key: value")`);
      meta[m[1].toLowerCase()] = parseValue(m[2]);
    }
    return { meta, body: src.slice(fm[0].length) };
  }
  // Older drafts: "# Title", then optionally a date line such as "Oct 17, 2026 · @Name".
  let body = src;
  const h1 = body.match(/^\s*#\s+(.+)\n+/);
  if (h1) {
    meta.title = h1[1].trim();
    body = body.slice(h1[0].length);
    const dateLine = body.match(/^([^\n#][^\n]*)\n+/);
    const d = dateLine && Date.parse(`${dateLine[1].split("·")[0].trim()} UTC`);
    if (d && dateLine[1].length < 80) {
      meta.date = new Date(d).toISOString().slice(0, 10);
      body = body.slice(dateLine[0].length);
    }
  }
  return { meta, body };
}

// ---------- custom blocks ----------

// "path 1280x720 height=400 replay title='A thing'" → { args: [...], opts: {...} }
function parseInfo(info) {
  const args = [], opts = {};
  for (const m of info.matchAll(/([\w-]+)=("[^"]*"|'[^']*'|\S+)|("[^"]*"|'[^']*'|\S+)/g)) {
    if (m[1]) opts[m[1].toLowerCase()] = m[2].replace(/^["']|["']$/g, "");
    else args.push(m[3].replace(/^["']|["']$/g, ""));
  }
  return { args, opts };
}

function allow(kind, opts, names) {
  const bad = Object.keys(opts).filter((k) => !names.includes(k));
  if (bad.length) throw new ArticleError(`${kind.startsWith("the ") ? kind : `\`\`\`${kind}`} doesn't take ${bad.map((b) => `"${b}"`).join(", ")}. It takes: ${names.join(", ") || "nothing"}`);
}

function caption(md, marked) {
  const text = md.trim();
  return text ? `\n  <figcaption>${marked.parseInline(text.replace(/\n+/g, " "))}</figcaption>` : "";
}

// Display width for any figure: width=60% (a share of the figure's full width),
// width=400px (that wide, or narrower on small screens), or width=text (the text column's width).
// Returns the attributes for the <figure> tag.
function figureAttrs(width, classes = [], where = "figure") {
  const cls = [...classes];
  let style = "";
  if (width !== undefined) {
    const w = String(width).trim().toLowerCase();
    let m;
    if ((m = w.match(/^(\d+(?:\.\d+)?)%$/)) && +m[1] > 0 && +m[1] <= 100) { cls.push("sized", "sized--share"); style = `--fig-width: ${+m[1]}%`; }
    else if ((m = w.match(/^(\d+)(?:px)?$/)) && +m[1] > 0) { cls.push("sized", "sized--px"); style = `--fig-width: ${+m[1]}px`; }
    else if (w === "text") cls.push("sized", "sized--text");
    else throw new ArticleError(`${where}: width "${width}" isn't understood. Use a share like 60%, a size like 400px, or text`);
  }
  return `${cls.length ? ` class="${cls.join(" ")}"` : ""}${style ? ` style="${style}"` : ""}`;
}

// ```widget path/to/page.html [WxH] [height=N] [inline] [replay] [title="..."]
//   (no size)      responsive: the frame grows to fit the page's content
//   WxH            a fixed-size page, such as a 1280x720 animation, scaled to fit
//   height=N       a fixed height in pixels, full width
//   inline         paste the page into the article instead of framing it
//   replay         add a Replay button, for animations that play once
//   width=...      display width, as for images: 60%, 400px or text
function renderWidget(info, body, ctx) {
  const { args, opts } = parseInfo(info);
  const flags = args.slice(1).map((a) => a.toLowerCase());
  const src = args[0];
  if (!src) throw new ArticleError("```widget needs a file, e.g. ```widget animations/team.html 1280x720");
  for (const f of flags) if (!/^\d+x\d+$/.test(f) && !["inline", "replay"].includes(f))
    throw new ArticleError(`\`\`\`widget ${src}: "${f}" isn't an option. Use WxH (like 1280x720), height=N, inline, replay or title="..."`);
  allow("widget", opts, ["height", "title", "width"]);
  const fig = (extra = "") => `<figure${figureAttrs(opts.width, ["figure-widget"], `\`\`\`widget ${src}`)}${extra}>`;
  const size = flags.find((f) => /^\d+x\d+$/.test(f));
  const capHtml = caption(body, ctx.marked);
  const title = esc(opts.title || stripTags(capHtml) || src);
  const replay = flags.includes("replay") ? " data-replay" : "";
  ctx.refs.add(src);

  if (flags.includes("inline")) {
    const file = path.join(ctx.dir, src);
    if (!fs.existsSync(file)) return `${fig()}<p>Missing widget: ${esc(src)}</p></figure>`; // reported by the build
    const html = fs.readFileSync(file, "utf8");
    const styles = (html.match(/<head\b[\s\S]*?<\/head>/i)?.[0].match(/<style\b[\s\S]*?<\/style>/gi) || []).join("\n");
    const inner = html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html.replace(/<head\b[\s\S]*?<\/head>|<\/?(html|!doctype)[^>]*>/gi, "");
    return `${fig()}\n  <div class="embed embed--inline">\n${styles}\n${inner}\n  </div>${capHtml}\n</figure>`;
  }
  if (size) {
    const [w, h] = size.split("x").map(Number);
    return `${fig(replay)}
  <div class="embed embed--scaled" data-width="${w}" style="aspect-ratio: ${w} / ${h}">
    <iframe src="${esc(src)}" title="${title}" loading="lazy" style="width: ${w}px; height: ${h}px"></iframe>
  </div>${capHtml}
</figure>`;
  }
  const height = opts.height ? Number(opts.height) : null;
  if (opts.height && !(height > 0)) throw new ArticleError(`\`\`\`widget ${src}: height must be a number of pixels`);
  return `${fig(replay)}
  <div class="embed embed--fit">
    <iframe src="${esc(src)}" title="${title}" loading="lazy" style="height: ${height || 320}px"${height ? "" : " data-autoheight"}></iframe>
  </div>${capHtml}
</figure>`;
}

// ```video path/to/clip.mp4 [controls] [once] [poster=still.png] [width=...]
//   By default a clip autoplays muted and loops, like a GIF.
//   controls       show the player's controls and don't autoplay (for clips with sound)
//   once           autoplay but don't loop
function renderVideo(info, body, ctx) {
  const { args, opts } = parseInfo(info);
  const src = args[0];
  if (!src) throw new ArticleError("```video needs a file, e.g. ```video mp4/team.mp4");
  const flags = args.slice(1).map((a) => a.toLowerCase());
  for (const f of flags) if (!["controls", "once"].includes(f))
    throw new ArticleError(`\`\`\`video ${src}: "${f}" isn't an option. Use controls, once or poster=file`);
  allow("video", opts, ["poster", "width"]);
  ctx.refs.add(src);
  if (opts.poster) ctx.refs.add(opts.poster);
  const capHtml = caption(body, ctx.marked);
  const label = esc(stripTags(capHtml) || src);
  const attrs = flags.includes("controls") ? "controls preload=\"metadata\"" : `autoplay muted playsinline${flags.includes("once") ? "" : " loop"}`;
  return `<figure${figureAttrs(opts.width, [], `\`\`\`video ${src}`)}>\n  <video src="${esc(src)}" ${attrs}${opts.poster ? ` poster="${esc(opts.poster)}"` : ""} aria-label="${label}"></video>${capHtml}\n</figure>`;
}

// ---------- figures from plain images ----------

function mediaFor(src, alt, dir) {
  const gif = src.match(/^(.*\/)?gifs\/([^/]+)\.gif$/i);
  if (gif) {
    const mp4 = `${gif[1] || ""}mp4/${gif[2]}.mp4`;
    if (fs.existsSync(path.join(dir, mp4))) src = mp4;
  }
  return /\.(mp4|webm|mov)$/i.test(src)
    ? { src, html: `<video src="${esc(src)}" autoplay loop muted playsinline aria-label="${esc(alt)}"></video>` }
    : { src, html: `<img src="${esc(src)}" alt="${esc(alt)}">` };
}

// ---------- render ----------

export function renderMarkdown(src, { dir }) {
  const { meta, body } = splitFrontMatter(src);
  const ctx = { dir, refs: new Set() };
  const marked = new Marked({ gfm: true });
  ctx.marked = marked;
  marked.use({
    renderer: {
      code(token) {
        const info = (token.lang || "").trim();
        const [kind, ...rest] = info.split(/\s+/);
        const restInfo = info.slice(kind.length).trim();
        try {
          if (kind === "widget") return renderWidget(restInfo, token.text, ctx) + "\n";
          if (kind === "video") return renderVideo(restInfo, token.text, ctx) + "\n";
          if (kind === "wide") return `<div class="wide">\n${marked.parse(token.text)}</div>\n`;
        } catch (e) {
          ctx.error ||= e; // rethrown after parsing, so the message isn't wrapped by the parser
          return "";
        }
        return false; // an ordinary code block
      },
      image(token) {
        return `<img src="${esc(token.href)}" alt="${esc(token.text)}"${token.title ? ` title="${esc(token.title)}"` : ""}>`;
      },
    },
  });

  let html = marked.parse(body);
  if (ctx.error) throw ctx.error;

  // A paragraph holding only an image, with optional {width=...} after it and an optional
  // italic "Fig." line under it, is a figure.
  html = html.replace(
    /<p><img src="([^"]*)" alt="([^"]*)"[^>]*>(?:\{([^}]*)\})?<\/p>(?:\s*<p><em>((?:Fig(?:ure)?\.?\s*\d+)[\s\S]*?)<\/em><\/p>)?/g,
    (all, rawSrc, alt, attrText, cap) => {
      const decoded = rawSrc.replace(/&amp;/g, "&").replace(/&quot;/g, '"');
      const where = `the image ${decoded}`;
      const { args, opts } = parseInfo((attrText || "").replace(/&quot;/g, '"').replace(/&#39;/g, "'"));
      if (args.length) throw new ArticleError(`${where}: {${attrText}} isn't understood. Write it as {width=60%}`);
      allow(where, opts, ["width"]);
      const media = mediaFor(decoded, alt.replace(/&amp;/g, "&").replace(/&quot;/g, '"'), dir);
      ctx.refs.add(media.src);
      return `<figure${figureAttrs(opts.width, [], where)}>\n  ${media.html}${cap ? `\n  <figcaption>${cap}</figcaption>` : ""}\n</figure>`;
    },
  );
  return { meta, html };
}
