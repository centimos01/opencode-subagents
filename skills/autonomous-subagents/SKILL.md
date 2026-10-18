---
name: autonomous-subagents
description: Use when you need to dynamically create, configure, or invoke specialized subagents to accelerate workflows, explore codebases, review diffs, or isolate complex tasks.
---

# Autonomous Subagent Management & Execution

Use this skill when you want to execute tasks faster and keep your context lightweight by delegating to specialized subagents.

## Core Rules for Speed
1. **Never bloat the primary context**: If a task requires searching across dozens of files, reading large logs, or performing big security/code reviews, delegate it to a subagent.
2. **Read-only subagents are fast & safe**: Use preset `readonly` for search and exploration subagents.
3. **Spawn subagents as you need them**: Do not hesitate to create a new subagent tailored to the current problem (just like Claude).

## Creating a Subagent On The Fly

Run the automated helper via `shell`:
```bash
node C:/Users/chris/.config/opencode/scripts/define-subagent.mjs --name "<name>" --description "<description>" --prompt "<system_prompt>" --preset <readonly|review|test|worker>
```

Add `--global` to make the subagent available across all projects, or omit it to keep it scoped to the current project repository (`.opencode/agents/`).

## Cleanup (Mandatory — No Residue on Disk)

Subagents created on the fly are temporary. Immediately after the subagent completes its task, delete it so nothing is left behind:
- Run the `cleanup_command` returned by `define-subagent.mjs` (equivalent to `node ... --remove "<name>" --dir "<agentsDir>"`). It deletes the markdown file, cleans legacy `agents.<name>` config entries written by older versions, and prunes empty `.opencode/agents` folders.
- Never end your turn while a leftover temporary subagent file exists; use `--list` if unsure and remove temporary project agents you no longer need.
- Keep a subagent only when the user explicitly asked for a reusable one (prefer `--global` for those).

## Invoking a Subagent

Once created (or using built-in subagents like `fast-explorer`, `code-reviewer`, `test-runner`), invoke them with the `subagent` tool:
- `agent`: The subagent identifier (e.g. `fast-explorer`)
- `description`: A brief headline for the task
- `prompt`: Specific instructions and inputs for the subagent
- `background`: `true` to run asynchronously in parallel, `false` to await results immediately
- `sessionID`: (Optional) Continue a previous child subagent conversation
