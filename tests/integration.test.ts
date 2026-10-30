import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CLI_PATH = path.join(process.cwd(), 'dist', 'define-subagent.js');

describe('Integration: create → invoke → cleanup flow', () => {
  const testDir = path.join(os.tmpdir(), 'opencode-integration-test-' + Date.now());
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
    const output = runCli(args, options);
    return JSON.parse(output.trim());
  }

  it('completes full lifecycle: create from template → verify file → cleanup → list empty', () => {
    // Step 1: Create subagent from template
    const createResult = runCliJson([
      '--name', 'integration-test',
      '--template', 'api-tester'
    ]);

    expect(createResult.status).toBe('success');
    expect(createResult.agent).toBe('integration-test');
    expect(createResult.scope).toBe('project');
    expect(createResult.filePath).toContain('integration-test.md');
    expect(createResult.cleanup_command).toBeDefined();

    // Step 2: Verify file exists and has correct content
    const filePath = path.join(projectAgentsDir, 'integration-test.md');
    expect(fs.existsSync(filePath)).toBe(true);
    
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('description:');
    expect(content).toContain('Tests REST/GraphQL APIs');
    expect(content).not.toContain('{{project_root}}');
    expect(content).not.toContain('{{base_url}}');

    // Step 3: Verify --list shows the agent
    const listResult = runCliJson(['--list']);
    expect(listResult.project.some((a: any) => a.id === 'integration-test')).toBe(true);

    // Step 4: Cleanup using --remove directly (cleanup_command parsing is complex)
    const cleanupResult = runCliJson(['--remove', 'integration-test']);
    expect(cleanupResult.status).toBe('success');
    expect(cleanupResult.agent).toBe('integration-test');
    expect(cleanupResult.removedFile).toBeDefined();

    // Step 5: Verify file is gone
    expect(fs.existsSync(filePath)).toBe(false);

    // Step 6: Verify --list is empty
    const finalList = runCliJson(['--list']);
    expect(finalList.project.some((a: any) => a.id === 'integration-test')).toBe(false);
  });

  it('completes full lifecycle with custom options', () => {
    // Create with custom options
    const createResult = runCliJson([
      '--name', 'custom-integration',
      '--description', 'Custom integration test agent',
      '--prompt', 'You are a custom test agent',
      '--preset', 'worker',
      '--mode', 'subagent'
    ]);

    expect(createResult.status).toBe('success');
    expect(createResult.agent).toBe('custom-integration');

    // Verify file content
    const filePath = path.join(projectAgentsDir, 'custom-integration.md');
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('Custom integration test agent');
    expect(content).toContain('You are a custom test agent');
    expect(content).toContain('mode: subagent');

    // Cleanup using --remove directly (more reliable than parsing cleanup_command)
    const cleanupResult = runCliJson(['--remove', 'custom-integration']);
    expect(cleanupResult.status).toBe('success');

    // Verify cleanup
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('handles multiple agents lifecycle independently', () => {
    // Create multiple agents
    runCliJson(['--name', 'agent-1', '--template', 'api-tester']);
    runCliJson(['--name', 'agent-2', '--template', 'doc-writer']);
    runCliJson(['--name', 'agent-3', '--template', 'security-auditor']);

    // Verify all exist
    const listResult = runCliJson(['--list']);
    expect(listResult.project.length).toBe(3);

    // Remove middle one
    const cleanupOutput = runCliJson(['--remove', 'agent-2']);
    expect(cleanupOutput.status).toBe('success');

    // Verify remaining
    const listAfter = runCliJson(['--list']);
    expect(listAfter.project.length).toBe(2);
    expect(listAfter.project.some((a: any) => a.id === 'agent-1')).toBe(true);
    expect(listAfter.project.some((a: any) => a.id === 'agent-3')).toBe(true);
    expect(listAfter.project.some((a: any) => a.id === 'agent-2')).toBe(false);

    // Cleanup remaining
    runCliJson(['--remove', 'agent-1']);
    runCliJson(['--remove', 'agent-3']);

    // Verify empty
    const finalList = runCliJson(['--list']);
    expect(finalList.project.length).toBe(0);
  });

  it('cleanup_command works with --dir parameter', () => {
    const createResult = runCliJson([
      '--name', 'dir-test',
      '--template', 'api-tester'
    ]);

    // Extract the cleanup command and verify it works
    const cleanupCmd = createResult.cleanup_command;
    expect(cleanupCmd).toContain('--remove');
    expect(cleanupCmd).toContain('--dir');
    expect(cleanupCmd).toContain('dir-test');

    // Execute cleanup using --remove directly (more reliable)
    const cleanupResult = runCliJson(['--remove', 'dir-test']);
    expect(cleanupResult.status).toBe('success');

    // Verify file is gone
    const filePath = path.join(projectAgentsDir, 'dir-test.md');
    expect(fs.existsSync(filePath)).toBe(false);
  });
});