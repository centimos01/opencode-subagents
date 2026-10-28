# Contributing to OpenCode Subagents

Thank you for your interest in contributing! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Adding New Templates](#adding-new-templates)
- [Code Style](#code-style)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to uphold this code.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/opencode-subagents.git`
3. Install dependencies: `npm install`
4. Build: `npm run build`
5. Run tests: `npm run test`

## Development Workflow

### Branch Naming

- Features: `feat/<short-description>`
- Fixes: `fix/<short-description>`
- Docs: `docs/<short-description>`
- Refactors: `refactor/<short-description>`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add new template for database migration
fix: handle Windows path separators in cleanup
docs: update README with template examples
refactor: extract template interpolation logic
```

## Adding New Templates

Templates are defined in `src/templates/index.ts`. Each template is an object with:

```typescript
{
  name: 'template-name',           // Unique identifier (kebab-case)
  description: 'Brief description', // Shown in --list and help
  preset: 'readonly' | 'review' | 'test' | 'worker',
  prompt: `System prompt for the agent...`,
  variables?: {                    // Optional template variables
    variable_name: 'default_value',
  },
}
```

### Template Guidelines

1. **Name**: Use kebab-case, descriptive (e.g., `api-tester`, not `api`)
2. **Description**: One sentence, clear purpose and when to use
3. **Preset**: Choose appropriately:
   - `readonly` — No edits, safe for exploration
   - `review` — Analysis only, no modifications
   - `test` — Can run tests, shell access
   - `worker` — Full editing capabilities
4. **Prompt**: Comprehensive instructions, include:
   - Role definition
   - Step-by-step process
   - Output format expectations
   - Examples if helpful
5. **Variables**: Use `{{variable_name}}` in prompt, define defaults in `variables`

### Example: Adding a Template

```typescript
'new-template': {
  name: 'new-template',
  description: 'Does something useful for developers',
  preset: 'readonly',
  prompt: `You are a specialist in X. Your job is to:
  
  1. First step
  2. Second step
  
  Report findings in format Y.`,
  variables: {
    project_root: '{{project_root}}',
    custom_var: 'default_value',
  },
},
```

After adding:
1. Run `npm run build`
2. Test: `define-subagent --name test --template new-template --dry-run`
3. Add tests in `tests/templates.test.ts` (if creating new test file)

## Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: Run `npm run lint` (auto-fix with `npm run lint:fix`)
- **Prettier**: Run `npm run format`
- **Imports**: Use `.js` extension for relative imports
- **No unused**: Variables/parameters must be used or prefixed with `_`

### Key Rules

```typescript
// ✅ Good
export function sanitizeName(name: string): string {
  return String(name).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
}

// ❌ Bad - unused parameter
export function badExample(unused: string): void { }

// ✅ Good - prefix with underscore
export function goodExample(_unused: string): void { }
```

## Testing

### Running Tests

```bash
# All tests
npm run test

# Specific file
npm run test -- tests/define-subagent.test.ts

# Watch mode
npm run test:watch
```

### Test Structure

- **Unit tests**: `tests/*.test.ts` — Test individual functions
- **Integration tests**: `tests/integration.test.ts` — Full CLI lifecycle
- **Coverage**: Aim for >80% on core utilities

### Writing Tests

Follow TDD (Test-Driven Development):

1. Write failing test first
2. Implement minimal code to pass
3. Refactor if needed

```typescript
// Good test example
it('sanitizes agent name correctly', () => {
  expect(sanitizeName('My Agent!')).toBe('my-agent');
  expect(sanitizeName('Test_Name')).toBe('test-name');
  expect(sanitizeName('UPPERCASE')).toBe('uppercase');
});
```

## Pull Request Process

1. **Create a branch** from `main`
2. **Make changes** with clear commits
3. **Run all checks**:
   ```bash
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```
4. **Update documentation** if needed (README, comments)
5. **Open PR** with:
   - Clear title (conventional commit format)
   - Description of changes
   - Link to issue (if applicable)
   - Screenshots for UI changes
6. **Address review feedback**
7. **Squash and merge** after approval

### PR Checklist

- [ ] All tests pass
- [ ] Lint passes
- [ ] Type check passes
- [ ] Build succeeds
- [ ] Documentation updated
- [ ] CHANGELOG updated (if applicable)

## Adding Tests for New Features

When adding a new feature, add corresponding tests:

1. **Unit tests** for new functions in `tests/utils.test.ts` or new test file
2. **Integration tests** for CLI commands in `tests/define-subagent.test.ts`
3. **Template tests** if adding a template

## Release Process

Maintainers only:
1. Update version in `package.json`
2. Update CHANGELOG
3. Create git tag
4. Publish to npm: `npm publish`

## Questions?

Open an issue for:
- Bug reports
- Feature requests
- Documentation improvements
- General questions

---

Thank you for contributing! 🎉