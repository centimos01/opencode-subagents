#!/usr/bin/env node
/**
 * define-subagent.mjs
 *
 * Tool for OpenCode's AI (and users) to dynamically create, list, and remove
 * custom subagents on the fly (just like Claude).
 *
 * Lifecycle (no residue on disk):
 *   1. create -> writes `.opencode/agents/<name>.md` (or the global agents dir
 *                with --global), reloads OpenCode, and returns the exact
 *                `cleanup_command` to run afterwards. This script never
 *                modifies opencode.jsonc files itself.
 *   2. invoke -> the AI runs the subagent through the native `subagent` tool.
 *   3. remove -> deletes the markdown file, cleans any legacy `agents.<name>`
 *                entry written to opencode.jsonc by older versions of this
 *                script, and prunes empty .opencode/agents folders. Run it
 *                right after the subagent finishes so nothing is left behind.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const HOME_DIR = os.homedir();
const GLOBAL_CONFIG_DIR = path.join(HOME_DIR, '.config', 'opencode');
const GLOBAL_AGENTS_DIR = path.join(GLOBAL_CONFIG_DIR, 'agents');
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'opencode.jsonc');
const SCRIPT_PATH = fileURLToPath(import.meta.url);

// Permission presets for subagents
const PRESETS = {
  readonly: [
    { action: 'edit', resource: '*', effect: 'deny' },
    { action: 'write', resource: '*', effect: 'deny' },
    { action: 'patch', resource: '*', effect: 'deny' },
    { action: 'shell', resource: '*', effect: 'deny' },
  ],
  review: [
    { action: 'edit', resource: '*', effect: 'deny' },
    { action: 'write', resource: '*', effect: 'deny' },
    { action: 'patch', resource: '*', effect: 'deny' },
    { action: 'shell', resource: '*', effect: 'deny' },
  ],
  test: [
    { action: 'edit', resource: '*', effect: 'deny' },
    { action: 'write', resource: '*', effect: 'deny' },
    { action: 'patch', resource: '*', effect: 'deny' },
  ],
  worker: [
    // Default permissions (allow tools necessary for work)
  ],
};

function sanitizeName(name) {
  return String(name).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

function samePath(a, b) {
  const pa = path.resolve(a);
  const pb = path.resolve(b);
  return process.platform === 'win32' ? pa.toLowerCase() === pb.toLowerCase() : pa === pb;
}

function quote(value) {
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function cleanupCommand(name, agentsDir) {
  return `node ${quote(SCRIPT_PATH)} --remove ${quote(name)} --dir ${quote(agentsDir)}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    name: null,
    description: null,
    prompt: null,
    model: null,
    preset: 'readonly',
    mode: 'subagent',
    dir: null,
    global: false,
    list: false,
    remove: null,
    help: false,
  };

  const value = (flag, raw) => {
    if (raw === undefined) {
      console.error(`Error: ${flag} requires a value.`);
      process.exit(1);
    }
    return raw;
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--name' || arg === '-n') {
      options.name = value(arg, args[++i]);
    } else if (arg === '--description' || arg === '-d') {
      options.description = value(arg, args[++i]);
    } else if (arg === '--prompt' || arg === '-p') {
      options.prompt = value(arg, args[++i]);
    } else if (arg === '--model' || arg === '-m') {
      options.model = value(arg, args[++i]);
    } else if (arg === '--preset') {
      options.preset = value(arg, args[++i]);
    } else if (arg === '--mode') {
      options.mode = value(arg, args[++i]);
    } else if (arg === '--dir') {
      options.dir = value(arg, args[++i]);
    } else if (arg === '--global' || arg === '-g') {
      options.global = true;
    } else if (arg === '--list' || arg === '-l') {
      options.list = true;
    } else if (arg === '--remove' || arg === '-r') {
      options.remove = value(arg, args[++i]);
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function printHelp() {
  console.log(`
OpenCode Autonomous Subagent Manager
Usage:
  node define-subagent.mjs [options]

Options:
  --name, -n <string>         Subagent identifier (e.g. "perf-profiler", "doc-writer")
  --description, -d <string>  Clear summary of what the subagent does and when to call it
  --prompt, -p <string>       System instructions for the subagent
  --model, -m <string>        Optional model override (e.g. "openrouter/openai/gpt-4o-mini")
  --preset <string>           Permission preset: readonly, review, test, worker (default: readonly)
  --mode <string>             "subagent" (default), "primary", or "all"
  --global, -g                Save to global configuration instead of current project
  --list, -l                  List all existing subagents
  --remove, -r <string>       Delete an existing subagent (also cleans legacy config entries)
  --dir <path>                Agents directory to remove from (use the one printed by create)
  --help, -h                  Show this help text

Lifecycle (no residue on disk):
  Subagents created on the fly are temporary. After the subagent completes its
  task, delete it with the cleanup_command printed by create (equivalent to
  "--remove <name> --dir <agentsDir>") so no files are left on disk.
`);
}

function listSubagents(cwd) {
  const result = {
    hint:
      'Subagents created on the fly are temporary: once one is no longer needed, ' +
      'delete it with "--remove <id> --dir <agentsDir>" (or the cleanup_command printed ' +
      'by create) so no files are left on disk.',
    global: [],
    project: [],
  };

  // Global agents
  if (fs.existsSync(GLOBAL_AGENTS_DIR)) {
    const files = fs.readdirSync(GLOBAL_AGENTS_DIR).filter((f) => f.endsWith('.md'));
    for (const f of files) {
      result.global.push({
        id: f.replace(/\.md$/, ''),
        file: path.join(GLOBAL_AGENTS_DIR, f),
      });
    }
  }

  // Project agents
  const projectAgentsDir = path.join(cwd, '.opencode', 'agents');
  if (fs.existsSync(projectAgentsDir)) {
    const files = fs.readdirSync(projectAgentsDir).filter((f) => f.endsWith('.md'));
    for (const f of files) {
      result.project.push({
        id: f.replace(/\.md$/, ''),
        file: path.join(projectAgentsDir, f),
      });
    }
  }

  console.log(JSON.stringify(result, null, 2));
}

/* ------------------------------------------------------------------ */
/* Removal (full cleanup: file + legacy config entry + empty folders)  */
/* ------------------------------------------------------------------ */

// Best-effort JSONC cleanup. Strict JSON is tried first; this only runs as a
// fallback so legacy entries can be removed without touching unrelated files.
// If the result still cannot be parsed, the file is left untouched.
function stripJsonc(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '') // block comments
    .replace(/(^|[^:"'])\/\/.*$/gm, '$1') // line comments (keeps "https://")
    .replace(/,\s*([}\]])/g, '$1'); // trailing commas
}

function tryParseJsoncFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return { ok: true, json: JSON.parse(raw) };
  } catch {
    // fall through to JSONC cleanup
  }
  try {
    return { ok: true, json: JSON.parse(stripJsonc(raw)) };
  } catch {
    return { ok: false };
  }
}

// Removes `agents.<name>` entries that older versions of this script injected
// into opencode.jsonc. Files without that exact entry are never rewritten.
function cleanConfigEntries(configFiles, name) {
  const cleaned = [];
  const seen = new Set();
  for (const configFile of configFiles) {
    const resolved = path.resolve(configFile);
    if (seen.has(resolved) || !fs.existsSync(resolved)) continue;
    seen.add(resolved);
    const parsed = tryParseJsoncFile(resolved);
    if (!parsed.ok || !parsed.json || typeof parsed.json !== 'object') continue;
    const agents = parsed.json.agents;
    if (!agents || typeof agents !== 'object' || !Object.prototype.hasOwnProperty.call(agents, name)) {
      continue;
    }
    delete agents[name];
    if (Object.keys(agents).length === 0) {
      delete parsed.json.agents;
    }
    fs.writeFileSync(resolved, JSON.stringify(parsed.json, null, 2) + '\n', 'utf8');
    cleaned.push(resolved);
  }
  return cleaned;
}

// Removes `targetDir` (and its empty `.opencode` parent when applicable) only
// when they are truly empty, so leftover folder structure never remains.
function pruneEmptyDirs(targetDir) {
  const pruned = [];
  const removeIfEmpty = (dir) => {
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

function projectRootFromAgentsDir(agentsDir) {
  const parent = path.dirname(agentsDir);
  if (path.basename(agentsDir) === 'agents' && path.basename(parent) === '.opencode') {
    return path.dirname(parent);
  }
  return null;
}

function removeSubagent(name, options, cwd) {
  const cleanName = sanitizeName(name);
  const explicitDir = options.dir ? path.resolve(cwd, options.dir) : null;
  const targetDir = explicitDir
    ? explicitDir
    : options.global
      ? GLOBAL_AGENTS_DIR
      : path.join(cwd, '.opencode', 'agents');
  const filePath = path.join(targetDir, `${cleanName}.md`);

  let removedFile = null;
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    removedFile = filePath;
  }

  // Legacy cleanup: remove `agents.<name>` entries that older versions of this
  // script wrote into opencode.jsonc files. Only files that actually contain
  // the entry are rewritten.
  let configFiles;
  if (explicitDir && samePath(explicitDir, GLOBAL_AGENTS_DIR)) {
    configFiles = [GLOBAL_CONFIG_FILE];
  } else if (explicitDir) {
    const root = projectRootFromAgentsDir(explicitDir) || cwd;
    configFiles = [path.join(root, 'opencode.jsonc'), path.join(root, '.opencode', 'opencode.jsonc')];
  } else if (options.global) {
    configFiles = [GLOBAL_CONFIG_FILE];
  } else {
    configFiles = [path.join(cwd, 'opencode.jsonc'), path.join(cwd, '.opencode', 'opencode.jsonc')];
  }
  const configEntriesCleaned = cleanConfigEntries(configFiles, cleanName);

  const prunedDirs = pruneEmptyDirs(targetDir);

  let reloaded = false;
  try {
    execSync('opencode reload', { stdio: 'pipe' });
    reloaded = true;
  } catch {
    // OpenCode service might not be running; cleanup still succeeded on disk.
  }

  const status = removedFile || configEntriesCleaned.length > 0 ? 'success' : 'not_found';
  const response = {
    status,
    agent: cleanName,
    removedFile,
    configEntriesCleaned,
    prunedDirs,
    reloaded,
  };
  if (status === 'not_found') {
    response.checkedFile = filePath;
    response.hint = 'Nothing to remove for this agent (no file and no legacy config entry).';
  }

  console.log(JSON.stringify(response, null, 2));
}

/* ------------------------------------------------------------------ */
/* Creation                                                            */
/* ------------------------------------------------------------------ */

function createSubagent(options, cwd) {
  if (!options.name) {
    console.error('Error: --name is required.');
    process.exit(1);
  }
  if (!options.description) {
    console.error('Error: --description is required.');
    process.exit(1);
  }
  if (!Object.prototype.hasOwnProperty.call(PRESETS, options.preset)) {
    console.error(`Error: unknown --preset "${options.preset}". Use one of: ${Object.keys(PRESETS).join(', ')}.`);
    process.exit(1);
  }

  const cleanName = sanitizeName(options.name);
  const targetDir = options.global ? GLOBAL_AGENTS_DIR : path.join(cwd, '.opencode', 'agents');
  const filePath = path.join(targetDir, `${cleanName}.md`);

  // Never overwrite something that already exists: it may be a user-authored
  // agent, and cleaning up a temporary subagent must never delete user work.
  if (fs.existsSync(filePath)) {
    console.log(
      JSON.stringify(
        {
          status: 'error',
          error: 'agent_exists',
          agent: cleanName,
          filePath,
          hint:
            'A file with this name already exists and was NOT modified. If it is a leftover ' +
            'temporary subagent, delete it with cleanup_command and retry; otherwise choose a different --name.',
          cleanup_command: cleanupCommand(cleanName, targetDir),
        },
        null,
        2,
      ),
    );
    process.exit(1);
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const permissions = PRESETS[options.preset];

  // Build markdown content
  let md = '---\n';
  md += `description: "${options.description.replace(/"/g, '\\"')}"\n`;
  md += `mode: ${options.mode || 'subagent'}\n`;
  if (options.model) {
    md += `model: ${options.model}\n`;
  }
  if (permissions.length > 0) {
    md += 'permissions:\n';
    for (const p of permissions) {
      md += `  - action: ${p.action}\n`;
      md += `    resource: "${p.resource}"\n`;
      md += `    effect: ${p.effect}\n`;
    }
  }
  md += '---\n\n';
  md += (options.prompt || `You are specialized subagent: ${cleanName}.\nExecute your instructions concisely.`).trim();
  md += '\n';

  fs.writeFileSync(filePath, md, 'utf8');

  // Reload OpenCode configuration so the new agent registers immediately.
  let reloaded = false;
  try {
    execSync('opencode reload', { stdio: 'pipe' });
    reloaded = true;
  } catch {
    // OpenCode service might not be running or reload via background
  }

  const response = {
    status: 'success',
    agent: cleanName,
    mode: options.mode || 'subagent',
    filePath,
    scope: options.global ? 'global' : 'project',
    reloaded,
    how_to_invoke: {
      tool: 'subagent',
      agent: cleanName,
      example: `subagent(agent: "${cleanName}", description: "${options.description.slice(0, 50)}", prompt: "...")`,
    },
    lifecycle: 'temporary',
    cleanup_when: 'Immediately after the subagent completes its task (or as soon as it is no longer needed).',
    cleanup_command: cleanupCommand(cleanName, targetDir),
  };

  console.log(JSON.stringify(response, null, 2));
}

function main() {
  const options = parseArgs();
  const cwd = process.cwd();

  if (options.help) {
    printHelp();
    return;
  }

  if (options.list) {
    listSubagents(cwd);
    return;
  }

  if (options.remove !== null) {
    removeSubagent(options.remove, options, cwd);
    return;
  }

  createSubagent(options, cwd);
}

main();
