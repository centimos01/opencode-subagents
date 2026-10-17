#!/usr/bin/env node
/**
 * define-subagent.mjs
 * 
 * Tool for OpenCode's AI (and users) to dynamically create, configure,
 * list, and reload custom subagents on the fly (just like Claude).
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import os from 'node:os';

const HOME_DIR = os.homedir();
const GLOBAL_CONFIG_DIR = path.join(HOME_DIR, '.config', 'opencode');
const GLOBAL_AGENTS_DIR = path.join(GLOBAL_CONFIG_DIR, 'agents');
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'opencode.jsonc');

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

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    name: null,
    description: null,
    prompt: null,
    model: null,
    preset: 'readonly',
    mode: 'subagent',
    global: false,
    list: false,
    remove: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--name' || arg === '-n') {
      options.name = args[++i];
    } else if (arg === '--description' || arg === '-d') {
      options.description = args[++i];
    } else if (arg === '--prompt' || arg === '-p') {
      options.prompt = args[++i];
    } else if (arg === '--model' || arg === '-m') {
      options.model = args[++i];
    } else if (arg === '--preset') {
      options.preset = args[++i];
    } else if (arg === '--mode') {
      options.mode = args[++i];
    } else if (arg === '--global' || arg === '-g') {
      options.global = true;
    } else if (arg === '--list' || arg === '-l') {
      options.list = true;
    } else if (arg === '--remove' || arg === '-r') {
      options.remove = args[++i];
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
  --remove, -r <string>       Delete an existing subagent
  --help, -h                  Show this help text
`);
}

function listSubagents(cwd) {
  const result = {
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

function removeSubagent(name, isGlobal, cwd) {
  const targetDir = isGlobal ? GLOBAL_AGENTS_DIR : path.join(cwd, '.opencode', 'agents');
  const filePath = path.join(targetDir, `${name}.md`);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log(`[define-subagent] Removed agent file: ${filePath}`);
  } else {
    console.log(`[define-subagent] Agent file not found: ${filePath}`);
  }

  // Reload opencode
  try {
    execSync('opencode reload', { stdio: 'inherit' });
  } catch (err) {
    // ignore
  }
}

function createSubagent(options, cwd) {
  if (!options.name) {
    console.error('Error: --name is required.');
    process.exit(1);
  }
  if (!options.description) {
    console.error('Error: --description is required.');
    process.exit(1);
  }

  const cleanName = options.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const targetDir = options.global ? GLOBAL_AGENTS_DIR : path.join(cwd, '.opencode', 'agents');

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const permissions = PRESETS[options.preset] || [];

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

  const filePath = path.join(targetDir, `${cleanName}.md`);
  fs.writeFileSync(filePath, md, 'utf8');

  // Also update opencode.jsonc to guarantee registration
  const configFile = options.global ? GLOBAL_CONFIG_FILE : path.join(cwd, 'opencode.jsonc');
  if (fs.existsSync(configFile)) {
    try {
      const content = fs.readFileSync(configFile, 'utf8');
      // Simple JSONC parse/update
      let json;
      try {
        json = JSON.parse(content);
      } catch {
        // Strip basic comments if any
        const cleaned = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        json = JSON.parse(cleaned);
      }
      json.agents = json.agents || {};
      json.agents[cleanName] = {
        description: options.description,
        mode: options.mode || 'subagent',
        system: (options.prompt || '').trim(),
      };
      if (options.model) json.agents[cleanName].model = options.model;
      if (permissions.length > 0) json.agents[cleanName].permissions = permissions;

      fs.writeFileSync(configFile, JSON.stringify(json, null, 2), 'utf8');
    } catch (e) {
      // JSONC update optional
    }
  }

  // Reload OpenCode configuration
  let reloaded = false;
  try {
    execSync('opencode reload', { stdio: 'pipe' });
    reloaded = true;
  } catch (err) {
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

  if (options.remove) {
    removeSubagent(options.remove, options.global, cwd);
    return;
  }

  createSubagent(options, cwd);
}

main();
