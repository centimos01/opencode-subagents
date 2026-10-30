/**
 * Provide a fake `opencode` executable for the test suite.
 *
 * The CLI tests spawn real child processes, so they inherit `process.env.PATH`.
 * CI runners do not have OpenCode installed; without this stub the installer
 * exits early and `opencode reload` fails, making the suite depend on the
 * machine it runs on.
 */
import { afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const originalPath = process.env.PATH;
const stubDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-stub-'));

if (process.platform === 'win32') {
  fs.writeFileSync(
    path.join(stubDir, 'opencode.cmd'),
    '@echo off\r\nif "%~1"=="--version" echo 0.0.0-test\r\nexit /b 0\r\n',
    'utf8'
  );
} else {
  const bin = path.join(stubDir, 'opencode');
  fs.writeFileSync(
    bin,
    '#!/bin/sh\nif [ "$1" = "--version" ]; then\n  echo "0.0.0-test"\nfi\nexit 0\n',
    'utf8'
  );
  fs.chmodSync(bin, 0o755);
}

process.env.PATH = stubDir + path.delimiter + (process.env.PATH ?? '');

afterAll(() => {
  if (originalPath === undefined) {
    delete process.env.PATH;
  } else {
    process.env.PATH = originalPath;
  }
  fs.rmSync(stubDir, { recursive: true, force: true });
});
