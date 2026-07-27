'use strict';

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Tools the headless CLI process has no legitimate reason to touch for a pure
// text-generation task. Blocked defensively so a crafted title/keyword field
// can't turn a content-generation call into a code-execution or file-write path.
const DISALLOWED_TOOLS = [
  'Bash',
  'Edit',
  'Write',
  'NotebookEdit',
  'WebFetch',
  'WebSearch',
  'Skill',
  'Task',
  'Artifact',
  'SendUserFile',
  'SendMessage',
  'PushNotification',
  'ScheduleWakeup',
  'EnterWorktree',
  'ExitWorktree',
  'DesignSync'
].join(',');

const CLI_TIMEOUT_MS = Number(process.env.CLI_GENERATION_TIMEOUT_MS || 180000);

/**
 * Runs `claude -p` headlessly to generate content using the caller's existing
 * Claude Code / Claude.ai subscription login instead of a billed API key.
 * Returns the full generated text (no token-level streaming is available from
 * the CLI's print mode — it returns the complete response in one shot).
 */
function generateWithCli({ system, user, model }) {
  return new Promise((resolve, reject) => {
    const tmpFile = path.join(
      os.tmpdir(),
      `sop-system-prompt-${crypto.randomBytes(8).toString('hex')}.txt`
    );

    let settled = false;
    const cleanup = () => {
      fs.unlink(tmpFile, () => {});
    };

    fs.writeFile(tmpFile, system, (writeErr) => {
      if (writeErr) {
        reject(new Error(`Failed to write temp system prompt file: ${writeErr.message}`));
        return;
      }

      const args = [
        '-p',
        '--system-prompt-file',
        tmpFile,
        '--output-format',
        'json',
        '--model',
        model,
        `--disallowedTools=${DISALLOWED_TOOLS}`,
        user
      ];

      const child = spawn('claude', args, {
        cwd: os.tmpdir(), // neutral cwd so no project CLAUDE.md/skills leak into context
        shell: process.platform === 'win32',
        windowsHide: true
      });

      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          child.kill();
          cleanup();
          reject(new Error('Generation timed out. Try again, or check that "claude" is logged in.'));
        }
      }, CLI_TIMEOUT_MS);

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();
        if (err.code === 'ENOENT') {
          reject(
            new Error(
              'The "claude" command was not found. Install it with ' +
                '"npm install -g @anthropic-ai/claude-code" and run "claude" once to log in, ' +
                'or switch GENERATION_MODE to "api" in your .env file.'
            )
          );
        } else {
          reject(err);
        }
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        cleanup();

        if (code !== 0) {
          reject(new Error(`claude CLI exited with code ${code}. ${stderr.trim() || stdout.trim()}`.trim()));
          return;
        }

        let parsed;
        try {
          parsed = JSON.parse(stdout);
        } catch (parseErr) {
          reject(new Error(`Could not parse CLI output as JSON: ${stdout.slice(0, 500)}`));
          return;
        }

        if (parsed.is_error) {
          reject(new Error(parsed.result || 'The claude CLI reported an error.'));
          return;
        }

        if (typeof parsed.result !== 'string' || !parsed.result.trim()) {
          reject(new Error('The claude CLI returned an empty response.'));
          return;
        }

        resolve(parsed.result);
      });
    });
  });
}

module.exports = { generateWithCli };
