# Troubleshooting Guide

Common issues and solutions for OpenCode Subagents.

## Table of Contents

- [Installation Issues](#installation-issues)
- [CLI Issues](#cli-issues)
- [Agent Issues](#agent-issues)
- [Permission Issues](#permission-issues)
- [Configuration Issues](#configuration-issues)
- [Platform-Specific Issues](#platform-specific-issues)
- [Debugging](#debugging)

---

## Installation Issues

### "opencode-subagents-install: command not found"

**Cause**: The package isn't installed globally or not in PATH.

**Solution**:
```bash
# Install globally
npm install -g opencode-subagents

# Or use npx
npx opencode-subagents-install

# Verify
which opencode-subagents-install
```

### "OpenCode CLI not found in PATH"

**Cause**: OpenCode is not installed or not in system PATH.

**Solution**:
```bash
# Install OpenCode from https://opencode.ai
# Verify installation
opencode --version

# If installed but not in PATH, add to PATH:
# Windows: Add to System Environment Variables
# macOS/Linux: Add to ~/.bashrc or ~/.zshrc
export PATH="$PATH:/path/to/opencode"
```

### "Permission denied" during install

**Cause**: Insufficient permissions to write to global config directory.

**Solution**:
```bash
# Run with appropriate permissions
# Windows: Run PowerShell as Administrator
# macOS/Linux: Check directory ownership
ls -la ~/.config/opencode

# Fix ownership if needed
sudo chown -R $USER:$USER ~/.config/opencode
```

---

## CLI Issues

### "agent_exists" error when creating

**Cause**: An agent file with that name already exists.

**Solution**:
```bash
# Option 1: Remove the existing agent first
define-subagent --remove "agent-name" --dir ".opencode/agents"

# Option 2: Use --force to overwrite
define-subagent --name "agent-name" --template api-tester --force

# Option 3: Choose a different name
define-subagent --name "agent-name-2" --template api-tester
```

### "unknown --template" error

**Cause**: Template name doesn't match any built-in template.

**Solution**:
```bash
# List available templates
define-subagent --help
# Shows: api-tester, doc-writer, security-auditor, perf-profiler, 
#        database-optimizer, dependency-updater, migration-helper, code-migrator

# Use exact template name (case-sensitive)
define-subagent --name test --template api-tester  # ✓
define-subagent --name test --template API-TESTER  # ✗
```

### "unknown --preset" error

**Cause**: Invalid permission preset.

**Solution**:
```bash
# Valid presets: readonly, review, test, worker
define-subagent --name test --template api-tester --preset readonly
```

### "name is required" / "description is required" / "prompt is required"

**Cause**: Required arguments missing when not using a template.

**Solution**:
```bash
# When NOT using --template, all three are required:
define-subagent \
  --name "my-agent" \
  --description "What it does" \
  --prompt "System instructions"

# When using --template, they're optional (template provides defaults):
define-subagent --name "my-agent" --template api-tester
```

### Cleanup command doesn't work

**Cause**: The cleanup_command contains quoted paths that don't parse correctly when copied.

**Solution**:
```bash
# Copy the EXACT cleanup_command output (including quotes)
# Example output:
# cleanup_command: "node \"C:\path\define-subagent.js\" --remove \"agent\" --dir \"C:\path\.opencode\agents\""

# Run it exactly as shown, or use --remove directly:
define-subagent --remove "agent-name" --dir ".opencode/agents"
```

---

## Agent Issues

### Agent not showing in `--list`

**Cause**: Agent file not in expected location, or OpenCode not reloaded.

**Solution**:
```bash
# Check if file exists
ls .opencode/agents/
ls ~/.config/opencode/agents/

# Reload OpenCode
opencode reload

# Run doctor to verify
define-subagent --doctor
```

### Agent created but not invocable in OpenCode

**Cause**: OpenCode hasn't reloaded configuration.

**Solution**:
```bash
# The create command auto-reloads, but if it failed:
opencode reload

# Verify with doctor
define-subagent --doctor
# Check "builtin_agents" and "global_agents_dir" status
```

### Template variables not interpolated

**Cause**: Variables like `{{project_root}}` still in output.

**Solution**:
```bash
# This is a bug - report it with:
# - Template name
# - Expected vs actual output
# - Node.js version (node --version)

# Workaround: Create custom agent without template
define-subagent --name "custom" --description "..." --prompt "..."
```

---

## Permission Issues

### "Access denied" when agent tries to edit files

**Cause**: Agent preset doesn't allow the operation.

**Solution**:
```bash
# Check agent's preset
define-subagent --list
# Look at the agent's permissions in the .md file

# Use appropriate preset:
# readonly  - No edits (exploration only)
# review    - No edits (analysis only)  
# test      - Can run tests (shell access)
# worker    - Full edit/write/shell access

# Create with correct preset:
define-subagent --name "editor" --template doc-writer --preset worker
```

### "Shell access denied" when running tests

**Cause**: Using `readonly` or `review` preset which denies shell.

**Solution**:
```bash
# Use test or worker preset for shell access
define-subagent --name "tester" --template api-tester --preset test
```

---

## Configuration Issues

### Doctor shows "degraded" or "unhealthy"

**Cause**: Missing components in OpenCode setup.

**Solution**:
```bash
# Run doctor for details
define-subagent --doctor

# Common checks:
# 1. opencode_installed: Install OpenCode CLI
# 2. global_config_dir: Run installer
# 3. global_agents_dir: Run installer
# 4. global_config_file: Run installer
# 5. builtin_agents: Run installer to register built-ins
# 6. templates: Should always pass

# Fix: Run installer
opencode-subagents-install --force
```

### Config file has wrong path format

**Cause**: Windows paths with backslashes in JSON.

**Solution**:
```bash
# The installer uses {{INSTRUCTIONS_PATH}} placeholder
# OpenCode resolves this at runtime

# If manually editing, use forward slashes or escaped backslashes:
# ✓ "C:/Users/name/.config/opencode/instructions/file.md"
# ✓ "C:\\Users\\name\\.config\\opencode\\instructions\\file.md"
# ✗ "C:\Users\name\.config\opencode\instructions\file.md"
```

### Built-in agents missing from config

**Cause**: Config file doesn't have built-in agent definitions.

**Solution**:
```bash
# Run installer to register built-ins
opencode-subagents-install --force

# Or manually add to opencode.jsonc:
{
  "agents": {
    "fast-explorer": { ... },
    "code-reviewer": { ... },
    "test-runner": { ... },
    "code-worker": { ... }
  }
}
```

---

## Platform-Specific Issues

### Windows: Path separator issues

**Symptoms**: Tests fail with `\` vs `/`, file not found.

**Solution**:
- The code uses `path.join()` and `path.sep` for cross-platform compatibility
- If manually constructing paths, use `path.join(dir, 'file')` not string concatenation

### Windows: PowerShell execution policy

**Symptoms**: Scripts won't run, "running scripts is disabled".

**Solution**:
```powershell
# Allow local scripts (run as Administrator)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope LocalMachine

# Or bypass for single command
powershell -ExecutionPolicy Bypass -File script.ps1
```

### macOS/Linux: "command not found" after global install

**Cause**: npm global bin not in PATH.

**Solution**:
```bash
# Add to shell config
echo 'export PATH="$PATH:$(npm config get prefix)/bin"' >> ~/.bashrc
source ~/.bashrc

# Or use npx
npx opencode-subagents-install
```

---

## Debugging

### Enable verbose output

```bash
# For define-subagent
DEBUG=* define-subagent --name test --template api-tester

# For installer
DEBUG=* opencode-subagents-install
```

### Check agent file content

```bash
# View generated agent file
cat .opencode/agents/agent-name.md
cat ~/.config/opencode/agents/agent-name.md
```

### Check OpenCode config

```bash
# View parsed config
cat ~/.config/opencode/opencode.jsonc

# Validate JSON
cat ~/.config/opencode/opencode.jsonc | jq .
```

### Test cleanup manually

```bash
# Remove agent
define-subagent --remove "agent-name" --dir ".opencode/agents"

# Check if file gone
ls .opencode/agents/

# Check config cleanup
grep "agent-name" ~/.config/opencode/opencode.jsonc
```

### Common error codes

| Error | Meaning | Fix |
|-------|---------|-----|
| `agent_exists` | File already exists | Use `--force` or remove first |
| `not_found` | Agent doesn't exist | Check name spelling, run `--list` |
| `MODULE_NOT_FOUND` | Build not run | Run `npm run build` |
| `ENOENT` | Directory missing | Run installer |
| `EACCES` | Permission denied | Check directory ownership |

---

## Getting Help

If your issue isn't listed:

1. **Search existing issues** on GitHub
2. **Run doctor** and include output: `define-subagent --doctor`
3. **Include**:
   - OS and version
   - Node.js version (`node --version`)
   - OpenCode version (`opencode --version`)
   - Full command and output
   - Steps to reproduce

4. **Open an issue** with the above information

---

## Quick Reference

```bash
# Health check
define-subagent --doctor

# List agents
define-subagent --list

# Create from template
define-subagent --name X --template api-tester

# Create custom
define-subagent --name X --desc "..." --prompt "..." --preset worker

# Remove agent
define-subagent --remove X --dir .opencode/agents

# Dry run
define-subagent --name X --template api-tester --dry-run

# Force overwrite
define-subagent --name X --template api-tester --force

# Global install
opencode-subagents-install

# Dry run install
opencode-subagents-install --dry-run
```