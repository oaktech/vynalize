# Vynalize — Open Issues

### 1. Add registry completeness test

**Priority:** Medium

No automated check verifies that every `VisualizerMode` type union member has a corresponding registry entry (and vice versa), or that `VisualizerView.tsx` has a lazy component mapping for each mode. A single test iterating the registry against the type union and the component map would catch forgotten wiring at CI time.

**Approach:** The `VisualizerMode` union lives in `types.ts` and the registry in `visualizerRegistry.ts`. Since we chose to keep the explicit union (option 2), the test should verify that the registry IDs match the union members exactly. Export the `components` record from `VisualizerView.tsx` and verify every registry ID has a component.

---

### 2. Root-level `vitest` picks up server tests without jsdom setup

**Priority:** Low

Running `npx vitest run` from the repo root finds both `packages/web` and `packages/server` test files. The web tests fail (26 failures) because the root invocation doesn't use the jsdom environment or `packages/web/src/__tests__/setup.ts`. Running from `packages/web` works correctly.

**Fix:** Either add a root `vitest.config.ts` with workspace support, or add a `vitest.workspace.ts` so both packages run with their own configs.
