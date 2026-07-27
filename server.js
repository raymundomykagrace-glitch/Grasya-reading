'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { buildPrompt, SOP_BLUEPRINTS, AUDIENCE_GUIDANCE } = require('./prompts');
const { generateWithCli } = require('./cliGenerator');

const PORT = process.env.PORT || 3000;
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const CLI_MODEL = process.env.CLAUDE_CLI_MODEL || 'sonnet';
const MAX_TOKENS = 8000;

// "api"  -> calls the Anthropic Messages API directly with ANTHROPIC_API_KEY (billed per token)
// "cli"  -> shells out to the `claude` CLI, using an existing Claude Code / Claude.ai
//           subscription login instead of a separate billed API key
const GENERATION_MODE = (process.env.GENERATION_MODE || 'api').trim().toLowerCase();

let anthropic = null;
if (GENERATION_MODE === 'api') {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.warn(
      '[WARN] GENERATION_MODE=api but ANTHROPIC_API_KEY is not set. Copy .env.example to .env ' +
      'and add your key, or set GENERATION_MODE=cli to use a Claude Code subscription login instead.'
    );
  }
  // Lazy require so `cli` mode doesn't need this dependency configured at all.
  const Anthropic = require('@anthropic-ai/sdk');
  anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
} else if (GENERATION_MODE !== 'cli') {
  console.warn(`[WARN] Unknown GENERATION_MODE "${GENERATION_MODE}". Falling back to "api".`);
}

const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '*').split(',').map((o) => o.trim());
app.use(
  cors({
    origin: allowedOrigins.includes('*') ? true : allowedOrigins
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.static('.'));

function validateBody(body) {
  const errors = [];
  const { title, primaryKeywords, sopType, audience } = body || {};

  if (!title || !String(title).trim()) errors.push('title is required.');
  if (!primaryKeywords || !String(primaryKeywords).trim()) errors.push('primaryKeywords is required.');
  if (!sopType || !SOP_BLUEPRINTS[sopType]) {
    errors.push(`sopType must be one of: ${Object.keys(SOP_BLUEPRINTS).join(', ')}`);
  }
  if (!audience || !AUDIENCE_GUIDANCE[audience]) {
    errors.push(`audience must be one of: ${Object.keys(AUDIENCE_GUIDANCE).join(', ')}`);
  }

  return errors;
}

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    generationMode: GENERATION_MODE === 'cli' ? 'cli' : 'api',
    model: GENERATION_MODE === 'cli' ? CLI_MODEL : MODEL,
    hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY)
  });
});

app.get('/sop-types', (req, res) => {
  res.json({
    sopTypes: Object.entries(SOP_BLUEPRINTS).map(([value, info]) => ({
      value,
      label: info.label,
      wordCount: info.wordCount
    })),
    audiences: Object.entries(AUDIENCE_GUIDANCE).map(([value, info]) => ({
      value,
      label: info.label
    }))
  });
});

/**
 * In "api" mode, streams raw generated text to the client as it arrives from
 * the Messages API. The stream is plain chunked text (not SSE) so a simple
 * fetch + ReadableStream reader on the frontend can render it live.
 *
 * In "cli" mode, the `claude` CLI's print mode only returns a complete
 * response (no token-level streaming is available), so the full text is
 * written to the response in one chunk once generation finishes.
 *
 * Either way, the response body ends with a "===SCHEMA_JSON===" marker
 * followed by a JSON object the frontend parses out after the stream ends.
 */
app.post('/generate-content', async (req, res) => {
  const errors = validateBody(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Invalid request.', details: errors });
  }

  if (GENERATION_MODE === 'api' && !process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'Server is missing ANTHROPIC_API_KEY. Add it to your .env file, or set ' +
        'GENERATION_MODE=cli in .env to use a Claude Code subscription login instead.'
    });
  }

  let system, user;
  try {
    ({ system, user } = buildPrompt(req.body));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  res.writeHead(200, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'X-Accel-Buffering': 'no'
  });

  let closed = false;
  req.on('close', () => {
    closed = true;
  });

  if (GENERATION_MODE === 'cli') {
    try {
      const text = await generateWithCli({ system, user, model: CLI_MODEL });
      if (!closed) res.write(text);
    } catch (err) {
      console.error('CLI generation failed:', err);
      if (!closed) res.write(`\n\n===ERROR===\n${err.message || 'Content generation failed.'}`);
    } finally {
      if (!closed) res.end();
    }
    return;
  }

  // GENERATION_MODE === 'api'
  let stream;
  try {
    stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: user }]
    });
  } catch (err) {
    console.error('Failed to start Claude stream:', err);
    res.write(`\n\n===ERROR===\n${err.message || 'Failed to start generation.'}`);
    return res.end();
  }

  stream.on('text', (textChunk) => {
    if (!closed) res.write(textChunk);
  });

  stream.on('error', (err) => {
    console.error('Claude stream error:', err);
    if (!closed) {
      const message =
        err?.status === 401
          ? 'Authentication with Claude API failed. Check your ANTHROPIC_API_KEY.'
          : err?.status === 429
          ? 'Claude API rate limit reached. Please wait and try again.'
          : err?.message || 'Content generation failed.';
      res.write(`\n\n===ERROR===\n${message}`);
      res.end();
    }
  });

  try {
    await stream.finalMessage();
  } catch (err) {
    console.error('Claude generation failed:', err);
    if (!closed) {
      res.write(`\n\n===ERROR===\n${err.message || 'Content generation failed.'}`);
    }
  } finally {
    if (!closed) res.end();
  }
});

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error('Unhandled error:', err);
  if (res.headersSent) {
    res.end();
  } else {
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.listen(PORT, () => {
  console.log(`SOP Content Generator listening on http://localhost:${PORT}`);
  console.log(`Generation mode: ${GENERATION_MODE === 'cli' ? 'cli (Claude Code subscription)' : 'api (ANTHROPIC_API_KEY)'}`);
  console.log(`Using model: ${GENERATION_MODE === 'cli' ? CLI_MODEL : MODEL}`);
});
