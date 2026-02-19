import { useEffect, useRef } from 'react';
import { useStore } from '../store';
import { getAnalyserNode } from '../services/audioEngine';
import type { AudioFeatures } from '../types';

const TARGET_INTERVAL = 33; // ~30fps

export function useAudioAnalysis() {
  const isListening = useStore((s) => s.isListening);
  const setAudioFeatures = useStore((s) => s.setAudioFeatures);
  const rafRef = useRef<number>(0);
  const prevSpectrum = useRef<Float32Array | null>(null);
  const sensitivityRef = useRef(useStore.getState().sensitivityGain);
  const lastFrameTime = useRef(0);

  // Keep sensitivity ref in sync without causing re-renders
  useEffect(() => {
    return useStore.subscribe((state) => {
      sensitivityRef.current = state.sensitivityGain;
    });
  }, []);

  useEffect(() => {
    if (!isListening) return;

    const analyser = getAnalyserNode();
    if (!analyser) return;

    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const timeData = new Uint8Array(analyser.fftSize);
    const floatFreq = new Float32Array(analyser.frequencyBinCount);

    // Reusable output arrays to reduce GC pressure
    const outFreqData = new Uint8Array(analyser.frequencyBinCount);
    const outTimeData = new Uint8Array(analyser.fftSize);

    function analyze(now: number) {
      if (!analyser) return;

      // Throttle to ~30fps
      if (now - lastFrameTime.current < TARGET_INTERVAL) {
        rafRef.current = requestAnimationFrame(analyze);
        return;
      }
      lastFrameTime.current = now;

      analyser.getByteFrequencyData(freqData);
      analyser.getByteTimeDomainData(timeData);
      analyser.getFloatFrequencyData(floatFreq);

      // RMS (volume)
      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / timeData.length);

      // Energy
      let energy = 0;
      for (let i = 0; i < freqData.length; i++) {
        energy += freqData[i];
      }
      energy /= freqData.length * 255;

      // Band energies (bass / mid / high)
      const binCount = freqData.length;
      const bassEnd = Math.floor(binCount * 0.1);    // ~0-200Hz
      const midEnd = Math.floor(binCount * 0.4);     // ~200-2000Hz

      let bassSum = 0, midSum = 0, highSum = 0;
      for (let i = 0; i < bassEnd; i++) bassSum += freqData[i];
      for (let i = bassEnd; i < midEnd; i++) midSum += freqData[i];
      for (let i = midEnd; i < binCount; i++) highSum += freqData[i];

      const gain = sensitivityRef.current;
      const bass = (bassSum / (bassEnd * 255)) * gain;
      const mid = (midSum / ((midEnd - bassEnd) * 255)) * gain;
      const high = (highSum / ((binCount - midEnd) * 255)) * gain;

      // Spectral centroid
      let weightedSum = 0, magSum = 0;
      for (let i = 0; i < freqData.length; i++) {
        weightedSum += i * freqData[i];
        magSum += freqData[i];
      }
      const spectralCentroid = magSum > 0 ? weightedSum / magSum : 0;

      // Spectral flux (onset detection)
      let flux = 0;
      if (prevSpectrum.current) {
        for (let i = 0; i < floatFreq.length; i++) {
          const diff = floatFreq[i] - prevSpectrum.current[i];
          if (diff > 0) flux += diff;
        }
      }
      if (!prevSpectrum.current) {
        prevSpectrum.current = new Float32Array(floatFreq.length);
      }
      prevSpectrum.current.set(floatFreq);

      // Zero crossing rate
      let zcr = 0;
      for (let i = 1; i < timeData.length; i++) {
        if ((timeData[i] >= 128) !== (timeData[i - 1] >= 128)) zcr++;
      }
      zcr /= timeData.length;

      // Copy into reusable arrays instead of allocating new ones
      outFreqData.set(freqData);
      outTimeData.set(timeData);

      const features: AudioFeatures = {
        rms: rms * gain,
        energy: energy * gain,
        spectralCentroid,
        spectralFlux: Math.min(flux / 100, 1),
        zcr,
        loudness: { specific: new Float32Array(0), total: rms * gain },
        mfcc: [],
        frequencyData: outFreqData,
        timeData: outTimeData,
        bass,
        mid,
        high,
      };

      setAudioFeatures(features);
      rafRef.current = requestAnimationFrame(analyze);
    }

    rafRef.current = requestAnimationFrame(analyze);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [isListening, setAudioFeatures]);
}
