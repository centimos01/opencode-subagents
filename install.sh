#!/usr/bin/env bash
set -e

echo "=========================================================="
echo "   Instalador de Subagentes Autónomos para OpenCode v2    "
echo "=========================================================="

OPENCODE_CONFIG="$HOME/.config/opencode"
DEST_SCRIPTS="$OPENCODE_CONFIG/scripts"
DEST_INSTRUCTIONS="$OPENCODE_CONFIG/instructions"
DEST_SKILLS="$OPENCODE_CONFIG/skills/autonomous-subagents"
DEST_AGENTS="$OPENCODE_CONFIG/agents"
CONFIG_FILE="$OPENCODE_CONFIG/opencode.jsonc"

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "1. Creando directorios en $OPENCODE_CONFIG..."
mkdir -p "$DEST_SCRIPTS" "$DEST_INSTRUCTIONS" "$DEST_SKILLS" "$DEST_AGENTS"

echo "2. Copiando script define-subagent.mjs..."
cp "$SRC_DIR/scripts/define-subagent.mjs" "$DEST_SCRIPTS/"
chmod +x "$DEST_SCRIPTS/define-subagent.mjs"

echo "3. Copiando instrucciones y skills..."
cp "$SRC_DIR/instructions/autonomous-subagents.md" "$DEST_INSTRUCTIONS/"
cp "$SRC_DIR/skills/autonomous-subagents/SKILL.md" "$DEST_SKILLS/"

echo "4. Copiando subagentes globales predeterminados..."
cp "$SRC_DIR/agents/"*.md "$DEST_AGENTS/"

echo "5. Configurando $CONFIG_FILE..."
if [ ! -f "$CONFIG_FILE" ]; then
    cp "$SRC_DIR/opencode.example.jsonc" "$CONFIG_FILE"
    sed -i "s|C:\\\\Users\\\\chris\\\\.config\\\\opencode\\\\instructions\\\\autonomous-subagents.md|$DEST_INSTRUCTIONS/autonomous-subagents.md|g" "$CONFIG_FILE" || true
    echo "   Archivo $CONFIG_FILE creado exitosamente."
else
    echo "   El archivo $CONFIG_FILE ya existe. Comprueba que contenga la clave 'instructions' apuntando a $DEST_INSTRUCTIONS/autonomous-subagents.md."
fi

echo "6. Recargando configuración de OpenCode..."
if command -v opencode >/dev/null 2>&1; then
    opencode reload || true
fi

echo "¡Instalación completada con éxito!"
