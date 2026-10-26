# Blog

A small static blog whose articles live outside the repo. The repo holds the build, the
templates and the stylesheet; the articles are folders in `content/`, which git ignores, each
holding an `index.md` and whatever it shows. The build turns them into a static site in `dist/`
that any host will serve.

Needs Node 20 or later. Run `npm install` once, for the Markdown parser.

```
npm run dev                      # preview at http://localhost:4321, drafts and the example included
npm run new "Title of the post"  # start a draft in content/
npm run build                    # production build into dist/, no drafts, no example
npm run pull                     # fetch articles from a bucket or private repo (see below)
```

Claude Code knows how to run all of this: the skill in `.claude/skills/blog/` is picked up
automatically when you open the repo.

## Writing an article

An article is a folder in `content/`. The folder name is the URL
(`content/my-first-post/` → `/my-first-post/`), and to publish a
post you add the folder, with its pictures, clips and widgets beside the Markdown:

```
content/my-first-post/
  index.md
  images/board-dark.png
  mp4/answer.mp4
  animations/team.html
```

### The top of the file

```markdown
---
title: "My First Post: A Subtitle"
date: 2026-10-17
description: The line under the title, also used in the list and the feed.
author: Hakim Guessous     # optional, defaults to site.config.json
draft: true                # optional, keeps it out of npm run build
slug: first-post           # optional, overrides the folder name in the URL
tags: [agents, infrastructure]
---
```

Quote a value that contains a colon. Older drafts without this block also work: a `# Title`
line, then a date line such as `Oct 17, 2026 · @Hakim Guessous`, are read as the title and date.

### The body

Ordinary Markdown, GitHub flavour: `##` and `###` headings (the title is the only `#`), links,
lists, quotes, code blocks, tables and raw HTML where you need it.

**Figures.** An image on a line of its own becomes a figure, and an italic line starting
`Fig. N –` straight after it becomes the caption:

```markdown
![The canvas board in dark mode](images/board-dark.png)

*Fig. 1 – The canvas board, an illustrative data estate in dark mode*
```

**Sizing figures.** Figures fill the figure width (wider than the text) unless you give them
a width, in braces straight after the image, the syntax Pandoc and Quarto use:

```markdown
![A small diagram](images/diagram.png){width=60%}
```

| Width | What it does |
| --- | --- |
| `60%` | A share of the full figure width, centred. Full width on phones |
| `400px` | That wide (narrower when the screen is), centred |
| `text` | The same width as the text column |

`widget` and `video` blocks take the same values as an option, such as
`` ```widget widgets/calc.html width=text ``. In an HTML article, give the `<figure>`
`class="sized sized--share" style="--fig-width: 60%"`, `sized--px` with a pixel value, or
`sized--text`.

An image path ending `.mp4` or `.webm` becomes a silent looping clip. A `.gif` with a
same-named file in a sibling `mp4/` folder is swapped for the MP4, which is usually a tenth of
the size.

**Widgets.** An HTML page from the article's folder, shown in the article. The lines inside
the block are the caption.

````markdown
```widget animations/team.html 1280x720 replay
Fig. 3 – One assignment per agent, a dramatised slice of run 3
```
````

| Option | What it does |
| --- | --- |
| *(none)* | A responsive page, shown full width; the frame grows to fit its content |
| `1280x720` | A page drawn at a fixed size, scaled down to fit the figure |
| `height=400` | A fixed height in pixels, full width |
| `replay` | Adds a Replay button, for animations that play once |
| `inline` | Pastes the page (or an `.svg`) into the article instead of framing it, so it shares the article's fonts and colours |
| `title="..."` | The frame's accessible name (defaults to the caption) |
| `width=...` | Display width, as for images: `60%`, `400px` or `text` |

Framed widgets keep their own styles and scripts, so nothing in them can disturb the article.
Write them as normal standalone pages, with a transparent background if they should sit on the
figure's colour, and their own light and dark colours via `prefers-color-scheme`.

**Clips with options.**

````markdown
```video mp4/demo.mp4 controls poster=images/demo.png
Fig. 4 – A clip with sound, so it waits to be played
```
````

`controls` shows the player and doesn't autoplay; `once` autoplays without looping;
`poster=` sets the still shown before it plays; `width=` sizes it as for images.

**Wide content.** Markdown inside a `wide` block may run wider than the text column, like a
figure, which suits big tables.

````markdown
```wide
| Role | Typeface | Size |
| --- | --- | --: |
| Text | Newsreader | 20 px |
```
````

**References.** Everything from a `## References` heading down is set as a references block.
Group sources under bold lines naming the section that cites them.

### Checks

The build stops, naming the file and the problem, when an article points at a picture, clip
or widget that isn't in its folder, when a block has an option it doesn't know, or when a folder
holds both an `index.md` and an `index.html`. Markdown files other than `index.md` (notes, old
drafts) are never copied to the site.

### HTML articles

A folder with an `index.html` instead of an `index.md` works too, for anything too custom for
Markdown. The title and `<meta name="date|description|author|draft">` tags come from its head,
and everything inside `<article>` becomes the page.

## The look

The site uses one style, Damson: a deep oat paper with a plum accent, Bricolage Grotesque set
slightly narrow for titles and headings, and Newsreader for text. It has a light and a dark
version, which follow the reader's system setting.

Colours, sizes and fonts are CSS variables at the top of `src/assets/site.css`. The fonts load
from Google Fonts (the URL is at the top of `src/templates.mjs`). To self-host a face instead,
put its `.woff2` files in `src/assets/fonts/`, add an `@font-face` rule to `site.css`, put the
family first in `--font-body` or `--font-display`, and remove the Google Fonts link.

Every article has the site name and an "All writing" link at the top, and a "Back to all
writing" link at the end, all leading to the home page. The site still publishes an RSS feed at
`/feed.xml` for feed readers to find, without a link on the page.

## Keeping articles out of GitHub

`content/` is in `.gitignore`, so nothing in it is ever committed. Where the articles actually
live is up to you:

- **On your machine only.** Write in `content/`, run `npm run build`, upload `dist/` to any static
  host from your machine (Cloudflare Pages, Netlify, a bucket). Back the folder up separately.
- **Somewhere else on your machine.** `CONTENT_DIR=~/Writing/blog npm run dev` reads from any folder,
  such as one synced by Dropbox or iCloud.
- **In a bucket, deployed by GitHub.** Keep the articles in a private Cloud Storage bucket and let
  `.github/workflows/deploy.yml` pull them at build time and publish to GitHub Pages. The articles
  exist only inside the build job. The workflow's comments list the three variables to set.
- **In a separate private repo.** `CONTENT_SOURCE=git@github.com:you/articles.git npm run pull`.
  This keeps them on GitHub, but out of this repo.

`npm run pull` understands `gs://`, `s3://`, git URLs and local paths.

## Layout of the repo

```
site.config.json      title, description, author, URL
src/templates.mjs     the page templates
src/markdown.mjs      Markdown and the widget, video and wide blocks
src/assets/           site.css, site.js, copied into every build
scripts/build.mjs     the build
scripts/dev.mjs       local preview with live reload
scripts/new.mjs       starts a draft
scripts/pull.mjs      fetches articles for a build
examples/             one committed example article, shown in dev only
.claude/skills/blog/  how Claude Code operates the blog
content/              your articles (ignored by git)
```
