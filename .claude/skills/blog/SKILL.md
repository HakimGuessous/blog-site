---
name: blog
description: Operate this blog. Use when adding, converting, editing or checking an article (a folder in content/ with an index.md and its media), embedding an HTML widget, animation, clip or wide table in a post, previewing the site, or building and deploying it.
---

# Operating the blog

This repo is a static blog. The code is committed; the articles are not. Each article is a
folder in `content/` (git-ignored) holding an `index.md` plus the pictures, clips and widget
pages it shows. `scripts/build.mjs` turns every folder into a page and writes the site to
`dist/`. The full syntax is in `README.md` under "Writing an article"; this file is how to work
with it.

## Ground rules

- **Never commit anything from `content/`**, never `git add -f` it, and never move an article
  into a tracked folder. Keeping articles out of GitHub is the point of the design. The only
  committed article is the example in `examples/`.
- **The prose is the author's.** Fix typos, broken Markdown and the conventions below, but don't
  rewrite sentences, change headings or "improve" the voice unless asked. When asked to edit
  for style, keep his habits (British spelling, long sentences joined with commas, dry asides
  at the end of a sentence, hedged first-person opinions) rather than replacing them with yours.
- **Don't edit `dist/` or `.dev/`.** They're rebuilt from scratch every time.
- Keep the build dependency-light. `marked` is the only dependency; ask before adding another.

## Commands

```
npm install                          # once, for marked
npm run dev                          # http://localhost:4321, drafts and the example included, live reload
npm run new "Title"                  # content/<slug>/index.md as a draft, with front matter filled in
npm run build                        # dist/, no drafts, no example (what gets deployed)
npm run build -- --drafts --examples # the same, plus drafts and the example: use this to check work
CONTENT_DIR=/path npm run dev        # articles from another folder
CONTENT_SOURCE=gs://bucket/articles npm run pull   # fetch articles (gs://, s3://, git URL or local path)
```

`npm run dev` keeps running; start it in the background, or use the build command to check.

## An article, at a glance

~~~~markdown
---
title: "My First Post: A Subtitle"          # quote values containing a colon
date: 2026-10-17                            # YYYY-MM-DD
description: One or two sentences under the title, also used in the list and the feed.
draft: true                                 # remove, or set false, to publish
---

## Introduction

Ordinary GitHub-flavoured Markdown. ## and ### headings only; the title is the only #.

![Alt text describing the picture](images/board-dark.png)

*Fig. 1 – A caption of fifteen words or fewer*

![A small diagram](images/flow.png){width=text}

*Fig. 2 – A diagram sized to the text column*

```widget animations/team.html 1280x720 replay
Fig. 3 – A fixed-size animation, scaled to fit, with a Replay button
```

```widget widgets/calculator.html
Fig. 4 – A responsive page, with a frame that grows to fit it
```

```video mp4/demo.mp4 controls
Fig. 5 – A clip with sound
```

## References

**Introduction**

- [Source title](https://example.com) (Publisher, Mon YYYY)
~~~~

Block options, all checked by the build:

- An image: `![alt](file){width=60% | width=400px | width=text}`. The braces are optional;
  without them a figure fills the figure width, which is wider than the text. Use `text` for
  diagrams and small images that look blown up at full width.
- `widget <file> [WxH | height=N] [inline] [replay] [title="..."] [width=...]`. No size means responsive.
  `inline` pastes an HTML or SVG file into the page instead of framing it.
- `video <file> [controls] [once] [poster=<file>] [width=...]`. By default clips autoplay muted and loop.
- `wide` takes Markdown as its body and lets it run wider than the text column.

Old drafts that start `# Title` then a date line (`Oct 17, 2026 · @Name`) are read without
front matter. Converting them to front matter is still better, since it holds the description.

## Converting a draft into an article

1. Create `content/<slug>/` (lower-case, hyphens) and put the draft there as `index.md`.
2. Add front matter: title, date, a one- or two-sentence `description` (ask the author for it,
   or draft one in his voice and say so), and `draft: true` until he says to publish.
3. Copy in every file the draft refers to, keeping the relative paths it uses. Prefer MP4 over
   GIF for clips: point the image at `mp4/<name>.mp4`, or keep `gifs/<name>.gif` with the MP4 in
   a sibling `mp4/` folder and the build swaps it.
4. For an animation or interactive figure that exists as an HTML page, use a `widget` block
   instead of a recording of it. Pages drawn at a fixed size (look for `width: 1280px; height:
   720px` on `html, body`) take that size as `WxH`; ones that play once take `replay`.
5. Run the checks below.

## Writing a widget

A widget is a standalone HTML page in the article's folder, shown in an iframe, so its CSS and
scripts can't affect the article.

- Keep it self-contained: inline CSS and JS, assets referenced relative to the widget file.
  External scripts are fine on the real site, but keep them to well-known CDNs.
- Give `body` a transparent background so it sits on the figure's colour, and set its own
  light and dark colours with `@media (prefers-color-scheme: dark)`. The site's palette is at
  the top of `src/assets/site.css` (oat `#F2ECE3`, ink `#211B19`, plum `#7A2D4B`; dark: `#1E1A1B`,
  `#EFE7E2`, `#E59EBA`).
- A responsive widget must let `body` take its natural height (no `height: 100%` or `100vh`
  on `html`/`body`), because the frame sizes itself to the body.
- A fixed-size widget sets `html, body { width: Wpx; height: Hpx; overflow: hidden }` and is
  embedded with `WxH`.
- Use `inline` only for small, static things (an SVG diagram) that should share the article's
  fonts and colours. An inline SVG can use the site's CSS variables (`var(--ink)`, `var(--accent)`,
  `var(--surface)`), so it follows dark mode.

## Conventions the author uses

- Captions are `Fig. N – ` (an en dash) plus a short line, numbered in order through the post.
  Explanations belong in the text, not the caption.
- References go last under `## References`, grouped under bold lines that name the section
  citing them, each entry `[Title](url) (Publisher, Mon YYYY)`. Link each source in the text
  where it's first mentioned, on short link text.
- British spelling. No colons, semicolons or bracketed asides in the body text.

## Checks before saying a post is done

1. `npm run build -- --drafts --examples` succeeds. It fails, naming the file, when the post
   points at a missing file, a block has an unknown option, or a folder holds both
   `index.md` and `index.html`. Fix the cause rather than working around the check.
2. Figure numbers run 1, 2, 3 with no gaps or repeats:
   `grep -o 'Fig\. [0-9]*' content/<slug>/index.md`
3. Every `## Section` that cites a source has a matching bold group under References.
4. If you can, open the page (`npm run dev`, or serve `dist/`) and look at each widget at
   desktop and phone width, in light and dark. Headless browsers set `navigator.webdriver`,
   which stops animations that check it from autoplaying; that's expected.
5. Leave `draft: true` in place unless the author asked to publish.

## Deploying

Articles live in a separate private repo, not here. `CONTENT_DIR=<path to it> npm run deploy`
builds the site without drafts and publishes `dist/` to Firebase Hosting (project in
`.firebaserc`, settings in `firebase.json`), using the author's own Firebase login. Confirm with
the author before deploying, since it publishes their writing.

## Where things live

- `src/markdown.mjs` front matter, Markdown, figures and the `widget`, `video` and `wide` blocks
- `scripts/build.mjs` reading articles, the file checks, HTML touches, writing pages
- `src/templates.mjs` page HTML and the Google Fonts link
- `src/assets/site.css` Damson style; colours and fonts are variables at the top
- `src/assets/site.js` reduced-motion handling, widget scaling and auto-height, Replay buttons
- `site.config.json` title, description, author, URL
