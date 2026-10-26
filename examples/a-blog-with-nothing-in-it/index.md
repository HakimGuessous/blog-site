---
title: A Blog With Nothing in It
date: 2026-10-26
description: Why the words on this site live somewhere GitHub has never heard of, and what the build does with them.
author: Hakim Guessous
tags: [meta]
---

## Nothing to See Here

Most blogs keep their words and their code in the same repository, which is tidy right up until you'd rather the drafts, the half-finished posts and the one about your manager weren't sitting in public commit history for ever. This one keeps them apart. The repository holds the engine, a few templates and the stylesheet, and the articles live in a folder git has been [told to ignore](https://git-scm.com/docs/gitignore), so the code can be public while the writing stays wherever I keep it, a bucket, a laptop or a private repo of its own.

The build is small enough to read in one sitting, a Node script with a single dependency that reads every article, wraps it in a page and writes out a static site that any host will serve. A blog is the kind of project you leave alone for a year, and I'd rather it still built when I came back.

```widget diagram.svg inline
Fig. 1 – Where everything lives, and the one place the two meet
```

## Where the Words Live

An article is a folder with an `index.md` in it, plus whatever it shows. The title, date and summary sit in a few lines at the top, everything below is ordinary Markdown, and images, clips and widgets go in the same folder and travel with it, so a post with thirteen figures is still one folder you can zip up and send to someone.

```
content/
  my-first-post/
    index.md
    images/board-dark.png
    mp4/answer.mp4
    animations/team.html
```

A figure is an image on a line of its own, with an italic caption under it, which is how I was writing them anyway. Anything the Markdown can't say gets a fenced block of its own, so a widget is three lines.

~~~markdown
```widget animations/team.html 1280x720 replay
Fig. 3 – One assignment per agent, a dramatised slice of run 3
```
~~~

Marking a post as a draft keeps it off the published site but not out of the local preview, which is where I'd expect most drafts to spend most of their lives. If a post mentions a file that isn't in its folder, the build stops and names it, which is a better time to find out than after publishing.

## Things That Move

Widgets are ordinary HTML pages shown in a frame, so their styles and scripts can't trip over the article's. A page drawn at a fixed size, like the animations in my last post, is scaled to fit, and one that flows, like this one, grows to the height of whatever is in it. Any figure can also be given a width, which suits this one better than the full width would.

```widget widgets/reading-time.html width=text
Fig. 2 – The build's own arithmetic, for anyone wondering where "11 min read" comes from
```

## The Shape of a Page

The look is a matter of taste, and I tried seven on a real article before settling on this one, a deep oat paper with a plum accent. The layout is a column narrow enough to read at around 65 characters a line and figures allowed to run wider than the text, because a screen recording squeezed into a column of prose helps nobody.

> Typography exists to honor content.

That's Robert Bringhurst in [The Elements of Typographic Style](https://en.wikipedia.org/wiki/The_Elements_of_Typographic_Style), American spelling and all, and it's the closest thing the design has to a brief. Captions follow one rule, a figure number and a short line, with any explanation left to the text where it belongs. References go at the end, grouped by the section that cites them, a habit I picked up from papers and haven't managed to shake.

## The Bits I Rarely Use

For completeness, here's how the rest looks, though I'd be surprised to see much of it in a post of mine.

### Lists and tables

- An unordered list, for when prose would be cruel
- A second item, to prove it's a list
- A third, because apparently these come in threes

```wide
| Role | Typeface | Size |
| --- | --- | --: |
| Titles and headings | Bricolage Grotesque, set narrow | 24–56 px |
| Text | Newsreader | 20 px |
| Captions and bylines | Bricolage Grotesque | 14 px |
```

There's also a dark version, which follows the reader's system setting and which I suspect most people reading at midnight will never notice was designed at all.

## References

**Nothing to See Here**

- [gitignore documentation](https://git-scm.com/docs/gitignore) (Git)

**The Shape of a Page**

- [The Elements of Typographic Style](https://en.wikipedia.org/wiki/The_Elements_of_Typographic_Style) (Wikipedia)
