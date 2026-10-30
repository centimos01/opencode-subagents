/**
 * Type definitions for the OpenCode Subagents system
 */

export interface Permission {
  action: string;
  resource: string;
  effect: 'allow' | 'deny';
}

export interface Preset {
  readonly: Permission[];
  review: Permission[];
  test: Permission[];
  worker: Permission[];
}

export interface SubagentConfig {
  description: string;
  mode: string;
  model?: string;
  permissions?: Permission[];
}

export interface SubagentFile {
  id: string;
  file: string;
}

export interface ListResult {
  hint: string;
  global: SubagentFile[];
  project: SubagentFile[];
}

export interface CreateResponse {
  status: 'success' | 'error';
  agent?: string;
  mode?: string;
  filePath?: string;
  scope?: 'global' | 'project';
  reloaded?: boolean;
  how_to_invoke?: {
    tool: string;
    agent: string;
    example: string;
  };
  lifecycle?: string;
  cleanup_when?: string;
  cleanup_command?: string;
  error?: string;
  hint?: string;
}

export interface RemoveResponse {
  status: 'success' | 'not_found' | 'error';
  agent: string;
  removedFile?: string;
  configEntriesCleaned?: string[];
  prunedDirs?: string[];
  reloaded?: boolean;
  checkedFile?: string;
  hint?: string;
  error?: string;
}

export interface DoctorCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: string;
}

export interface DoctorResult {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: DoctorCheck[];
}

export interface Template {
  name: string;
  description: string;
  prompt: string;
  preset: 'readonly' | 'review' | 'test' | 'worker';
  variables?: Record<string, string>;
}

export interface InstallOptions {
  dryRun?: boolean;
  force?: boolean;
  global?: boolean;
}

export interface CliOptions {
  name?: string;
  description?: string;
  prompt?: string;
  model?: string;
  preset?: 'readonly' | 'review' | 'test' | 'worker';
  mode?: string;
  dir?: string;
  global?: boolean;
  list?: boolean;
  remove?: string;
  help?: boolean;
  template?: string;
  doctor?: boolean;
  dryRun?: boolean;
  force?: boolean;
  lang?: string;
}