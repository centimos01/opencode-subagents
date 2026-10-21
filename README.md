# Subagentes Autónomos en OpenCode v2

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

### Paso 2: Copiar el script de creación dinámica (`scripts/define-subagent.mjs`)
Copia el archivo `scripts/define-subagent.mjs` de este paquete a `~/.config/opencode/scripts/`.

Cada subagente creado sobre la marcha es **temporal**: el script devuelve un `cleanup_command` que la IA ejecuta al terminar la tarea para borrar el archivo y no dejar residuos en el disco (ver sección 4).

Uso rápido:
```bash
# Crear un subagente temporal para el proyecto actual:
node C:/Users/<Usuario>/.config/opencode/scripts/define-subagent.mjs \
  --name "database-debugger" \
  --description "Analiza consultas SQL lentas y optimiza índices" \
  --prompt "Eres un experto en PostgreSQL..." \
  --preset readonly

# Borrarlo después de usarlo (deja el disco limpio):
node C:/Users/<Usuario>/.config/opencode/scripts/define-subagent.mjs --remove "database-debugger"
```

*Si ejecutas el borrado desde otra carpeta, añade `--dir "<ruta a .opencode/agents del proyecto>"`; al crear un subagente el propio script imprime el comando exacto en `cleanup_command`. `--list` muestra los subagentes existentes y `--global` los guarda para todos los proyectos.*

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
4. Devuelve a la IA la sintaxis exacta de invocación y el `cleanup_command` para borrarlo después.

*(El archivo Markdown es suficiente para el registro: el script ya no modifica `opencode.jsonc`, así no ensucia tu configuración.)*

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

### C. La IA borra el subagente temporal (sin residuos)
Los subagentes creados sobre la marcha son **temporales**. Justo después de recibir el resultado, la IA ejecuta el `cleanup_command` que devolvió el script (equivale a `--remove "<nombre>" --dir "<carpeta>"`). Ese comando:
1. Borra el archivo `.md` del subagente.
2. Limpia cualquier entrada antigua `agents.<nombre>` que versiones anteriores hubieran escrito en `opencode.jsonc`.
3. Elimina las carpetas `.opencode/agents` si quedaron vacías.

Así no se acumula basura en el proyecto: cada subagente temporal nace y desaparece en la misma tarea.

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
   La IA creará el subagente `a11y-auditor` sobre la marcha, lo ejecutará y lo borrará al terminar, sin dejar archivos.
4. Comprueba que no quedan residuos:
   ```bash
   node C:/Users/<Usuario>/.config/opencode/scripts/define-subagent.mjs --list
   ```
   Tras terminar la tarea, el subagente temporal ya no debe aparecer en `project` y no debe quedar ninguna carpeta `.opencode/agents` sobrante en el proyecto.
