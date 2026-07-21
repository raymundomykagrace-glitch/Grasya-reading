# Grasya Reading

A storybook-style reader that runs entirely in your browser. Upload any file — or paste a link to an article — and read it page by page, with your place automatically saved and bookmarks you can jump back to whenever you return.

## Features

- **Upload almost anything**: `.txt`, Markdown, HTML, PDF, EPUB, DOCX, and images. Each one is converted into the same paged, book-like reading view.
- **Paste a link**: drop in a web article URL and it's fetched and cleaned up into a readable page, saved to your shelf like any other book. Paste a Wattpad story or chapter link and it goes further — it follows the story's table of contents and imports every chapter in order, so you read the whole thing chapter-by-chapter in your own reader (with your own bookmarks), not Wattpad's page.
- **Storybook reader**: page-flip navigation (buttons, arrow keys, or swipe on mobile), adjustable text size, and light/sepia/dark themes.
- **Bookmarks that survive closing the app**: your last reading position is saved automatically, and you can drop named bookmarks anywhere to jump back to later — all stored locally in your browser (IndexedDB), so it's all still there after you close the tab or restart the browser.

## Running it

This is a static site with no build step or backend. Just open `index.html` in a browser, or serve the folder with any static file server, e.g.:

```
npx serve .
```

## Deploying to Netlify

No build step is needed — `netlify.toml` already points Netlify at the repo root.

- **Connect the repo (recommended)**: In Netlify, "Add new site" → "Import an existing project" → pick this repo. Leave the build command blank and the publish directory as `.` (already set in `netlify.toml`). Deploy. Every push to this branch/main will auto-redeploy.
- **Drag-and-drop**: On [app.netlify.com/drop](https://app.netlify.com/drop), drag the whole project folder (containing `index.html`, `css/`, `js/`) onto the page for an instant one-off deploy.

Note that IndexedDB storage (books, reading position, bookmarks) is scoped per browser + origin, so once it's live on your Netlify URL, that's what people should bookmark/return to for their saved books to persist.

## How it works

- `js/parsers.js` turns each file type (or fetched article) into a common shape: either a list of reflowable chapters (text/HTML/EPUB/DOCX/Markdown) or a list of fixed pages (PDF/images).
- `js/paginator.js` paginates reflowable chapters into screen-sized pages using CSS multi-column layout, the same trick used by many in-browser e-readers.
- `js/db.js` persists uploaded files, reading position, and bookmarks in IndexedDB.
- `js/library.js` / `js/reader.js` / `js/app.js` wire up the shelf and reader UI.

Uploaded files and extracted articles are cached locally in your browser and never leave your device, except for the one-time fetch used to pull in a pasted link.

Wattpad import works by detecting the site from the URL, fetching its table of contents, then fetching each chapter in turn (with a short pause between requests) and stitching them into one multi-chapter book. It's best-effort: very long stories are capped at 400 chapters, and if a single chapter fails to load it's replaced with a small notice rather than aborting the whole import.
