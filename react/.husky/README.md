# Git Hooks Setup

This project uses [Husky](https://typicode.github.io/husky/) to manage Git hooks for maintaining code quality.

## Pre-commit Hook

The pre-commit hook automatically runs before each commit to ensure code quality. It performs:

1. **ESLint** - Checks for code quality issues and automatically fixes fixable issues
2. **Prettier** - Formats code according to project standards
3. **TypeScript** - Type checks to catch type errors before commit

### What Gets Checked

- **TypeScript/TSX files** (`.ts`, `.tsx`):
  - ESLint with auto-fix
  - Prettier formatting
  - TypeScript type checking

- **Style/Config files** (`.scss`, `.json`, `.md`):
  - Prettier formatting

### Bypassing the Hook (Not Recommended)

In rare cases where you need to bypass the pre-commit hook:

```bash
git commit --no-verify -m "your message"
```

**Note:** Only use this in exceptional circumstances as it skips quality checks.

## Linting Rules

The project enforces the following rules:

### TypeScript Rules

- **No unused variables** - All declared variables must be used (prefix with `_` to ignore)
- **Explicit any warnings** - Using `any` type triggers a warning
- **No debugger statements** - Debugger statements are not allowed

### React Rules

- **React Hooks rules** - Ensures hooks are used correctly
- **Dependency array warnings** - Warns about missing dependencies in useEffect/useMemo/useCallback

### General Rules

- **No console.log** - Only `console.warn` and `console.error` are allowed
- **Prefer const** - Use `const` over `let` when possible
- **No var** - `var` is not allowed, use `let` or `const`
- **No duplicate imports** - Import statements should not be duplicated

## Manual Commands

Run these commands manually when needed:

```bash
# Run ESLint
npm run lint

# Type check
npm run type-check

# Format all files
npm run format

# Run tests
npm run test

# Build the project
npm run build
```

## Troubleshooting

If the pre-commit hook fails:

1. Read the error messages carefully
2. Fix the reported issues
3. Stage your changes again: `git add .`
4. Try committing again

If you encounter issues with the hook itself:

```bash
# Reinstall husky
npm run prepare

# Make sure hooks are executable
chmod +x .husky/pre-commit
```
