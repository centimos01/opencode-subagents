# Autonomous Subagents & Parallel Delegation in OpenCode

You are equipped with full autonomy to dynamically define, create, and invoke specialized subagents on the fly whenever a task benefits from speed, context isolation, or specialization (just like in Claude).

---

## Why Use Subagents? (Speed & Context Optimization)

1. **Keep Primary Context Clean & Fast**:
   Large file readings, exploratory searches, test logs, and big diffs bloat the conversation context, slowing down model latency and increasing cost. Delegating them to subagents keeps the main conversation lightweight and snappy.
2. **Specialized Tool Permissions**:
   A subagent can be strictly read-only (denying edit/write/shell) for safety and speed, or granted test execution tools only.
3. **Task Isolation & Focus**:
   Subagents focus solely on their given assignment and return concise findings without distraction.

---

## Pre-configured Subagents Ready Now

The following subagents are already installed globally and ready to invoke immediately:

- **`fast-explorer`**: Fast read-only codebase explorer. Uses `grep`, `glob`, and `read` to quickly map symbols, find files, and survey code without modifying anything.
- **`code-reviewer`**: Reviews code changes, diffs, and pull requests for bugs, security vulnerabilities, edge cases, and code style. Read-only.
- **`test-runner`**: Runs test commands, analyzes stack traces, reproduces bugs, and recommends minimal fixes.
- **`code-worker`**: Focused implementation subagent for writing isolated features or refactors.

---

## How to Create New Subagents Dynamically (On the Fly)

Whenever you encounter a domain or task that needs a tailored helper (e.g., `data-migrator`, `perf-profiler`, `api-tester`, `doc-writer`), **create it yourself immediately**. Subagents created this way are temporary, so delete each one as soon as its task finishes (see *Temporary Subagent Lifecycle* below):

### Recommended Method: Automated Script
Run the helper script via your `shell` tool:
```bash
node C:/Users/chris/.config/opencode/scripts/define-subagent.mjs --name "my-subagent" --description "Clear description of purpose" --prompt "Detailed instructions for the subagent" --preset readonly
```
*Flags:*
- `--name`: Unique identifier (lowercase alphanumeric with hyphens).
- `--description`: Specific explanation of when and why to invoke it.
- `--prompt`: The system prompt instructions for the subagent.
- `--preset`: `readonly` (for search/docs/analysis), `review` (for diff reviews), `test` (for test suites), or `worker` (full edit capabilities).
- `--model`: (Optional) specify a specific model override if needed.
- `--global`: (Optional) persist globally across all projects instead of only current workspace.

### Temporary Subagent Lifecycle (Mandatory Cleanup)

Subagents created on the fly are **temporary** and must not leave files behind:
1. **Create** the subagent with the script.
2. **Use** it with the `subagent` tool.
3. **Remove it immediately after its task finishes**: run the `cleanup_command` returned by the script (equivalent to `node .../define-subagent.mjs --remove "<name>" --dir "<agentsDir>"`). It deletes the markdown file, cleans legacy `agents.<name>` entries from `opencode.jsonc`, and prunes empty `.opencode/agents` folders. Never end your turn while a temporary subagent file still exists.

If create reports `agent_exists`, it is usually a leftover temporary subagent: delete it with the printed `cleanup_command` and create it again. Only keep a subagent when the user explicitly asked for a reusable one (prefer `--global` for those). If unsure about leftovers, run `--list` and remove the temporary project agents you no longer need.

### Alternative Method: Direct Markdown File
Use your `write` tool to create `.opencode/agents/<name>.md`:
```markdown
---
description: "What this subagent does and when to call it"
mode: subagent
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: write
    resource: "*"
    effect: deny
---
Detailed system prompt instructions for this subagent...
```
After creating the file, run `opencode reload` via `shell` so OpenCode immediately registers it, and delete the file once the subagent's task is finished (temporary subagents must not leave files behind).

---

## How to Invoke a Subagent

Use OpenCode's native `subagent` tool:
```json
{
  "agent": "fast-explorer",
  "description": "Find authentication middleware and token verification logic",
  "prompt": "Locate where user session tokens are verified in the codebase. Return file paths and function names."
}
```

- Set `"background": true` if you want the subagent to run asynchronously while you proceed.
- Pass `"sessionID"` if you need to continue an existing child session with follow-up prompts.
- Right after the subagent returns its result, run its cleanup command (see *Temporary Subagent Lifecycle*) before moving on to other work.
