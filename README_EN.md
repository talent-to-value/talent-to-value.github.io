# How to Turn Your Talent into Income

[简体中文](README.md) | **English**

A hands-on, four-week interactive guide with 28 progressive exercises. It helps you turn vague skills and experience into a service or product that people can understand, trust, and buy.

**Try it online:** [https://talent-to-value.github.io](https://talent-to-value.github.io)

**Repository:** [github.com/talent-to-value/talent-to-value.github.io](https://github.com/talent-to-value/talent-to-value.github.io)

This is an independent interactive adaptation by 雨眠 based on the methods in the book. It is not an official product of the author.

## The four-week journey

| Week | Exercises | Focus | Outcome |
| --- | --- | --- | --- |
| Week 1 | 1.1–1.7 | Clarify who you are, whom you help, and why your work matters | A service description tested through real-world feedback |
| Week 2 | 2.1–2.5 | Organize evidence, stories, and representative work | A “Why you can trust me” page |
| Week 3 | 3.1–3.7 | Build a connection with your audience | Five pieces of content that communicate your value |
| Week 4 | 4.1–4.9 | Create a clear way to buy | A minimum viable offer that can be delivered, priced, and purchased |

## Features

- Guided exercises organized by week and step
- Reuses relevant answers from earlier exercises
- Automatically saves progress in the current browser
- Keeps recent local snapshots
- Exports all progress as a JSON backup file
- Imports a backup on the same device or another device
- Responsive layouts for desktop and mobile

## Data storage and privacy

No account is required, and your answers are not uploaded to a server.

Progress is stored primarily in IndexedDB in your current browser, with a compatibility copy in `localStorage`. When there is content to save, the tool creates an automatic snapshot at most once every five minutes and keeps the 10 most recent snapshots.

Please note:

- Progress does not sync automatically across devices or browsers.
- Data in a private or incognito window is usually deleted when that window is closed.
- Before clearing browser data, switching devices, or uninstalling your browser, use “Backup & Restore” to download a JSON backup.
- Importing a backup replaces the progress currently stored in the page, so verify the file before continuing.

## Development and deployment

The project uses Next.js 16, React 19, TypeScript, Vinext, and Vite, and is statically hosted on GitHub Pages. Local development requires Node.js 22.13.0 or later.

```bash
npm ci
npm run dev
```

Useful checks:

```bash
npm run lint
npm run build:pages
```

`npm run build:pages` creates the static site in `out/`. The `main` branch contains the source, while `gh-pages` contains the deployed site. There is currently no automated deployment workflow; publishing requires syncing `out/` to the root of `gh-pages` and preserving `.nojekyll`.

## Project structure

```text
app/
  curriculum.ts       Four-week curriculum and exercise configuration
  local-progress.ts   Local saving, snapshots, backup, and restore
  page.tsx            Main UI and interactions
  globals.css         Global styles and responsive layouts
  layout.tsx          Site metadata
public/
  fonts/              Self-hosted fonts
  favicon.png         Site icon
  og.png              Social sharing image
```

## Source and credits

- Content reference: [《把才华变成钱》](https://haoshiyinli.com/book)
- Author: 王梦珂 Mengke
- Interactive adaptation: 雨眠
- WeChat Official Account: Yan yard

This repository currently does not include an open-source license. Please obtain permission from the relevant rights holders before reproducing or reusing the book content, tool copy, or project code.
