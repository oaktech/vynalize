# Vynalize — Open Issues

## Testing Infrastructure

### 1. Export `VISUALIZER_MODES` as single source of truth for tests

**Priority:** High — prevents drift every time a visualizer is added

The `VISUALIZER_MODES` array in `store.ts` is the canonical list but isn't exported. This forces 4 test files to duplicate it. Adding Pittsburgh skyline required updating all 4 manually.

**Fix:** Export `VISUALIZER_MODES` from `store.ts`, then replace hardcoded lists in tests:

```ts
import { VISUALIZER_MODES } from '../store';
expect(vizModes).toHaveLength(VISUALIZER_MODES.length);
```

**Files:**
- `packages/web/src/store.ts`
- `packages/web/src/__tests__/visualizerView.test.ts`
- `packages/web/src/__tests__/store.test.ts`
- `packages/web/src/__tests__/integrationFlows.test.ts`
- `packages/web/src/__tests__/autoDisplay.test.ts`

---

### 2. Create a centralized visualizer registry

**Priority:** Medium — architectural improvement

Visualizer metadata (mode ID, label, tag, component) is scattered across `store.ts`, `ModeSelector.tsx`, `VisualizerView.tsx`, and test files. Adding a visualizer currently touches 8+ files.

**Fix:** Create `src/visualizerRegistry.ts` that defines mode ID, label, tag, and lazy component in one place. `VisualizerView`, `ModeSelector`, and tests all consume it. Adding a visualizer becomes a 2-file change: the component + one registry entry.

---

### 3. Add registry completeness test

**Priority:** Medium — depends on #2

No automated check verifies that every `VisualizerMode` type union member has a corresponding component, label, and tag. A single test iterating the registry would catch forgotten wiring at CI time.

---

### 4. Fix pre-existing test state leakage (26 failures)

**Priority:** High — 26 tests are currently broken

Zustand store state leaks between tests. `beforeEach` is imported but never called in `store.test.ts`. Tests like "cycles to next visualizer" assume the store starts at `'spectrum'` but inherit leftover state from previous tests. Additionally, `remoteControl.test.ts` uses `afterEach` without importing it.

**Fix:** Add to `__tests__/setup.ts`:

```ts
import { beforeEach } from 'vitest';
import { useStore } from '../store';

beforeEach(() => {
  useStore.setState(useStore.getInitialState());
});
```

And in `remoteControl.test.ts`, add `afterEach` to the import.

**Failing files:**
- `store.test.ts` — 9 failures
- `settingsAndUI.test.ts` — 4 failures
- `remoteControl.test.ts` — parse error (missing `afterEach` import)
- `visualizerView.test.ts` — 1 failure
- `integrationFlows.test.ts` — multiple
- `autoDisplay.test.ts` — multiple
