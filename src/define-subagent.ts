#!/usr/bin/env node
/**
 * define-subagent.ts
 *
 * Main CLI entry point for OpenCode Autonomous Subagent Manager.
 * Migrated from define-subagent.mjs to TypeScript with Commander.js.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  sanitizeName,
  samePath,
  cleanupCommand,
  tryParseJsoncFile,
  projectRootFromAgentsDir,
  isOpencodeInstalled,
  getOpencodeVersion,
} from './utils.js';

import {
  GLOBAL_CONFIG_DIR,
  GLOBAL_AGENTS_DIR,
  GLOBAL_CONFIG_FILE,
  PRESETS,
  BUILTIN_AGENTS,
  MESSAGES,
} from './constants.js';

import {
  getTemplate,
  listTemplates,
  interpolateTemplate,
} from './templates/index.js';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_PATH = __filename;

interface ParsedOptions {
  name?: string;
  description?: string;
  prompt?: string;
  model?: string;
  preset: 'readonly' | 'review' | 'test' | 'worker';
  mode: string;
  dir?: string;
  global: boolean;
  list: boolean;
  remove?: string;
  help: boolean;
  template?: string;
  doctor: boolean;
  dryRun: boolean;
  force: boolean;
  lang: string;
}

function getMessages(lang: string) {
  return MESSAGES[lang as keyof typeof MESSAGES] || MESSAGES.en;
}

function printHelp(lang: string) {
  const msg = getMessages(lang);
  console.log(msg.help);
}

async function listSubagents(cwd: string, lang: string): Promise<void> {
  const msg = getMessages(lang);
  const result = {
    hint: msg.listHint,
    global: [] as Array<{ id: string; file: string }>,
    project: [] as Array<{ id: string; file: string }>,
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

function cleanConfigEntriesWrapper(configFiles: string[], name: string): string[] {
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

function pruneEmptyDirsWrapper(targetDir: string): string[] {
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

async function removeSubagent(name: string, options: ParsedOptions, cwd: string, lang: string): Promise<void> {
  const msg = getMessages(lang);
  const cleanName = sanitizeName(name);
  const explicitDir = options.dir ? path.resolve(cwd, options.dir) : null;
  const targetDir = explicitDir
    ? explicitDir
    : options.global
      ? GLOBAL_AGENTS_DIR
      : path.join(cwd, '.opencode', 'agents');
  const filePath = path.join(targetDir, `${cleanName}.md`);

  let removedFile: string | null = null;
  if (fs.existsSync(filePath)) {
    if (options.dryRun) {
      console.log(chalk.yellow(`[DRY-RUN] Would remove: ${filePath}`));
    } else {
      fs.unlinkSync(filePath);
      removedFile = filePath;
    }
  }

  // Legacy cleanup: remove `agents.<name>` entries that older versions of this
  // script wrote into opencode.jsonc files. Only files that actually contain
  // the entry are rewritten.
  let configFiles: string[];
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

  let configEntriesCleaned: string[] = [];
  if (!options.dryRun) {
    configEntriesCleaned = cleanConfigEntriesWrapper(configFiles, cleanName);
  } else {
    for (const f of configFiles) {
      if (fs.existsSync(f)) {
        const parsed = tryParseJsoncFile(f);
        if (parsed.ok && parsed.json && typeof parsed.json === 'object') {
          const agents = (parsed.json as Record<string, unknown>)['agents'];
          if (agents && typeof agents === 'object' && Object.prototype.hasOwnProperty.call(agents, cleanName)) {
            configEntriesCleaned.push(f);
          }
        }
      }
    }
  }

  let prunedDirs: string[] = [];
  if (!options.dryRun) {
    prunedDirs = pruneEmptyDirsWrapper(targetDir);
  }

  let reloaded = false;
  if (!options.dryRun) {
    try {
      execSync('opencode reload', { stdio: 'pipe' });
      reloaded = true;
    } catch {
      // OpenCode service might not be running; cleanup still succeeded on disk.
    }
  }

  const status = removedFile || configEntriesCleaned.length > 0 ? 'success' : 'not_found';
  const response = {
    status,
    agent: cleanName,
    removedFile,
    configEntriesCleaned,
    prunedDirs,
    reloaded,
  } as const;

  if (status === 'not_found') {
    (response as any).checkedFile = filePath;
    (response as any).hint = msg.notFound(cleanName);
  }

  console.log(JSON.stringify(response, null, 2));
}

async function createSubagent(options: ParsedOptions, cwd: string, lang: string): Promise<void> {
  const msg = getMessages(lang);

  if (!options.name) {
    console.error(msg.nameRequired);
    process.exit(1);
  }
  if (!options.description && !options.template) {
    console.error(msg.descriptionRequired);
    process.exit(1);
  }
  if (!options.prompt && !options.template) {
    console.error(msg.promptRequired);
    process.exit(1);
  }
  if (!Object.prototype.hasOwnProperty.call(PRESETS, options.preset)) {
    console.error(msg.unknownPreset(options.preset));
    process.exit(1);
  }

  // Handle template
  let template: { name: string; description: string; prompt: string; preset: 'readonly' | 'review' | 'test' | 'worker'; variables?: Record<string, string> } | undefined;
  if (options.template) {
    template = getTemplate(options.template);
    if (!template) {
      console.error(msg.unknownTemplate(options.template));
      process.exit(1);
    }
    // Override with template values if not explicitly provided
    options.description = options.description || template.description;
    options.prompt = options.prompt || template.prompt;
    options.preset = options.preset || template.preset;
  }

  const cleanName = sanitizeName(options.name);
  const targetDir = options.global ? GLOBAL_AGENTS_DIR : path.join(cwd, '.opencode', 'agents');
  const filePath = path.join(targetDir, `${cleanName}.md`);

  // Never overwrite something that already exists: it may be a user-authored
  // agent, and cleaning up a temporary subagent must never delete user work.
  if (fs.existsSync(filePath) && !options.force) {
    const response = {
      status: 'error',
      error: 'agent_exists',
      agent: cleanName,
      filePath,
      hint: msg.agentExists,
      cleanup_command: cleanupCommand(SCRIPT_PATH, cleanName, targetDir),
    };
    console.log(JSON.stringify(response, null, 2));
    process.exit(1);
  }

  if (options.dryRun) {
    const response = {
      dryRun: true,
      name: cleanName,
      description: options.description,
      preset: options.preset,
      mode: options.mode,
      model: options.model,
      targetDir,
      filePath,
    };
    console.log(JSON.stringify(response, null, 2));
    return;
  }

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const permissions = PRESETS[options.preset];

  // Build markdown content
  let prompt = options.prompt || `You are specialized subagent: ${cleanName}.\nExecute your instructions concisely.`;
  
  // Interpolate template variables if using a template
  if (template && template.variables) {
    const variables = {
      project_root: cwd,
      base_url: 'http://localhost:3000',
      docs_dir: path.join(cwd, 'docs'),
      db_type: 'postgresql',
      package_manager: 'npm',
      from_version: '1.0.0',
      to_version: '2.0.0',
      pattern: '',
      replacement: '',
      ...template.variables,
    };
    prompt = interpolateTemplate({ ...template, prompt }, variables).prompt;
  }

  let md = '---\n';
  md += `description: "${options.description!.replace(/"/g, '\\"')}"\n`;
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
  md += prompt.trim();
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
      example: `subagent(agent: "${cleanName}", description: "${options.description!.slice(0, 50)}", prompt: "...")`,
    },
    lifecycle: 'temporary',
    cleanup_when: 'Immediately after the subagent completes its task (or as soon as it is no longer needed).',
    cleanup_command: cleanupCommand(SCRIPT_PATH, cleanName, targetDir),
  };

  console.log(JSON.stringify(response, null, 2));
}

async function runDoctor(_lang: string): Promise<void> {
  const checks: Array<{ name: string; status: 'pass' | 'fail' | 'warn'; message: string; details?: string }> = [];

  // Check 1: opencode installed
  const opencodeInstalled = isOpencodeInstalled();
  checks.push({
    name: 'opencode_installed',
    status: opencodeInstalled ? 'pass' : 'fail',
    message: opencodeInstalled ? 'OpenCode CLI is installed' : 'OpenCode CLI not found in PATH',
    details: opencodeInstalled ? `Version: ${getOpencodeVersion()}` : 'Install from https://opencode.ai',
  });

  // Check 2: Global config directory
  const globalConfigExists = fs.existsSync(GLOBAL_CONFIG_DIR);
  checks.push({
    name: 'global_config_dir',
    status: globalConfigExists ? 'pass' : 'warn',
    message: globalConfigExists ? 'Global config directory exists' : 'Global config directory not found',
    details: GLOBAL_CONFIG_DIR,
  });

  // Check 3: Global agents directory
  const globalAgentsExists = fs.existsSync(GLOBAL_AGENTS_DIR);
  checks.push({
    name: 'global_agents_dir',
    status: globalAgentsExists ? 'pass' : 'warn',
    message: globalAgentsExists ? 'Global agents directory exists' : 'Global agents directory not found',
    details: GLOBAL_AGENTS_DIR,
  });

  // Check 4: Global config file
  const globalConfigFileExists = fs.existsSync(GLOBAL_CONFIG_FILE);
  checks.push({
    name: 'global_config_file',
    status: globalConfigFileExists ? 'pass' : 'warn',
    message: globalConfigFileExists ? 'Global config file exists' : 'Global config file not found',
    details: GLOBAL_CONFIG_FILE,
  });

  // Check 5: Built-in agents registered
  let builtinAgentsRegistered = 0;
  if (globalConfigFileExists) {
    const parsed = tryParseJsoncFile(GLOBAL_CONFIG_FILE);
    if (parsed.ok && parsed.json && typeof parsed.json === 'object') {
      const agents = (parsed.json as Record<string, unknown>)['agents'];
      if (agents && typeof agents === 'object') {
        for (const builtin of BUILTIN_AGENTS) {
          if (Object.prototype.hasOwnProperty.call(agents, builtin)) {
            builtinAgentsRegistered++;
          }
        }
      }
    }
  }
  checks.push({
    name: 'builtin_agents',
    status: builtinAgentsRegistered === BUILTIN_AGENTS.length ? 'pass' : 'warn',
    message: `${builtinAgentsRegistered}/${BUILTIN_AGENTS.length} built-in agents registered`,
    details: builtinAgentsRegistered === BUILTIN_AGENTS.length ? 'All built-in agents configured' : 'Some built-in agents missing from config',
  });

  // Check 6: Templates available
  checks.push({
    name: 'templates',
    status: 'pass',
    message: `${listTemplates().length} templates available`,
    details: listTemplates().join(', '),
  });

  // Overall status
  const hasFail = checks.some((c) => c.status === 'fail');
  const hasWarn = checks.some((c) => c.status === 'warn');
  const overall = hasFail ? 'unhealthy' : hasWarn ? 'degraded' : 'healthy';

  const result = { overall, checks };
  console.log(JSON.stringify(result, null, 2));

  if (overall !== 'healthy') {
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('define-subagent')
    .description('OpenCode Autonomous Subagent Manager')
    .version('2.0.0')
    .option('-n, --name <string>', 'Subagent identifier (e.g. "perf-profiler", "doc-writer")')
    .option('-d, --description <string>', 'Clear summary of what the subagent does and when to call it')
    .option('-p, --prompt <string>', 'System instructions for the subagent')
    .option('-m, --model <string>', 'Optional model override')
    .option('--preset <string>', 'Permission preset: readonly, review, test, worker', 'readonly')
    .option('--mode <string>', '"subagent" (default), "primary", or "all"', 'subagent')
    .option('-g, --global', 'Save to global configuration instead of current project', false)
    .option('-l, --list', 'List all existing subagents', false)
    .option('-r, --remove <string>', 'Delete an existing subagent (also cleans legacy config entries)')
    .option('--dir <path>', 'Agents directory to remove from (use the one printed by create)')
    .option('-t, --template <string>', 'Use a predefined template (api-tester, doc-writer, etc.)')
    .option('--doctor', 'Run health checks on the OpenCode subagent setup', false)
    .option('--dry-run', 'Preview changes without applying them', false)
    .option('--force', 'Force overwrite existing subagent', false)
    .option('--lang <string>', 'Language for output (en, es)', 'en')
    .option('-h, --help', 'Show this help text');

  program.parse(process.argv);
  const options = program.opts<ParsedOptions>();

  const lang = options.lang || 'en';

  if (options.help) {
    printHelp(lang);
    return;
  }

  if (options.doctor) {
    await runDoctor(lang);
    return;
  }

  const cwd = process.cwd();

  if (options.list) {
    await listSubagents(cwd, lang);
    return;
  }

  if (options.remove) {
    await removeSubagent(options.remove, options, cwd, lang);
    return;
  }

  await createSubagent(options, cwd, lang);
}

main().catch((err) => {
  console.error(chalk.red('Error:'), err.message);
  process.exit(1);
});