#!/usr/bin/env node
/**
 * install.ts
 *
 * Unified installer for OpenCode Subagents.
 * Replaces install.ps1 and install.sh with a cross-platform Node.js implementation.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..', '..');

interface InstallOptions {
  dryRun?: boolean;
  force?: boolean;
  global?: boolean;
  help?: boolean;
}

const HOME_DIR = os.homedir();
const GLOBAL_CONFIG_DIR = path.join(HOME_DIR, '.config', 'opencode');
const GLOBAL_AGENTS_DIR = path.join(GLOBAL_CONFIG_DIR, 'agents');
const GLOBAL_INSTRUCTIONS_DIR = path.join(GLOBAL_CONFIG_DIR, 'instructions');
const GLOBAL_SKILLS_DIR = path.join(GLOBAL_CONFIG_DIR, 'skills');
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'opencode.jsonc');

const SOURCE_AGENTS_DIR = path.join(PROJECT_ROOT, 'agents');
const SOURCE_INSTRUCTIONS_DIR = path.join(PROJECT_ROOT, 'instructions');
const SOURCE_SKILLS_DIR = path.join(PROJECT_ROOT, 'skills');

function printHelp(): void {
  console.log(`
OpenCode Subagents Installer
Usage:
  opencode-subagents-install [options]

Options:
  --dry-run       Preview changes without applying them
  --force         Force overwrite existing configuration
  --global        Install to global configuration (default: true)
  --help, -h      Show this help text

This installer will:
  1. Detect OS (Windows/macOS/Linux)
  2. Backup existing opencode.jsonc
  3. Validate opencode CLI is in PATH
  4. Copy agents, instructions, skills to global config
  5. Configure opencode.jsonc with placeholders
`);
}

function checkOpencodeInPath(): boolean {
  try {
    execSync('opencode --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

function getOpencodeVersion(): string | null {
  try {
    const output = execSync('opencode --version', { stdio: 'pipe', encoding: 'utf8' });
    return output.trim();
  } catch {
    return null;
  }
}

function backupConfig(): string | null {
  if (!fs.existsSync(GLOBAL_CONFIG_FILE)) {
    return null;
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${GLOBAL_CONFIG_FILE}.bak-${timestamp}`;
  fs.copyFileSync(GLOBAL_CONFIG_FILE, backupPath);
  return backupPath;
}

function copyDirSync(src: string, dest: string, dryRun: boolean = false): string[] {
  const copied: string[] = [];
  
  if (!fs.existsSync(src)) {
    return copied;
  }
  
  if (!fs.existsSync(dest)) {
    if (!dryRun) {
      fs.mkdirSync(dest, { recursive: true });
    }
    copied.push(dest);
  }
  
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copied.push(...copyDirSync(srcPath, destPath, dryRun));
    } else {
      if (!dryRun) {
        fs.copyFileSync(srcPath, destPath);
      }
      copied.push(destPath);
    }
  }
  
  return copied;
}

function createDefaultConfig(): object {
  return {
    $schema: 'https://opencode.ai/config.json',
    instructions: [
      '{{INSTRUCTIONS_PATH}}/autonomous-subagents.md'
    ],
    agents: {}
  };
}

function mergeConfig(existing: object): object {
  const defaultConfig = createDefaultConfig();
  
  // Merge agents - keep existing, add built-ins if missing
  const existingAgents = (existing as Record<string, unknown>)['agents'] as Record<string, unknown> || {};
  const defaultAgents = (defaultConfig as Record<string, unknown>)['agents'] as Record<string, unknown>;
  
  const mergedAgents = { ...defaultAgents, ...existingAgents };
  
  const merged = {
    ...defaultConfig,
    ...existing,
    agents: mergedAgents,
  };
  
  return merged;
}

function writeConfig(config: object, dryRun: boolean = false): void {
  const content = JSON.stringify(config, null, 2) + '\n';
  
  if (dryRun) {
    console.log(chalk.yellow('[DRY-RUN] Would write config:'));
    console.log(content);
  } else {
    fs.writeFileSync(GLOBAL_CONFIG_FILE, content, 'utf8');
  }
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name('opencode-subagents-install')
    .description('Unified installer for OpenCode Subagents')
    .version('2.0.0')
    .option('--dry-run', 'Preview changes without applying them', false)
    .option('--force', 'Force overwrite existing configuration', false)
    .option('--global', 'Install to global configuration', true)
    .option('-h, --help', 'Show this help text');

  program.parse(process.argv);
  const options = program.opts<InstallOptions>();

  if (options.help) {
    printHelp();
    return;
  }

  console.log(chalk.bold('\n📦 OpenCode Subagents Installer\n'));

  // Check opencode is installed
  const opencodeInstalled = checkOpencodeInPath();
  if (!opencodeInstalled) {
    console.error(chalk.red('✗ OpenCode CLI not found in PATH'));
    console.error('  Please install OpenCode from https://opencode.ai');
    process.exit(1);
  }
  
  const version = getOpencodeVersion();
  console.log(chalk.green(`✓ OpenCode CLI found (v${version})`));

  // Detect OS
  const platform = process.platform;
  console.log(chalk.blue(`ℹ Detected OS: ${platform}`));

  // Dry-run notice
  if (options.dryRun) {
    console.log(chalk.yellow('\n⚠ DRY-RUN MODE - No changes will be made\n'));
  }

  // Backup existing config
  let backupPath: string | null = null;
  if (fs.existsSync(GLOBAL_CONFIG_FILE) && !options.dryRun) {
    backupPath = backupConfig();
    console.log(chalk.green(`✓ Backed up existing config to: ${backupPath}`));
  } else if (fs.existsSync(GLOBAL_CONFIG_FILE) && options.dryRun) {
    console.log(chalk.yellow('[DRY-RUN] Would backup existing config'));
  }

  // Create directories
  const dirsToCreate = [
    GLOBAL_CONFIG_DIR,
    GLOBAL_AGENTS_DIR,
    GLOBAL_INSTRUCTIONS_DIR,
    GLOBAL_SKILLS_DIR,
  ];

  for (const dir of dirsToCreate) {
    if (!fs.existsSync(dir)) {
      if (options.dryRun) {
        console.log(chalk.yellow(`[DRY-RUN] Would create directory: ${dir}`));
      } else {
        fs.mkdirSync(dir, { recursive: true });
        console.log(chalk.green(`✓ Created directory: ${dir}`));
      }
    } else {
      console.log(chalk.blue(`ℹ Directory exists: ${dir}`));
    }
  }

  // Copy agents
  console.log(chalk.bold('\n📁 Copying agents...'));
  const agentsCopied = copyDirSync(SOURCE_AGENTS_DIR, GLOBAL_AGENTS_DIR, options.dryRun);
  for (const file of agentsCopied) {
    const relPath = path.relative(GLOBAL_CONFIG_DIR, file);
    if (options.dryRun) {
      console.log(chalk.yellow(`[DRY-RUN] Would copy: ${relPath}`));
    } else {
      console.log(chalk.green(`✓ Copied: ${relPath}`));
    }
  }

  // Copy instructions
  console.log(chalk.bold('\n📁 Copying instructions...'));
  const instructionsCopied = copyDirSync(SOURCE_INSTRUCTIONS_DIR, GLOBAL_INSTRUCTIONS_DIR, options.dryRun);
  for (const file of instructionsCopied) {
    const relPath = path.relative(GLOBAL_CONFIG_DIR, file);
    if (options.dryRun) {
      console.log(chalk.yellow(`[DRY-RUN] Would copy: ${relPath}`));
    } else {
      console.log(chalk.green(`✓ Copied: ${relPath}`));
    }
  }

  // Copy skills
  console.log(chalk.bold('\n📁 Copying skills...'));
  const skillsCopied = copyDirSync(SOURCE_SKILLS_DIR, GLOBAL_SKILLS_DIR, options.dryRun);
  for (const file of skillsCopied) {
    const relPath = path.relative(GLOBAL_CONFIG_DIR, file);
    if (options.dryRun) {
      console.log(chalk.yellow(`[DRY-RUN] Would copy: ${relPath}`));
    } else {
      console.log(chalk.green(`✓ Copied: ${relPath}`));
    }
  }

  // Handle config file
  console.log(chalk.bold('\n⚙️  Configuring opencode.jsonc...'));
  
  let existingConfig: object = {};
  if (fs.existsSync(GLOBAL_CONFIG_FILE)) {
    const raw = fs.readFileSync(GLOBAL_CONFIG_FILE, 'utf8');
    try {
      existingConfig = JSON.parse(raw);
    } catch {
      // If JSON parse fails, try to strip comments
      const stripped = raw
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:"'])\/\/.*$/gm, '$1')
        .replace(/,\s*([}\]])/g, '$1');
      try {
        existingConfig = JSON.parse(stripped);
      } catch {
        console.log(chalk.yellow('⚠ Could not parse existing config, creating new'));
        existingConfig = {};
      }
    }
  }

  const mergedConfig = mergeConfig(existingConfig);
  
  if (options.dryRun) {
    console.log(chalk.yellow('[DRY-RUN] Would write merged config:'));
    console.log(JSON.stringify(mergedConfig, null, 2));
  } else {
    writeConfig(mergedConfig);
    console.log(chalk.green(`✓ Configuration written to: ${GLOBAL_CONFIG_FILE}`));
  }

  // Reload opencode
  if (!options.dryRun) {
    try {
      execSync('opencode reload', { stdio: 'pipe' });
      console.log(chalk.green('✓ OpenCode configuration reloaded'));
    } catch {
      console.log(chalk.yellow('⚠ Could not reload OpenCode (service might not be running)'));
    }
  } else {
    console.log(chalk.yellow('[DRY-RUN] Would reload OpenCode'));
  }

  console.log(chalk.bold('\n✅ Installation complete!\n'));
  
  if (!options.dryRun) {
    console.log('Next steps:');
    console.log('  1. Run `opencode` to start');
    console.log('  2. Try `define-subagent --list` to see available agents');
    console.log('  3. Try `define-subagent --doctor` to run health checks');
  }
}

main().catch((err) => {
  console.error(chalk.red('Error:'), err.message);
  process.exit(1);
});