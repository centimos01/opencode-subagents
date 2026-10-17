# install.ps1 - Instalador automático del sistema de subagentes para OpenCode en Windows
$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   Instalador de Subagentes Autonomos para OpenCode v2    " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$HOME_DIR = [System.Environment]::GetFolderPath('UserProfile')
$OPENCODE_CONFIG = Join-Path $HOME_DIR ".config\opencode"

$DEST_SCRIPTS = Join-Path $OPENCODE_CONFIG "scripts"
$DEST_INSTRUCTIONS = Join-Path $OPENCODE_CONFIG "instructions"
$DEST_SKILLS = Join-Path $OPENCODE_CONFIG "skills\autonomous-subagents"
$DEST_AGENTS = Join-Path $OPENCODE_CONFIG "agents"
$CONFIG_FILE = Join-Path $OPENCODE_CONFIG "opencode.jsonc"

$SRC_DIR = $PSScriptRoot

Write-Host "`n1. Creando directorios en $OPENCODE_CONFIG..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $DEST_SCRIPTS | Out-Null
New-Item -ItemType Directory -Force -Path $DEST_INSTRUCTIONS | Out-Null
New-Item -ItemType Directory -Force -Path $DEST_SKILLS | Out-Null
New-Item -ItemType Directory -Force -Path $DEST_AGENTS | Out-Null

Write-Host "2. Copiando script define-subagent.mjs..." -ForegroundColor Yellow
Copy-Item (Join-Path $SRC_DIR "scripts\define-subagent.mjs") $DEST_SCRIPTS -Force

Write-Host "3. Copiando instrucciones y skills..." -ForegroundColor Yellow
Copy-Item (Join-Path $SRC_DIR "instructions\autonomous-subagents.md") $DEST_INSTRUCTIONS -Force
Copy-Item (Join-Path $SRC_DIR "skills\autonomous-subagents\SKILL.md") $DEST_SKILLS -Force

Write-Host "4. Copiando subagentes globales predeterminados..." -ForegroundColor Yellow
Copy-Item (Join-Path $SRC_DIR "agents\*.md") $DEST_AGENTS -Force

Write-Host "5. Configurando $CONFIG_FILE..." -ForegroundColor Yellow
$instructionPath = (Join-Path $DEST_INSTRUCTIONS "autonomous-subagents.md").Replace("\", "\\")

if (-not (Test-Path $CONFIG_FILE)) {
    # Si no existe, crear a partir de la plantilla
    $example = Get-Content (Join-Path $SRC_DIR "opencode.example.jsonc") -Raw
    $example = $example.Replace("C:\\Users\\chris\\.config\\opencode\\instructions\\autonomous-subagents.md", $instructionPath)
    Set-Content -Path $CONFIG_FILE -Value $example -Encoding UTF8
    Write-Host "   Archivo $CONFIG_FILE creado exitosamente." -ForegroundColor Green
} else {
    # Si ya existe, asegurar instrucciones y agentes
    Write-Host "   El archivo $CONFIG_FILE ya existe. Comprueba manualmente que tenga la clave 'instructions' apuntando a $instructionPath." -ForegroundColor Cyan
}

Write-Host "`n6. Recargando configuracion de OpenCode..." -ForegroundColor Yellow
try {
    & opencode reload
    Write-Host "   OpenCode recargado correctamente." -ForegroundColor Green
} catch {
    Write-Host "   Aviso: No se pudo ejecutar 'opencode reload'. Si OpenCode no esta corriendo, se aplicara en el siguiente arranque." -ForegroundColor Gray
}

Write-Host "`nInstalacion completada con exito!" -ForegroundColor Green
Write-Host "La IA ahora podra crear y utilizar subagentes sobre la marcha." -ForegroundColor Cyan
