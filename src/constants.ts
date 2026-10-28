/**
 * Constants and configuration for the OpenCode Subagents system
 */

import { Preset } from './types.js';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const HOME_DIR = os.homedir();
export const GLOBAL_CONFIG_DIR = join(HOME_DIR, '.config', 'opencode');
export const GLOBAL_AGENTS_DIR = join(GLOBAL_CONFIG_DIR, 'agents');
export const GLOBAL_CONFIG_FILE = join(GLOBAL_CONFIG_DIR, 'opencode.jsonc');
export const SCRIPT_PATH = __filename;
export const PROJECT_ROOT = join(__dirname, '..', '..');

export const PRESETS: Preset = {
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
  worker: [],
};

export const BUILTIN_AGENTS = ['fast-explorer', 'code-reviewer', 'test-runner', 'code-worker'] as const;

export const MESSAGES = {
  en: {
    help: `
OpenCode Autonomous Subagent Manager
Usage:
  define-subagent [options]

Options:
  --name, -n <string>         Subagent identifier (e.g. "perf-profiler", "doc-writer")
  --description, -d <string>  Clear summary of what the subagent does and when to call it
  --prompt, -p <string>       System instructions for the subagent
  --model, -m <string>        Optional model override
  --preset <string>           Permission preset: readonly, review, test, worker (default: readonly)
  --mode <string>             "subagent" (default), "primary", or "all"
  --global, -g                Save to global configuration instead of current project
  --list, -l                  List all existing subagents
  --remove, -r <string>       Delete an existing subagent (also cleans legacy config entries)
  --dir <path>                Agents directory to remove from (use the one printed by create)
  --template, -t <string>     Use a predefined template (api-tester, doc-writer, etc.)
  --doctor                    Run health checks on the OpenCode subagent setup
  --dry-run                   Preview changes without applying them
  --force                     Force overwrite existing subagent
  --lang <string>             Language for output (en, es) (default: en)
  --help, -h                  Show this help text

Lifecycle (no residue on disk):
  Subagents created on the fly are temporary. After the subagent completes its
  task, delete it with the cleanup_command printed by create (equivalent to
  "--remove <name> --dir <agentsDir>") so no files are left on disk.

Examples:
  # Create a temporary read-only explorer
  define-subagent --name "my-explorer" --description "Finds React components" --prompt "Find all React components in the codebase" --preset readonly

  # Create from template
  define-subagent --name "api-tester" --template api-tester

  # List all subagents
  define-subagent --list

  # Remove a subagent
  define-subagent --remove "my-explorer" --dir ".opencode/agents"

  # Run health checks
  define-subagent --doctor
`,
    agentExists: 'A file with this name already exists and was NOT modified. If it is a leftover temporary subagent, delete it with cleanup_command and retry; otherwise choose a different --name.',
    nameRequired: 'Error: --name is required.',
    descriptionRequired: 'Error: --description is required (unless using --template).',
    promptRequired: 'Error: --prompt is required (unless using --template).',
    unknownPreset: (preset: string) => `Error: unknown --preset "${preset}". Use one of: readonly, review, test, worker.`,
    unknownTemplate: (template: string) => `Error: unknown --template "${template}". Available: api-tester, doc-writer, security-auditor, perf-profiler, database-optimizer, dependency-updater, migration-helper, code-migrator.`,
    unknownModel: (model: string) => `Warning: model "${model}" not recognized. Common OpenCode models: openrouter/anthropic/claude-3.5-sonnet, openrouter/openai/gpt-4o, openrouter/google/gemini-1.5-pro.`,
    createdSuccess: (name: string) => `✓ Subagent "${name}" created successfully`,
    removedSuccess: (name: string) => `✓ Subagent "${name}" removed successfully`,
    notFound: (name: string) => `Subagent "${name}" not found (no file and no legacy config entry).`,
    reloaded: '✓ OpenCode configuration reloaded',
    reloadFailed: '⚠ Could not reload OpenCode (service might not be running)',
    cleanupCommand: (cmd: string) => `Cleanup command: ${cmd}`,
    listHint: 'Subagents created on the fly are temporary: once one is no longer needed, delete it with "--remove <id> --dir <agentsDir>" (or the cleanup_command printed by create) so no files are left on disk.',
  },
  es: {
    help: `
Gestor de Subagentes Autónomos de OpenCode
Uso:
  define-subagent [opciones]

Opciones:
  --name, -n <string>         Identificador del subagente (ej. "perf-profiler", "doc-writer")
  --description, -d <string>  Resumen claro de qué hace el subagente y cuándo invocarlo
  --prompt, -p <string>       Instrucciones del sistema para el subagente
  --model, -m <string>        Modelo opcional a usar
  --preset <string>           Preset de permisos: readonly, review, test, worker (default: readonly)
  --mode <string>             "subagent" (default), "primary", o "all"
  --global, -g                Guardar en configuración global en lugar del proyecto actual
  --list, -l                  Listar todos los subagentes existentes
  --remove, -r <string>       Eliminar un subagente existente (también limpia entradas legacy)
  --dir <path>                Directorio de agentes para eliminar (el que imprime create)
  --template, -t <string>     Usar plantilla predefinida (api-tester, doc-writer, etc.)
  --doctor                    Ejecutar verificaciones de salud en la configuración
  --dry-run                   Vista previa de cambios sin aplicarlos
  --force                     Forzar sobrescritura de subagente existente
  --lang <string>             Idioma de salida (en, es) (default: en)
  --help, -h                  Mostrar esta ayuda

Ciclo de vida (sin residuos en disco):
  Los subagentes creados al vuelo son temporales. Tras completar su tarea,
  bórralos con el cleanup_command que imprime create (equivalente a
  "--remove <name> --dir <agentsDir>") para no dejar archivos.

Ejemplos:
  # Crear explorador temporal de solo lectura
  define-subagent --name "mi-explorador" --description "Encuentra componentes React" --prompt "Encuentra todos los componentes React" --preset readonly

  # Crear desde plantilla
  define-subagent --name "api-tester" --template api-tester

  # Listar subagentes
  define-subagent --list

  # Eliminar subagente
  define-subagent --remove "mi-explorador" --dir ".opencode/agents"

  # Verificaciones de salud
  define-subagent --doctor
`,
    agentExists: 'Ya existe un archivo con este nombre y NO fue modificado. Si es un subagente temporal residual, bórralo con cleanup_command y reintenta; en caso contrario elige otro --name.',
    nameRequired: 'Error: --name es requerido.',
    descriptionRequired: 'Error: --description es requerido (a menos que uses --template).',
    promptRequired: 'Error: --prompt es requerido (a menos que uses --template).',
    unknownPreset: (preset: string) => `Error: --preset "${preset}" desconocido. Usa: readonly, review, test, worker.`,
    unknownTemplate: (template: string) => `Error: --template "${template}" desconocido. Disponibles: api-tester, doc-writer, security-auditor, perf-profiler, database-optimizer, dependency-updater, migration-helper, code-migrator.`,
    unknownModel: (model: string) => `Advertencia: modelo "${model}" no reconocido. Modelos comunes: openrouter/anthropic/claude-3.5-sonnet, openrouter/openai/gpt-4o, openrouter/google/gemini-1.5-pro.`,
    createdSuccess: (name: string) => `✓ Subagente "${name}" creado exitosamente`,
    removedSuccess: (name: string) => `✓ Subagente "${name}" eliminado exitosamente`,
    notFound: (name: string) => `Subagente "${name}" no encontrado (sin archivo ni entrada legacy).`,
    reloaded: '✓ Configuración de OpenCode recargada',
    reloadFailed: '⚠ No se pudo recargar OpenCode (el servicio podría no estar corriendo)',
    cleanupCommand: (cmd: string) => `Comando de limpieza: ${cmd}`,
    listHint: 'Los subagentes creados al vuelo son temporales: cuando ya no se necesiten, bórralos con "--remove <id> --dir <agentsDir>" (o el cleanup_command que imprime create) para no dejar archivos.',
  },
} as const;

export type Language = keyof typeof MESSAGES;
export type MessageKey = keyof typeof MESSAGES.en;

export function getMessage(lang: Language, key: MessageKey, ...args: unknown[]): string {
  const msg = MESSAGES[lang][key] ?? MESSAGES.en[key];
  if (typeof msg === 'function') {
    return (msg as (...args: unknown[]) => string)(...args);
  }
  return msg;
}

export const KNOWN_MODELS = [
  'openrouter/anthropic/claude-3.5-sonnet',
  'openrouter/anthropic/claude-3.5-haiku',
  'openrouter/anthropic/claude-3-opus',
  'openrouter/openai/gpt-4o',
  'openrouter/openai/gpt-4o-mini',
  'openrouter/google/gemini-1.5-pro',
  'openrouter/google/gemini-1.5-flash',
  'openrouter/meta-llama/llama-3.1-405b',
  'openrouter/meta-llama/llama-3.1-70b',
] as const;