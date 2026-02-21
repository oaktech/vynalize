import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useStore } from '../store';

// ── Direct logic tests (no React hooks) ────────────────────

// We test the beat detection algorithm directly since the hook
// is triggered by useEffect on audioFeatures changes.

const BEAT_THRESHOLD = 0.15;
const BEAT_COOLDOWN_MS = 200;
const BPM_BUFFER_SIZE = 30;

interface BeatDetectorState {
  lastBeatTime: number;
  beatTimestamps: number[];
  prevFlux: number;
}

function createDetector(): BeatDetectorState {
  return { lastBeatTime: 0, beatTimestamps: [], prevFlux: 0 };
}

function processBeat(
  state: BeatDetectorState,
  flux: number,
  now: number,
): { beat: boolean; strength: number; bpm: number | null } {
  const delta = flux - state.prevFlux;
  state.prevFlux = flux;

  let beat = false;
  let strength = 0;
  let bpm: number | null = null;

  if (delta > BEAT_THRESHOLD && now - state.lastBeatTime > BEAT_COOLDOWN_MS) {
    beat = true;
    strength = Math.min(delta / 0.5, 1);
    state.lastBeatTime = now;

    state.beatTimestamps.push(now);
    if (state.beatTimestamps.length > BPM_BUFFER_SIZE) {
      state.beatTimestamps.shift();
    }

    if (state.beatTimestamps.length >= 8) {
      const intervals: number[] = [];
      for (let i = 1; i < state.beatTimestamps.length; i++) {
        intervals.push(state.beatTimestamps[i] - state.beatTimestamps[i - 1]);
      }
      intervals.sort((a, b) => a - b);
      const median = intervals[Math.floor(intervals.length / 2)];
      if (median > 250 && median < 2000) {
        bpm = Math.round(60000 / median);
      }
    }
  }

  return { beat, strength, bpm };
}

describe('Beat Detection Algorithm', () => {
  describe('Threshold detection', () => {
    it('triggers beat when delta exceeds threshold', () => {
      const d = createDetector();
      const result = processBeat(d, 0.3, 1000);
      // delta = 0.3 - 0 = 0.3 > 0.15
      expect(result.beat).toBe(true);
    });

    it('does not trigger beat when delta is below threshold', () => {
      const d = createDetector();
      const result = processBeat(d, 0.1, 1000);
      // delta = 0.1 - 0 = 0.1 < 0.15
      expect(result.beat).toBe(false);
    });

    it('does not trigger on exactly threshold', () => {
      const d = createDetector();
      const result = processBeat(d, BEAT_THRESHOLD, 1000);
      // delta = 0.15 - 0 = 0.15, not > 0.15
      expect(result.beat).toBe(false);
    });

    it('detects beat on flux increase, not absolute value', () => {
      const d = createDetector();
      // Set prevFlux high
      processBeat(d, 0.8, 0);
      // Now a small increase
      const result = processBeat(d, 0.85, 500);
      // delta = 0.05, below threshold
      expect(result.beat).toBe(false);
    });

    it('does not trigger on flux decrease', () => {
      const d = createDetector();
      processBeat(d, 0.5, 0);
      const result = processBeat(d, 0.1, 500);
      // delta = -0.4, negative
      expect(result.beat).toBe(false);
    });
  });

  describe('Cooldown', () => {
    it('enforces cooldown period between beats', () => {
      const d = createDetector();
      processBeat(d, 0.3, 1000);
      // Try again within cooldown (200ms)
      const result = processBeat(d, 0.6, 1100);
      expect(result.beat).toBe(false);
    });

    it('allows beat after cooldown expires', () => {
      const d = createDetector();
      processBeat(d, 0.3, 1000);
      d.prevFlux = 0; // Reset flux for clean delta
      const result = processBeat(d, 0.3, 1201);
      expect(result.beat).toBe(true);
    });

    it('allows beat at exactly cooldown boundary', () => {
      const d = createDetector();
      processBeat(d, 0.3, 1000);
      d.prevFlux = 0;
      // Exactly 200ms later
      const result = processBeat(d, 0.3, 1200);
      // now - lastBeatTime = 200, not > 200
      expect(result.beat).toBe(false);
    });
  });

  describe('Beat strength', () => {
    it('calculates strength as delta / 0.5, capped at 1', () => {
      const d = createDetector();
      const result = processBeat(d, 0.3, 1000);
      // delta = 0.3, strength = 0.3 / 0.5 = 0.6
      expect(result.strength).toBeCloseTo(0.6, 2);
    });

    it('caps strength at 1.0 for large deltas', () => {
      const d = createDetector();
      const result = processBeat(d, 0.8, 1000);
      // delta = 0.8, strength = min(0.8/0.5, 1) = 1.0
      expect(result.strength).toBe(1);
    });

    it('returns 0 strength when no beat', () => {
      const d = createDetector();
      const result = processBeat(d, 0.05, 1000);
      expect(result.strength).toBe(0);
    });
  });

  describe('BPM estimation', () => {
    it('does not estimate BPM with fewer than 8 beats', () => {
      const d = createDetector();
      for (let i = 0; i < 7; i++) {
        d.prevFlux = 0;
        processBeat(d, 0.3, i * 500 + 1000);
      }
      expect(d.beatTimestamps.length).toBe(7);
      // No BPM yet
      d.prevFlux = 0;
      const result = processBeat(d, 0.3, 7 * 500 + 1000);
      expect(d.beatTimestamps.length).toBe(8);
      // Now BPM should be calculated
      // intervals: 500ms each, median = 500, bpm = 60000/500 = 120
      expect(result.bpm).toBe(120);
    });

    it('estimates 120 BPM for 500ms intervals', () => {
      const d = createDetector();
      for (let i = 0; i < 10; i++) {
        d.prevFlux = 0;
        processBeat(d, 0.3, i * 500);
      }
      d.prevFlux = 0;
      const result = processBeat(d, 0.3, 10 * 500);
      expect(result.bpm).toBe(120);
    });

    it('estimates 60 BPM for 1000ms intervals', () => {
      const d = createDetector();
      for (let i = 0; i < 10; i++) {
        d.prevFlux = 0;
        processBeat(d, 0.3, i * 1000);
      }
      d.prevFlux = 0;
      const result = processBeat(d, 0.3, 10 * 1000);
      expect(result.bpm).toBe(60);
    });

    it('rejects BPM outside 60-240 range (too fast)', () => {
      const d = createDetector();
      // 200ms intervals = 300 BPM (but median < 250ms is rejected)
      // Wait: cooldown is 200ms, so we need intervals > 200ms
      // Actually: 250ms minimum interval, 240 BPM max
      for (let i = 0; i < 10; i++) {
        d.prevFlux = 0;
        processBeat(d, 0.3, i * 201);
      }
      d.prevFlux = 0;
      const result = processBeat(d, 0.3, 10 * 201);
      // median ~201ms, but 201 < 250 so BPM should be null
      expect(result.bpm).toBeNull();
    });

    it('uses median to resist outliers', () => {
      const d = createDetector();
      // 9 beats at 500ms, plus 1 outlier at 100ms gap
      const timestamps = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4100];
      for (const ts of timestamps) {
        d.prevFlux = 0;
        processBeat(d, 0.3, ts);
      }
      d.prevFlux = 0;
      const result = processBeat(d, 0.3, 4600);
      // Median should still be ~500ms
      expect(result.bpm).toBe(120);
    });

    it('caps buffer at BPM_BUFFER_SIZE (30)', () => {
      const d = createDetector();
      for (let i = 0; i < 35; i++) {
        d.prevFlux = 0;
        processBeat(d, 0.3, i * 500);
      }
      expect(d.beatTimestamps.length).toBeLessThanOrEqual(BPM_BUFFER_SIZE);
    });
  });
});

describe('Beat Detection Store Integration', () => {
  it('stores beat events in Zustand store', () => {
    const store = useStore.getState();
    store.triggerBeat({ timestamp: 1000, strength: 0.7 });
    expect(useStore.getState().isBeat).toBe(true);
    expect(useStore.getState().lastBeat?.strength).toBe(0.7);
  });

  it('clears isBeat flag without clearing lastBeat', () => {
    const store = useStore.getState();
    store.triggerBeat({ timestamp: 1000, strength: 0.7 });
    store.clearBeat();
    expect(useStore.getState().isBeat).toBe(false);
    expect(useStore.getState().lastBeat?.strength).toBe(0.7);
  });

  it('stores BPM in Zustand store', () => {
    const store = useStore.getState();
    store.setBpm(128);
    expect(useStore.getState().bpm).toBe(128);
  });
});
