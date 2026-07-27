# SOP Content Generator

A Node.js + Express backend and single-file HTML frontend that generates SOP-compliant
treatment center web content using Claude — complete with FAQ, Organization, and
BreadcrumbList schema (JSON-LD).

The five SOP types (Addiction/SUD, Mental Health condition pages, Levels-of-Care, Program
Modality, and Therapy Modality) each use their own section architecture and word-count target,
based on a real content SOP reference, so generated pages follow the right structure for the
type of page you're building — not one generic template stretched across every topic.

## Features

- **Backend**: Express server with a single `POST /generate-content` endpoint that streams
  Claude's output to the browser as it's generated.
- **Frontend**: One `index.html` file (no build step) with the light blue / teal theme, live
  streaming preview, rendered content, copyable schema cards, and Markdown/HTML export.
- Grade 6 readability enforcement (16–20 word sentences, 3–4 sentence paragraphs, plain
  language) baked into the prompt.
- Keyword weaving for both primary and secondary keywords.
- No fabricated statistics, citations, facility names, phone numbers, or addresses — the
  Organization schema uses clearly labeled placeholders (`[Organization Name]`, `[Phone
  Number]`, etc.) for you to fill in with real business details.

## Requirements

- Node.js 18 or later
- An [Anthropic API key](https://console.anthropic.com/)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and add your API key:

   ```bash
   cp .env.example .env
   ```

   Edit `.env`:

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   CLAUDE_MODEL=claude-sonnet-4-6
   PORT=3000
   ALLOWED_ORIGINS=*
   ```

   > **Model name note:** `CLAUDE_MODEL` defaults to `claude-sonnet-4-6`. Model ids change
   > over time — if generation fails with a "model not found" error, check the current model
   > id in your Anthropic console/docs and update `CLAUDE_MODEL` accordingly.

3. Start the server:

   ```bash
   npm start
   ```

4. Open your browser to [http://localhost:3000](http://localhost:3000). The Express server
   also serves `index.html` as a static file, so the frontend and backend run from the same
   origin — no separate frontend server needed.

   (You can also just open `index.html` directly from disk in a browser; it calls
   `window.location.origin`, so if you do that, run the API on the same origin or update
   `API_BASE` in the `<script>` block, and set `ALLOWED_ORIGINS` in `.env` to match.)

## Using the tool

1. Fill in **Page Title** and **Primary Keywords** (required).
2. Optionally add a **Page URL** (used to build the Breadcrumb schema) and **Secondary
   Keywords**.
3. Choose a **SOP Type**:
   - **Addiction / SUD** — substance-specific education → risk factors → treatment → CTA
   - **Mental Health (Condition-Specific)** — condition definition → symptoms → diagnosis →
     treatment → co-occurring disorders
   - **Levels-of-Care** — one specific level of care (detox, residential, PHP, IOP, outpatient,
     telehealth), who it's for, and how it compares to other levels
   - **Program Modality** — a specific program or track (12-Step, aftercare, faith-based,
     trauma-focused, etc.)
   - **Therapy Modality** — a specific evidence-based therapy (CBT, DBT, EMDR, family therapy,
     etc.), how it works, and what it treats
4. Choose an **Audience** mode (Research-mode, Decision-mode, or Action-mode) — this changes
   how much the content leans into education vs. calls to action.
5. Click **Generate Content**. You'll see the content stream in live as Claude writes it, then
   the final formatted version with a word count, plus the three schema cards.
6. Use **Copy Content**, **Download Markdown**, or **Download HTML** to export. The HTML export
   embeds all three schemas as `<script type="application/ld+json">` tags, ready to drop into a
   real page.

## API

### `POST /generate-content`

**Body (JSON):**

```json
{
  "title": "Xanax Addiction Treatment",
  "pageUrl": "https://example.com/xanax-addiction-treatment",
  "primaryKeywords": "xanax addiction, xanax addiction treatment",
  "secondaryKeywords": "benzodiazepine dependence, xanax withdrawal",
  "sopType": "Addiction",
  "audience": "Decision-mode"
}
```

`sopType` must be one of: `Addiction`, `Mental Health`, `Levels-of-Care`, `Program`, `Therapy`.
`audience` must be one of: `Research-mode`, `Decision-mode`, `Action-mode`.
`title`, `primaryKeywords`, `sopType`, and `audience` are required; `pageUrl` and
`secondaryKeywords` are optional.

**Response:** `200 OK` with `Content-Type: text/plain`, streamed in chunks as Claude generates
it. The stream body is:

```
# Page H1
Meta Title: ...
Meta Description: ...

## Section heading
... content ...

## Frequently Asked Questions
**Question?**
Answer.

===SCHEMA_JSON===
{"metaTitle": "...", "metaDescription": "...", "faqSchema": {...}, "organizationSchema": {...}, "breadcrumbSchema": {...}}
```

Split the response on the `===SCHEMA_JSON===` marker: everything before it is Markdown
content, everything after it is a single JSON object with the three schemas plus the meta
title/description.

If generation fails partway through, the stream includes an `===ERROR===` marker followed by a
human-readable message instead of (or in addition to) the schema JSON.

**Error responses** (before streaming starts): `400` for missing/invalid fields, `500` if
`ANTHROPIC_API_KEY` isn't configured or the Claude API call fails outright — both return JSON:
`{ "error": "..." }`.

### `GET /sop-types`

Returns the available `sopType` and `audience` values with their labels, useful if you want to
build the dropdowns dynamically instead of hardcoding them.

### `GET /health`

Returns `{ "status": "ok", "model": "...", "hasApiKey": true|false }` for a quick sanity check.

## Project structure

```
.
├── server.js          # Express app + /generate-content streaming endpoint
├── prompts.js          # SOP blueprints and Claude prompt construction
├── index.html          # Single-file frontend (HTML + CSS + JS)
├── package.json
├── .env.example
└── README.md
```

## Notes on content accuracy

This tool generates original marketing/education copy, not verified medical or clinical
content. It intentionally avoids inventing statistics, studies, facility details, or
credentials. Before publishing generated pages, have a qualified reviewer check clinical
claims and fill in the placeholder Organization schema fields (`[Organization Name]`,
`[Phone Number]`, address) with your real business information.
