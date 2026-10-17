# Guía de Implementación: Subagentes Autónomos en OpenCode v2

Esta guía contiene la arquitectura, el código y las instrucciones paso a paso para replicar en cualquier ordenador el sistema de **subagentes autónomos y de alta velocidad** para OpenCode.

Con este sistema, **la propia IA de OpenCode puede crear sus propios subagentes a medida que los necesita** (igual que Claude / Antigravity), ejecutando tareas especializadas en sesiones secundarias aisladas para responder mucho más rápido y evitar saturar la ventana de contexto.

---

## 📁 1. Estructura de Carpetas en el Sistema

En cualquier sistema operativo, OpenCode utiliza el directorio de configuración global de usuario:

- **Windows:** `C:\Users\<Usuario>\.config\opencode\` (o `%USERPROFILE%\.config\opencode\`)
- **macOS / Linux:** `~/.config/opencode/`

La estructura que debe quedar configurada es:

```text
.config/opencode/
├── agents/                       <-- Definiciones Markdown de subagentes globales
│   ├── fast-explorer.md          <-- Búsqueda y lectura ultrarrápida (solo lectura)
│   ├── code-reviewer.md          <-- Revisión estricta de diffs y seguridad (solo lectura)
│   ├── test-runner.md            <-- Ejecución y diagnóstico de tests
│   └── code-worker.md            <-- Implementación de tareas de código en paralelo
├── instructions/
│   └── autonomous-subagents.md   <-- Instrucciones de sistema que enseñan a la IA a crear subagentes
├── scripts/
│   └── define-subagent.mjs       <-- Script CLI/Node para que la IA cree subagentes en 1 comando
├── skills/
│   └── autonomous-subagents/
│       └── SKILL.md              <-- Skill nativo invocable con la tool 'skill'
└── opencode.jsonc                <-- Configuración principal que activa instrucciones y agentes
```

---

## ⚡ 2. Instalación Rápida en tu otro PC

Hemos incluido instaladores automáticos en esta carpeta. Solo tienes que copiar la carpeta `opencode-subagents-setup` a tu otro PC y ejecutar:

### En Windows (PowerShell):
Abre PowerShell en esta carpeta y ejecuta:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\install.ps1
```

### En macOS / Linux (Terminal):
Abre la terminal en esta carpeta y ejecuta:
```bash
chmod +x install.sh
./install.sh
```

El script creará todas las carpetas, copiará los archivos a `~/.config/opencode/`, configurará `opencode.jsonc` y recargará OpenCode automáticamente.

---

## 🛠️ 3. Instalación Manual Paso a Paso

Si prefieres hacerlo manualmente en el nuevo PC, sigue estos sencillos pasos:

### Paso 1: Crear las carpetas necesarias
En PowerShell:
```powershell
New-Item -ItemType Directory -Force -Path `
  "$HOME\.config\opencode\agents", `
  "$HOME\.config\opencode\instructions", `
  "$HOME\.config\opencode\scripts", `
  "$HOME\.config\opencode\skills\autonomous-subagents"
```

### Paso 2: Crear el script de creación dinámica (`scripts/define-subagent.mjs`)
Crea el archivo `~/.config/opencode/scripts/define-subagent.mjs`:
```javascript
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import os from 'node:os';

const HOME_DIR = os.homedir();
const GLOBAL_CONFIG_DIR = path.join(HOME_DIR, '.config', 'opencode');
const GLOBAL_AGENTS_DIR = path.join(GLOBAL_CONFIG_DIR, 'agents');
const GLOBAL_CONFIG_FILE = path.join(GLOBAL_CONFIG_DIR, 'opencode.jsonc');

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
  worker: [],
};

function parseArgs() {
  const args = process.argv.slice(2);
  const options = { preset: 'readonly', mode: 'subagent', global: false };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--name' || arg === '-n') options.name = args[++i];
    else if (arg === '--description' || arg === '-d') options.description = args[++i];
    else if (arg === '--prompt' || arg === '-p') options.prompt = args[++i];
    else if (arg === '--model' || arg === '-m') options.model = args[++i];
    else if (arg === '--preset') options.preset = args[++i];
    else if (arg === '--mode') options.mode = args[++i];
    else if (arg === '--global' || arg === '-g') options.global = true;
    else if (arg === '--list' || arg === '-l') options.list = true;
    else if (arg === '--remove' || arg === '-r') options.remove = args[++i];
  }
  return options;
}

function main() {
  const options = parseArgs();
  const cwd = process.cwd();

  if (options.list) {
    const list = fs.existsSync(GLOBAL_AGENTS_DIR) ? fs.readdirSync(GLOBAL_AGENTS_DIR) : [];
    console.log(JSON.stringify({ agents: list }, null, 2));
    return;
  }

  if (!options.name || !options.description) {
    console.error('Error: --name y --description son obligatorios.');
    process.exit(1);
  }

  const cleanName = options.name.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const targetDir = options.global ? GLOBAL_AGENTS_DIR : path.join(cwd, '.opencode', 'agents');
  fs.mkdirSync(targetDir, { recursive: true });

  const perms = PRESETS[options.preset] || [];
  let md = `---\ndescription: "${options.description.replace(/"/g, '\\"')}"\nmode: ${options.mode || 'subagent'}\n`;
  if (options.model) md += `model: ${options.model}\n`;
  if (perms.length > 0) {
    md += 'permissions:\n';
    for (const p of perms) {
      md += `  - action: ${p.action}\n    resource: "${p.resource}"\n    effect: ${p.effect}\n`;
    }
  }
  md += `---\n\n${(options.prompt || `Subagente: ${cleanName}`).trim()}\n`;

  const filePath = path.join(targetDir, `${cleanName}.md`);
  fs.writeFileSync(filePath, md, 'utf8');

  try { execSync('opencode reload', { stdio: 'pipe' }); } catch {}

  console.log(JSON.stringify({
    status: 'success',
    agent: cleanName,
    filePath,
    how_to_invoke: `subagent(agent: "${cleanName}", description: "${options.description}", prompt: "...")`
  }, null, 2));
}

main();
```

### Paso 3: Crear las instrucciones para la IA (`instructions/autonomous-subagents.md`)
Crea el archivo `~/.config/opencode/instructions/autonomous-subagents.md`.  
*(Puedes copiar directamente el archivo que se encuentra en la subcarpeta `instructions/` de este paquete).*

Este archivo enseña a la IA:
- Cuándo debe delegar trabajo para no ralentizar el chat.
- Cómo ejecutar `define-subagent.mjs` con su herramienta `shell`.
- Cómo invocar el subagente recién creado con la herramienta `subagent`.

### Paso 4: Crear el Skill nativo (`skills/autonomous-subagents/SKILL.md`)
Crea el archivo `~/.config/opencode/skills/autonomous-subagents/SKILL.md`.  
*(Copia el archivo ubicado en `skills/autonomous-subagents/SKILL.md` de este paquete).*

### Paso 5: Copiar los subagentes base (`agents/*.md`)
Copia los 4 archivos markdown (`fast-explorer.md`, `code-reviewer.md`, `test-runner.md`, `code-worker.md`) dentro de `~/.config/opencode/agents/`.

### Paso 6: Configurar `opencode.jsonc`
Edita o crea `~/.config/opencode/opencode.jsonc` agregando la clave `"instructions"`:
```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": [
    // Pon aquí la ruta absoluta hacia autonomous-subagents.md:
    "C:\\Users\\<TuUsuario>\\.config\\opencode\\instructions\\autonomous-subagents.md"
  ]
}
```

### Paso 7: Recargar OpenCode
Ejecuta en tu terminal:
```bash
opencode reload
```

---

## 🚀 4. ¿Cómo crea y usa los subagentes la IA?

### A. La IA crea un subagente por sí sola
Cuando la IA decide que necesita un asistente especializado (por ejemplo, para depurar bases de datos o migrar componentes), ejecuta internamente mediante `shell`:

```bash
node C:/Users/<Usuario>/.config/opencode/scripts/define-subagent.mjs \
  --name "database-debugger" \
  --description "Analiza consultas SQL lentas y optimiza índices" \
  --prompt "Eres un experto en PostgreSQL. Analiza el esquema y las consultas dadas..." \
  --preset readonly
```

El script:
1. Crea el archivo de agente con frontmatter y prompt.
2. Aplica el preset de seguridad (`readonly` bloquea escrituras y comandos para máxima velocidad).
3. Ejecuta `opencode reload` para que OpenCode lo registre al instante.
4. Devuelve a la IA la confirmación con la sintaxis exacta de invocación.

### B. La IA invoca al subagente
Inmediatamente después de crearlo (o usando los predeterminados), la IA llama a la herramienta nativa:

```json
{
  "agent": "database-debugger",
  "description": "Optimizar consulta de pedidos por fecha",
  "prompt": "Revisa la consulta en src/db/orders.ts y sugiere índices compuestos."
}
```

El subagente se ejecuta en una **sesión hija con contexto limpio**, resuelve la tarea y le devuelve a la IA principal un resumen concreto, sin llenar el chat principal de tokens innecesarios.

---

## 🏎️ 5. Presets Disponibles para la IA

| Preset | Permisos denegados | Cuándo usarlo |
| :--- | :--- | :--- |
| `readonly` | `edit`, `write`, `patch`, `shell` | Para exploración de archivos, búsquedas, lectura de documentación. Es el más rápido y seguro. |
| `review` | `edit`, `write`, `patch`, `shell` | Para revisiones de código, auditorías de seguridad y pull requests. |
| `test` | `edit`, `write`, `patch` (Permite `shell`) | Para ejecutar tests, linters y diagnósticos sin alterar código. |
| `worker` | Ninguno (herramientas completas) | Para escribir código o aplicar cambios en paralelo. |

---

## ✅ 6. Comprobación de que todo funciona

Para comprobar que el sistema está activo en tu nuevo PC:
1. Lista los subagentes registrados:
   ```bash
   node C:/Users/<Usuario>/.config/opencode/scripts/define-subagent.mjs --list
   ```
2. Consulta la configuración activa en el servidor:
   ```bash
   opencode api GET /api/config
   ```
3. En cualquier chat de OpenCode, puedes pedirle a la IA:
   > *"Crea un subagente para auditar accesibilidad web y úsalo para revisar mi archivo index.html"*
   La IA creará el subagente `a11y-auditor` sobre la marcha y lo ejecutará.
