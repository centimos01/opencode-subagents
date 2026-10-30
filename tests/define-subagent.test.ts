import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CLI_PATH = path.join(process.cwd(), 'dist', 'define-subagent.js');

describe('CLI: define-subagent', () => {
  const testDir = path.join(os.tmpdir(), 'opencode-subagent-test-' + Date.now());
  const projectAgentsDir = path.join(testDir, '.opencode', 'agents');

  beforeEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    fs.mkdirSync(projectAgentsDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  function escapeArg(arg: string): string {
    // Escape for shell - wrap in quotes if contains spaces or special chars
    if (/[\s"'\\]/.test(arg)) {
      return '"' + arg.replace(/"/g, '\\"') + '"';
    }
    return arg;
  }

  function runCli(args: string[], options: { cwd?: string; env?: Record<string, string> } = {}) {
    const env = { ...process.env, ...options.env };
    const cmd = `node "${CLI_PATH}" ${args.map(escapeArg).join(' ')}`;
    return execSync(cmd, {
      cwd: options.cwd || testDir,
      encoding: 'utf8',
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  function runCliJson(args: string[], options: { cwd?: string; env?: Record<string, string> } = {}) {
    try {
      const output = runCli(args, options);
      return JSON.parse(output.trim());
    } catch (error) {
      // `--doctor` exits with code 1 when the environment is not healthy
      // (for example, warnings because ~/.config/opencode does not exist),
      // but it still prints a valid JSON report on stdout.
      const stdout = (error as { stdout?: unknown }).stdout;
      if (args.includes('--doctor') && typeof stdout === 'string' && stdout.trim().startsWith('{')) {
        return JSON.parse(stdout.trim());
      }
      throw error;
    }
  }

  describe('--help', () => {
    it('shows help text in English', () => {
      const output = runCli(['--help']);
      expect(output).toContain('OpenCode Autonomous Subagent Manager');
      expect(output).toContain('--name');
      expect(output).toContain('--template');
      expect(output).toContain('--doctor');
    });

    it('shows help text in Spanish', () => {
      const output = runCli(['--help', '--lang', 'es']);
      expect(output).toContain('Gestor de Subagentes Autónomos');
      expect(output).toContain('--name');
    });
  });

  describe('--list', () => {
    it('lists empty project and global agents', () => {
      const result = runCliJson(['--list']);
      expect(result).toHaveProperty('global');
      expect(result).toHaveProperty('project');
      expect(result).toHaveProperty('hint');
      expect(Array.isArray(result.global)).toBe(true);
      expect(Array.isArray(result.project)).toBe(true);
    });
  });

  describe('--doctor', () => {
    it('runs health checks and returns JSON', () => {
      const result = runCliJson(['--doctor']);
      expect(result).toHaveProperty('overall');
      expect(result).toHaveProperty('checks');
      expect(Array.isArray(result.checks)).toBe(true);
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.overall);
      
      for (const check of result.checks) {
        expect(check).toHaveProperty('name');
        expect(check).toHaveProperty('status');
        expect(check).toHaveProperty('message');
        expect(['pass', 'fail', 'warn']).toContain(check.status);
      }
    });
  });

  describe('create subagent', () => {
    it('creates a subagent from template (api-tester)', () => {
      const result = runCliJson([
        '--name', 'my-api-tester',
        '--template', 'api-tester'
      ]);

      expect(result.status).toBe('success');
      expect(result.agent).toBe('my-api-tester');
      expect(result.filePath).toContain('.opencode' + path.sep + 'agents' + path.sep + 'my-api-tester.md');
      expect(result.scope).toBe('project');
      expect(result.cleanup_command).toContain('--remove');
      expect(result.cleanup_command).toContain('--dir');
      expect(result.how_to_invoke).toBeDefined();
      expect(result.how_to_invoke.tool).toBe('subagent');
      expect(result.how_to_invoke.agent).toBe('my-api-tester');
    });

    it('creates a subagent with custom options', () => {
      const result = runCliJson([
        '--name', 'custom-agent',
        '--description', 'My custom agent',
        '--prompt', 'You are a custom agent',
        '--preset', 'worker',
        '--mode', 'subagent'
      ]);

      expect(result.status).toBe('success');
      expect(result.agent).toBe('custom-agent');
    });

    it('creates a subagent globally with --global', () => {
      const globalDir = path.join(os.homedir(), '.config', 'opencode', 'agents');
      const uniqueName = 'global-agent-' + Date.now();
      const result = runCliJson([
        '--name', uniqueName,
        '--template', 'doc-writer',
        '--global'
      ]);

      expect(result.status).toBe('success');
      expect(result.scope).toBe('global');
      expect(result.filePath).toContain(globalDir);
      
      // Cleanup
      runCliJson(['--remove', uniqueName, '--global']);
    });

    it('fails when name already exists (without --force)', () => {
      // Create first
      runCliJson(['--name', 'duplicate', '--template', 'api-tester']);
      
      // Try to create again - should fail with agent_exists
      try {
        runCliJson([
          '--name', 'duplicate',
          '--template', 'doc-writer'
        ]);
        throw new Error('Should have failed');
      } catch (e: any) {
        // The CLI exits with code 1, so execSync throws
        // The error output contains the JSON response
        const output = e.stdout || e.stderr || e.message;
        const result = JSON.parse(output.trim());
        expect(result.status).toBe('error');
        expect(result.error).toBe('agent_exists');
        expect(result.cleanup_command).toBeDefined();
      }
    });

    it('overwrites with --force', () => {
      // Create first
      runCliJson(['--name', 'force-test', '--template', 'api-tester']);
      
      // Overwrite with force
      const result = runCliJson([
        '--name', 'force-test',
        '--template', 'doc-writer',
        '--force'
      ]);

      expect(result.status).toBe('success');
      expect(result.agent).toBe('force-test');
    });

    it('shows dry-run preview without creating file', () => {
      const result = runCliJson([
        '--name', 'dry-run-test',
        '--template', 'api-tester',
        '--dry-run'
      ]);

      // Dry run outputs to stdout, not JSON
      // Check that file doesn't exist
      const filePath = path.join(projectAgentsDir, 'dry-run-test.md');
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('sanitizes agent name', () => {
      const result = runCliJson([
        '--name', 'My Agent Name!',
        '--template', 'api-tester'
      ]);

      expect(result.agent).toBe('my-agent-name');
      const filePath = path.join(projectAgentsDir, 'my-agent-name.md');
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe('remove subagent', () => {
    it('removes a project subagent', () => {
      // Create first
      runCliJson(['--name', 'to-remove', '--template', 'api-tester']);
      
      // Remove
      const result = runCliJson(['--remove', 'to-remove']);
      
      expect(result.status).toBe('success');
      expect(result.agent).toBe('to-remove');
      expect(result.removedFile).toBeDefined();
      expect(result.reloaded).toBe(true);
      
      // Verify file is gone
      const filePath = path.join(projectAgentsDir, 'to-remove.md');
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('removes a global subagent', () => {
      const globalDir = path.join(os.homedir(), '.config', 'opencode', 'agents');
      
      // Create globally
      runCliJson(['--name', 'global-to-remove', '--template', 'api-tester', '--global']);
      
      // Remove with --global
      const result = runCliJson(['--remove', 'global-to-remove', '--global']);
      
      expect(result.status).toBe('success');
      expect(result.agent).toBe('global-to-remove');
      
      // Verify file is gone
      const filePath = path.join(globalDir, 'global-to-remove.md');
      expect(fs.existsSync(filePath)).toBe(false);
    });

    it('returns not_found for non-existent agent', () => {
      const result = runCliJson(['--remove', 'non-existent']);
      
      expect(result.status).toBe('not_found');
      expect(result.agent).toBe('non-existent');
      expect(result.hint).toContain('not found');
    });

    it('cleans up empty directories after removal', () => {
      runCliJson(['--name', 'cleanup-test', '--template', 'api-tester']);
      
      const result = runCliJson(['--remove', 'cleanup-test']);
      
      expect(result.prunedDirs).toBeDefined();
      // The .opencode/agents dir should be pruned if empty
    });
  });

  describe('template interpolation', () => {
    it('interpolates template variables', () => {
      const result = runCliJson([
        '--name', 'interpolated',
        '--template', 'api-tester'
      ]);

      // Check the file content has interpolated variables
      const filePath = path.join(projectAgentsDir, 'interpolated.md');
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Template should have project_root interpolated
      expect(content).not.toContain('{{project_root}}');
      expect(content).not.toContain('{{base_url}}');
    });
  });

  describe('error handling', () => {
    it('fails when --name is missing', () => {
      try {
        runCliJson(['--description', 'test', '--prompt', 'test']);
        throw new Error('Should have failed');
      } catch (e: any) {
        expect(e.stdout || e.stderr || e.message).toContain('name is required');
      }
    });

    it('fails when --description is missing (without template)', () => {
      try {
        runCliJson(['--name', 'test', '--prompt', 'test']);
        throw new Error('Should have failed');
      } catch (e: any) {
        expect(e.stdout || e.stderr || e.message).toContain('description is required');
      }
    });

    it('fails when --prompt is missing (without template)', () => {
      try {
        runCliJson(['--name', 'test', '--description', 'test']);
        throw new Error('Should have failed');
      } catch (e: any) {
        expect(e.stdout || e.stderr || e.message).toContain('prompt is required');
      }
    });

    it('fails with unknown preset', () => {
      try {
        runCliJson(['--name', 'test', '--description', 'test', '--prompt', 'test', '--preset', 'invalid']);
        throw new Error('Should have failed');
      } catch (e: any) {
        expect(e.stdout || e.stderr || e.message).toContain('unknown --preset');
      }
    });

    it('fails with unknown template', () => {
      try {
        runCliJson(['--name', 'test', '--template', 'unknown-template']);
        throw new Error('Should have failed');
      } catch (e: any) {
        expect(e.stdout || e.stderr || e.message).toContain('unknown --template');
      }
    });
  });
});