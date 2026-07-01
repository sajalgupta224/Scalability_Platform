# Pre-Commit Hook - Quick Reference

## What Happens on Commit?

```
git commit
    ↓
Pre-commit hook runs
    ↓
Checks staged files:
├── *.ts, *.tsx files
│   ├── ESLint (auto-fix)
│   ├── Prettier (format)
│   └── TypeScript (type-check)
│
└── *.scss, *.json, *.md files
    └── Prettier (format)
    ↓
All pass? → Commit ✓
Any fail? → Commit blocked ✗
```

## Common Errors & Fixes

### ❌ "Variable 'foo' is declared but never used"

**Fix**: Remove the variable or prefix with `_` if intentionally unused:

```typescript
const _unusedVar = 'ok'; // Prefixed with _ - no error
```

### ❌ "console is not allowed"

**Fix**: Use `console.error()` or `console.warn()` instead of `console.log()`

### ❌ "Type 'any' is not allowed"

**Fix**: Add proper typing:

```typescript
// Bad
const data: any = response;

// Good
const data: ResponseType = response;
```

### ❌ "Duplicate import from 'module'"

**Fix**: Combine imports:

```typescript
// Bad
import { foo } from 'module';
import { bar } from 'module';

// Good
import { foo, bar } from 'module';
```

## Quick Commands

```bash
# See all errors
npm run lint

# Fix auto-fixable errors
npm run lint -- --fix

# Type check only
npm run type-check

# Format all files
npm run format

# Full build (includes all checks)
npm run build
```

## Emergency Bypass

**⚠️ Only use in extreme emergencies:**

```bash
git commit --no-verify -m "message"
```

## Need Help?

1. Read the full documentation: [.husky/README.md](.husky/README.md)
2. Check the setup guide: [PRE_COMMIT_SETUP.md](../PRE_COMMIT_SETUP.md)
3. Ask the team!
