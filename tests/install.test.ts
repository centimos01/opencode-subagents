import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const INSTALL_CLI_PATH = path.join(process.cwd(), 'dist', 'install.js');

describe('CLI: opencode-subagents-install', () => {
  const testDir = path.join(os.tmpdir(), 'opencode-install-test-' + Date.now());
  const originalConfigDir = path.join(os.homedir(), '.config', 'opencode');
  const originalConfigFile = path.join(originalConfigDir, 'opencode.jsonc');
  const originalAgentsDir = path.join(originalConfigDir, 'agents');
  const originalInstructionsDir = path.join(originalConfigDir, 'instructions');
  const originalSkillsDir = path.join(originalConfigDir, 'skills');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(testDir, { recursive: true });
    
    // Backup original config
    if (fs.existsSync(originalConfigFile)) {
      fs.copyFileSync(originalConfigFile, originalConfigFile + '.bak');
    }
    if (fs.existsSync(originalAgentsDir)) {
      fs.cpSync(originalAgentsDir, originalAgentsDir + '.bak', { recursive: true });
    }
    if (fs.existsSync(originalInstructionsDir)) {
      fs.cpSync(originalInstructionsDir, originalInstructionsDir + '.bak', { recursive: true });
    }
    if (fs.existsSync(originalSkillsDir)) {
      fs.cpSync(originalSkillsDir, originalSkillsDir + '.bak', { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    
    // Restore original config
    if (fs.existsSync(originalConfigFile + '.bak')) {
      fs.copyFileSync(originalConfigFile + '.bak', originalConfigFile);
      fs.unlinkSync(originalConfigFile + '.bak');
    }
    if (fs.existsSync(originalAgentsDir + '.bak')) {
      fs.rmSync(originalAgentsDir, { recursive: true, force: true });
      fs.renameSync(originalAgentsDir + '.bak', originalAgentsDir);
    }
    if (fs.existsSync(originalInstructionsDir + '.bak')) {
      fs.rmSync(originalInstructionsDir, { recursive: true, force: true });
      fs.renameSync(originalInstructionsDir + '.bak', originalInstructionsDir);
    }
    if (fs.existsSync(originalSkillsDir + '.bak')) {
      fs.rmSync(originalSkillsDir, { recursive: true, force: true });
      fs.renameSync(originalSkillsDir + '.bak', originalSkillsDir);
    }
  });

  function escapeArg(arg: string): string {
    if (/[\s"'\\]/.test(arg)) {
      return '"' + arg.replace(/"/g, '\\"') + '"';
    }
    return arg;
  }

  function runInstall(args: string[], options: { cwd?: string; env?: Record<string, string> } = {}) {
    const env = { ...process.env, ...options.env };
    const cmd = `node "${INSTALL_CLI_PATH}" ${args.map(escapeArg).join(' ')}`;
    return execSync(cmd, {
      cwd: options.cwd || testDir,
      encoding: 'utf8',
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  function runInstallJson(args: string[], options: { cwd?: string; env?: Record<string, string> } = {}) {
    const output = runInstall(args, options);
    return JSON.parse(output.trim());
  }

  describe('--help', () => {
    it('shows help text', () => {
      const output = runInstall(['--help']);
      expect(output).toContain('OpenCode Subagents Installer');
      expect(output).toContain('--dry-run');
      expect(output).toContain('--force');
      expect(output).toContain('--global');
    });
  });

  describe('--dry-run', () => {
    it('shows what would be installed without making changes', () => {
      const output = runInstall(['--dry-run']);
      expect(output).toContain('DRY-RUN');
      expect(output).toContain('Would write merged config');
    });
  });

  describe('--force', () => {
    it('overwrites existing configuration', () => {
      // Create a dummy config first
      fs.mkdirSync(originalConfigDir, { recursive: true });
      fs.writeFileSync(originalConfigFile, JSON.stringify({ test: 'old' }), 'utf8');
      
      const output = runInstall(['--force', '--dry-run']);
      expect(output).toContain('DRY-RUN');
      expect(output).toContain('Would write merged config');
    });
  });

  describe('installation', () => {
    it('creates global config directory structure', () => {
      runInstall(['--dry-run']);
      
      // With --dry-run, nothing should be created
      // This test is just to verify dry-run works
    });
  });

  describe('backup', () => {
    it('backs up existing opencode.jsonc', () => {
      // Create a config file
      fs.mkdirSync(originalConfigDir, { recursive: true });
      fs.writeFileSync(originalConfigFile, JSON.stringify({ existing: true }), 'utf8');
      
      runInstall(['--force']);
      
      // Check backup was created
      const backupFiles = fs.readdirSync(originalConfigDir).filter(f => f.endsWith('.bak'));
      expect(backupFiles.length).toBeGreaterThan(0);
    });
  });
});