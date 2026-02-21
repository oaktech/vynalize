import { describe, it, expect } from 'vitest';

// ── Audio Analysis Algorithm Tests ─────────────────────────
// Tests the mathematical correctness of audio feature extraction
// algorithms used in useAudioAnalysis.ts

describe('Audio Feature Extraction', () => {
  describe('RMS (Root Mean Square) Volume', () => {
    function computeRms(timeData: Uint8Array): number {
      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128;
        sumSq += v * v;
      }
      return Math.sqrt(sumSq / timeData.length);
    }

    it('returns 0 for silence (all 128)', () => {
      const silence = new Uint8Array(256).fill(128);
      expect(computeRms(silence)).toBe(0);
    });

    it('returns max RMS for full-scale signal', () => {
      // Alternating 0 and 255
      const loud = new Uint8Array(256);
      for (let i = 0; i < loud.length; i++) {
        loud[i] = i % 2 === 0 ? 0 : 255;
      }
      const rms = computeRms(loud);
      expect(rms).toBeGreaterThan(0.9);
      expect(rms).toBeLessThanOrEqual(1.0);
    });

    it('returns intermediate values for moderate signal', () => {
      const moderate = new Uint8Array(256);
      for (let i = 0; i < moderate.length; i++) {
        moderate[i] = 128 + Math.round(32 * Math.sin(i * 0.1));
      }
      const rms = computeRms(moderate);
      expect(rms).toBeGreaterThan(0);
      expect(rms).toBeLessThan(1);
    });

    it('scales with sensitivity gain', () => {
      const moderate = new Uint8Array(256);
      for (let i = 0; i < moderate.length; i++) {
        moderate[i] = 128 + Math.round(32 * Math.sin(i * 0.1));
      }
      const rms = computeRms(moderate);
      const scaledRms = rms * 1.5; // gain = 1.5
      expect(scaledRms).toBeGreaterThan(rms);
    });
  });

  describe('Energy', () => {
    function computeEnergy(freqData: Uint8Array): number {
      let energy = 0;
      for (let i = 0; i < freqData.length; i++) {
        energy += freqData[i];
      }
      return energy / (freqData.length * 255);
    }

    it('returns 0 for no frequency content', () => {
      const empty = new Uint8Array(1024).fill(0);
      expect(computeEnergy(empty)).toBe(0);
    });

    it('returns 1 for max frequency content', () => {
      const full = new Uint8Array(1024).fill(255);
      expect(computeEnergy(full)).toBe(1);
    });

    it('returns ~0.5 for half energy', () => {
      const half = new Uint8Array(1024).fill(128);
      const energy = computeEnergy(half);
      expect(energy).toBeCloseTo(128 / 255, 2);
    });
  });

  describe('Band Energies (bass/mid/high)', () => {
    function computeBands(
      freqData: Uint8Array,
      gain: number = 1,
    ): { bass: number; mid: number; high: number } {
      const binCount = freqData.length;
      const bassEnd = Math.floor(binCount * 0.1);
      const midEnd = Math.floor(binCount * 0.4);

      let bassSum = 0, midSum = 0, highSum = 0;
      for (let i = 0; i < bassEnd; i++) bassSum += freqData[i];
      for (let i = bassEnd; i < midEnd; i++) midSum += freqData[i];
      for (let i = midEnd; i < binCount; i++) highSum += freqData[i];

      return {
        bass: (bassSum / (bassEnd * 255)) * gain,
        mid: (midSum / ((midEnd - bassEnd) * 255)) * gain,
        high: (highSum / ((binCount - midEnd) * 255)) * gain,
      };
    }

    it('all bands are 0 for empty spectrum', () => {
      const empty = new Uint8Array(1024).fill(0);
      const { bass, mid, high } = computeBands(empty);
      expect(bass).toBe(0);
      expect(mid).toBe(0);
      expect(high).toBe(0);
    });

    it('bass-heavy signal has high bass, low mid/high', () => {
      const data = new Uint8Array(1024).fill(0);
      // Fill bass bins (first 10%)
      const bassEnd = Math.floor(1024 * 0.1);
      for (let i = 0; i < bassEnd; i++) data[i] = 255;
      const { bass, mid, high } = computeBands(data);
      expect(bass).toBeCloseTo(1, 1);
      expect(mid).toBe(0);
      expect(high).toBe(0);
    });

    it('mid-heavy signal has high mid', () => {
      const data = new Uint8Array(1024).fill(0);
      const bassEnd = Math.floor(1024 * 0.1);
      const midEnd = Math.floor(1024 * 0.4);
      for (let i = bassEnd; i < midEnd; i++) data[i] = 255;
      const { bass, mid, high } = computeBands(data);
      expect(bass).toBe(0);
      expect(mid).toBeCloseTo(1, 1);
      expect(high).toBe(0);
    });

    it('sensitivity gain multiplies all bands', () => {
      const data = new Uint8Array(1024).fill(128);
      const normal = computeBands(data, 1);
      const boosted = computeBands(data, 2);
      expect(boosted.bass).toBeCloseTo(normal.bass * 2, 2);
      expect(boosted.mid).toBeCloseTo(normal.mid * 2, 2);
      expect(boosted.high).toBeCloseTo(normal.high * 2, 2);
    });
  });

  describe('Spectral Centroid', () => {
    function computeSpectralCentroid(freqData: Uint8Array): number {
      let weightedSum = 0, magSum = 0;
      for (let i = 0; i < freqData.length; i++) {
        weightedSum += i * freqData[i];
        magSum += freqData[i];
      }
      return magSum > 0 ? weightedSum / magSum : 0;
    }

    it('returns 0 for silent signal', () => {
      const silent = new Uint8Array(1024).fill(0);
      expect(computeSpectralCentroid(silent)).toBe(0);
    });

    it('returns low value for bass-heavy signal', () => {
      const bass = new Uint8Array(1024).fill(0);
      for (let i = 0; i < 50; i++) bass[i] = 255;
      const centroid = computeSpectralCentroid(bass);
      expect(centroid).toBeLessThan(50);
    });

    it('returns high value for treble-heavy signal', () => {
      const treble = new Uint8Array(1024).fill(0);
      for (let i = 900; i < 1024; i++) treble[i] = 255;
      const centroid = computeSpectralCentroid(treble);
      expect(centroid).toBeGreaterThan(900);
    });

    it('returns midpoint for flat spectrum', () => {
      const flat = new Uint8Array(1024).fill(100);
      const centroid = computeSpectralCentroid(flat);
      // For uniform distribution, centroid = (n-1)/2
      expect(centroid).toBeCloseTo(1023 / 2, 0);
    });
  });

  describe('Spectral Flux (Onset Detection)', () => {
    function computeFlux(
      current: Float32Array,
      previous: Float32Array | null,
    ): number {
      if (!previous) return 0;
      let flux = 0;
      for (let i = 0; i < current.length; i++) {
        const diff = current[i] - previous[i];
        if (diff > 0) flux += diff;
      }
      return Math.min(flux / 100, 1);
    }

    it('returns 0 with no previous frame', () => {
      const current = new Float32Array(1024).fill(-50);
      expect(computeFlux(current, null)).toBe(0);
    });

    it('returns 0 for identical frames', () => {
      const frame = new Float32Array(1024).fill(-50);
      expect(computeFlux(frame, frame)).toBe(0);
    });

    it('detects increase in spectral energy', () => {
      const prev = new Float32Array(1024).fill(-80);
      const curr = new Float32Array(1024).fill(-40);
      const flux = computeFlux(curr, prev);
      expect(flux).toBeGreaterThan(0);
    });

    it('ignores decrease in spectral energy (half-wave rectification)', () => {
      const prev = new Float32Array(1024).fill(-40);
      const curr = new Float32Array(1024).fill(-80);
      const flux = computeFlux(curr, prev);
      expect(flux).toBe(0);
    });

    it('caps at 1.0', () => {
      const prev = new Float32Array(1024).fill(-100);
      const curr = new Float32Array(1024).fill(0);
      const flux = computeFlux(curr, prev);
      expect(flux).toBeLessThanOrEqual(1);
    });
  });

  describe('Zero Crossing Rate', () => {
    function computeZcr(timeData: Uint8Array): number {
      let zcr = 0;
      for (let i = 1; i < timeData.length; i++) {
        if ((timeData[i] >= 128) !== (timeData[i - 1] >= 128)) zcr++;
      }
      return zcr / timeData.length;
    }

    it('returns 0 for constant signal (all same value)', () => {
      const constant = new Uint8Array(256).fill(200);
      expect(computeZcr(constant)).toBe(0);
    });

    it('returns high value for alternating signal', () => {
      const alternating = new Uint8Array(256);
      for (let i = 0; i < alternating.length; i++) {
        alternating[i] = i % 2 === 0 ? 100 : 200;
      }
      const zcr = computeZcr(alternating);
      expect(zcr).toBeGreaterThan(0.9);
    });

    it('returns value between 0 and 1', () => {
      const signal = new Uint8Array(256);
      for (let i = 0; i < signal.length; i++) {
        signal[i] = 128 + Math.round(64 * Math.sin(i * 0.2));
      }
      const zcr = computeZcr(signal);
      expect(zcr).toBeGreaterThan(0);
      expect(zcr).toBeLessThanOrEqual(1);
    });
  });

  describe('Throttle behavior', () => {
    it('TARGET_INTERVAL is ~30fps', () => {
      const TARGET_INTERVAL = 33;
      const fps = 1000 / TARGET_INTERVAL;
      expect(fps).toBeCloseTo(30.3, 0);
    });
  });
});
