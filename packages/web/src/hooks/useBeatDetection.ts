import { useEffect, useRef } from 'react';
import { useStore } from '../store';

const BEAT_THRESHOLD = 0.15;
const BEAT_COOLDOWN_MS = 200;
const BPM_BUFFER_SIZE = 30;

export function useBeatDetection() {
  const audioFeatures = useStore((s) => s.audioFeatures);
  const triggerBeat = useStore((s) => s.triggerBeat);
  const clearBeat = useStore((s) => s.clearBeat);
  const setBpm = useStore((s) => s.setBpm);

  const lastBeatTime = useRef(0);
  const beatTimestamps = useRef<number[]>([]);
  const prevFlux = useRef(0);

  useEffect(() => {
    if (!audioFeatures) return;

    const now = performance.now();
    const flux = audioFeatures.spectralFlux;
    const delta = flux - prevFlux.current;
    prevFlux.current = flux;

    if (delta > BEAT_THRESHOLD && now - lastBeatTime.current > BEAT_COOLDOWN_MS) {
      const strength = Math.min(delta / 0.5, 1);
      triggerBeat({ timestamp: now, strength });
      lastBeatTime.current = now;

      // Collect for BPM estimation
      beatTimestamps.current.push(now);
      if (beatTimestamps.current.length > BPM_BUFFER_SIZE) {
        beatTimestamps.current.shift();
      }

      // Estimate BPM from recent beats
      if (beatTimestamps.current.length >= 8) {
        const intervals: number[] = [];
        const ts = beatTimestamps.current;
        for (let i = 1; i < ts.length; i++) {
          intervals.push(ts[i] - ts[i - 1]);
        }
        intervals.sort((a, b) => a - b);
        // Take median interval
        const median = intervals[Math.floor(intervals.length / 2)];
        if (median > 250 && median < 2000) {
          const bpm = Math.round(60000 / median);
          setBpm(bpm);
        }
      }

      // Clear beat flag after a short duration
      setTimeout(() => clearBeat(), 100);
    }
  }, [audioFeatures, triggerBeat, clearBeat, setBpm]);
}
