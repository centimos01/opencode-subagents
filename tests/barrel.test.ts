import { describe, it, expect } from 'vitest';

describe('Barrel Export (src/index.ts)', () => {
  it('exports constants from constants.ts', async () => {
    const mod = await import('../src/index.js');
    
    expect(mod.HOME_DIR).toBeDefined();
    expect(mod.GLOBAL_CONFIG_DIR).toBeDefined();
    expect(mod.GLOBAL_AGENTS_DIR).toBeDefined();
    expect(mod.GLOBAL_CONFIG_FILE).toBeDefined();
    expect(mod.SCRIPT_PATH).toBeDefined();
    expect(mod.PROJECT_ROOT).toBeDefined();
    expect(mod.PRESETS).toBeDefined();
    expect(mod.BUILTIN_AGENTS).toBeDefined();
    expect(mod.MESSAGES).toBeDefined();
    expect(typeof mod.getMessage).toBe('function');
    expect(mod.KNOWN_MODELS).toBeDefined();
  });

  it('exports all utils from utils-core.ts and utils.ts', async () => {
    const mod = await import('../src/index.js');
    
    expect(typeof mod.sanitizeName).toBe('function');
    expect(typeof mod.samePath).toBe('function');
    expect(typeof mod.quote).toBe('function');
    expect(typeof mod.cleanupCommand).toBe('function');
    expect(typeof mod.stripJsonc).toBe('function');
    expect(typeof mod.tryParseJsoncFile).toBe('function');
    expect(typeof mod.cleanConfigEntries).toBe('function');
    expect(typeof mod.pruneEmptyDirs).toBe('function');
    expect(typeof mod.projectRootFromAgentsDir).toBe('function');
    expect(typeof mod.runOpencodeReload).toBe('function');
    expect(typeof mod.isOpencodeInstalled).toBe('function');
    expect(typeof mod.getOpencodeVersion).toBe('function');
  });

  it('exports all templates from templates/index.ts', async () => {
    const mod = await import('../src/index.js');
    
    expect(mod.TEMPLATES).toBeDefined();
    expect(typeof mod.getTemplate).toBe('function');
    expect(typeof mod.listTemplates).toBe('function');
    expect(typeof mod.interpolateTemplate).toBe('function');
  });

  it('has 8 predefined templates', async () => {
    const mod = await import('../src/index.js');
    
    const templates = mod.listTemplates();
    expect(templates).toHaveLength(8);
    expect(templates).toContain('api-tester');
    expect(templates).toContain('doc-writer');
    expect(templates).toContain('security-auditor');
    expect(templates).toContain('perf-profiler');
    expect(templates).toContain('database-optimizer');
    expect(templates).toContain('dependency-updater');
    expect(templates).toContain('migration-helper');
    expect(templates).toContain('code-migrator');
  });
});