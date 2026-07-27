'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { buildPrompt, SOP_BLUEPRINTS, AUDIENCE_GUIDANCE } = require('./prompts');

const PORT = process.env.PORT || 3000;
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const MAX_TOKENS = 8000;

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn(
    '[WARN] ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key, ' +
    'or every /generate-content request will fail.'
  );
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

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
  res.json({ status: 'ok', model: MODEL, hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY) });
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
 * Streams raw generated text to the client as it arrives from Claude.
 * The stream is plain chunked text (not SSE) so a simple fetch + ReadableStream
 * reader on the frontend can render it live. The final chunk of the stream
 * contains a "===SCHEMA_JSON===" marker followed by a JSON object the
 * frontend parses out after the stream ends.
 */
app.post('/generate-content', async (req, res) => {
  const errors = validateBody(req.body);
  if (errors.length) {
    return res.status(400).json({ error: 'Invalid request.', details: errors });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'Server is missing ANTHROPIC_API_KEY. Add it to your .env file and restart the server.'
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

  let closed = false;
  req.on('close', () => {
    closed = true;
  });

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
  console.log(`Using model: ${MODEL}`);
});
