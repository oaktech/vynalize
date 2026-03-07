# Vynalize — Open Issues

### 1. Root-level `vitest` picks up server tests without jsdom setup

**Priority:** Low

Running `npx vitest run` from the repo root finds both `packages/web` and `packages/server` test files. The web tests fail because the root invocation doesn't use the jsdom environment or `packages/web/src/__tests__/setup.ts`. Running from `packages/web` works correctly.

**Fix:** Either add a root `vitest.config.ts` with workspace support, or add a `vitest.workspace.ts` so both packages run with their own configs.
