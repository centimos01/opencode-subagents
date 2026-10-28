/**
 * Core utility functions (no external dependencies)
 */

export function sanitizeName(name: string): string {
  return String(name).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+$/, '');
}

import path from 'node:path';

export function samePath(a: string, b: string): boolean {
  const pa = path.resolve(a);
  const pb = path.resolve(b);
  return process.platform === 'win32' ? pa.toLowerCase() === pb.toLowerCase() : pa === pb;
}

export function quote(value: string): string {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

export function cleanupCommand(scriptPath: string, name: string, agentsDir: string): string {
  return `node ${quote(scriptPath)} --remove ${quote(name)} --dir ${quote(agentsDir)}`;
}

export function stripJsonc(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:"'])\/\/.*$/gm, '$1')
    .replace(/,\s*([}\]])/g, '$1');
}