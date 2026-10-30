/**
 * Utility functions for the OpenCode Subagents system
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import {
  sanitizeName,
  samePath,
  quote,
  cleanupCommand,
  stripJsonc,
} from './utils-core.js';

const __filename = fileURLToPath(import.meta.url);

export const HOME_DIR = os.homedir();
export const GLOBAL_CONFIG_DIR = path.join(HOME_DIR, '.config', 'opencode');
export const GLOBAL_AGENTS_DIR = path.join(GLOBAL_CONFIG_DIR, 'agents');
export const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'opencode.jsonc');
export const SCRIPT_PATH = __filename;

export { sanitizeName, samePath, quote, cleanupCommand, stripJsonc };

export function tryParseJsoncFile(filePath: string): { ok: boolean; json?: unknown } {
  if (!fs.existsSync(filePath)) return { ok: false };
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return { ok: true, json: JSON.parse(raw) };
  } catch {
    try {
      return { ok: true, json: JSON.parse(stripJsonc(raw)) };
    } catch {
      return { ok: false };
    }
  }
}

export function cleanConfigEntries(configFiles: string[], name: string): string[] {
  const cleaned: string[] = [];
  const seen = new Set<string>();

  for (const configFile of configFiles) {
    const resolved = path.resolve(configFile);
    if (seen.has(resolved) || !fs.existsSync(resolved)) continue;
    seen.add(resolved);

    const parsed = tryParseJsoncFile(resolved);
    if (!parsed.ok || !parsed.json || typeof parsed.json !== 'object') continue;

    const json = parsed.json as Record<string, unknown>;
    const agents = json['agents'];
    if (!agents || typeof agents !== 'object' || !Object.prototype.hasOwnProperty.call(agents, name)) {
      continue;
    }

    delete (agents as Record<string, unknown>)[name];
    if (Object.keys(agents).length === 0) {
      delete json['agents'];
    }

    fs.writeFileSync(resolved, JSON.stringify(parsed.json, null, 2) + '\n', 'utf8');
    cleaned.push(resolved);
  }
  return cleaned;
}

export function pruneEmptyDirs(targetDir: string): string[] {
  const pruned: string[] = [];

  const removeIfEmpty = (dir: string) => {
    try {
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
        fs.rmdirSync(dir);
        pruned.push(dir);
      }
    } catch {
      // ignore: never fail because of pruning
    }
  };

  removeIfEmpty(targetDir);
  const parent = path.dirname(targetDir);
  if (path.basename(targetDir) === 'agents' && path.basename(parent) === '.opencode') {
    removeIfEmpty(parent);
  }
  return pruned;
}

export function projectRootFromAgentsDir(agentsDir: string): string | null {
  const parent = path.dirname(agentsDir);
  if (path.basename(agentsDir) === 'agents' && path.basename(parent) === '.opencode') {
    return path.dirname(parent);
  }
  return null;
}

export function runOpencodeReload(): boolean {
  try {
    execSync('opencode reload', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function isOpencodeInstalled(): boolean {
  try {
    execSync('opencode --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function getOpencodeVersion(): string | null {
  try {
    const output = execSync('opencode --version', { stdio: 'pipe', encoding: 'utf8' });
    return output.trim();
  } catch {
    return null;
  }
}