import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { initAudioCapture, stopAudioCapture } from '../services/audioEngine';

export function useAudioCapture() {
  const setListening = useStore((s) => s.setListening);
  const isListening = useStore((s) => s.isListening);
  const audioInputDeviceId = useStore((s) => s.audioInputDeviceId);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    if (isListening) return;
    try {
      const { context, analyser, stream } = await initAudioCapture(audioInputDeviceId || undefined);
      contextRef.current = context;
      analyserRef.current = analyser;
      streamRef.current = stream;
      setListening(true);
    } catch (err) {
      console.error('Failed to start audio capture:', err);
    }
  }, [isListening, setListening, audioInputDeviceId]);

  const stop = useCallback(() => {
    stopAudioCapture();
    contextRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    setListening(false);
  }, [setListening]);

  useEffect(() => {
    return () => {
      stopAudioCapture();
    };
  }, []);

  return {
    start,
    stop,
    audioContext: contextRef.current,
    analyser: analyserRef.current,
    stream: streamRef.current,
  };
}
