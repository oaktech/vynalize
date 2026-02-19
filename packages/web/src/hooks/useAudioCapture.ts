import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { initAudioCapture, stopAudioCapture } from '../services/audioEngine';

function getMicDeniedMessage(): string {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) {
    return 'Microphone access denied. Go to Settings > Safari > Microphone and allow access for this site, then reload.';
  }
  if (/Chrome/.test(ua)) {
    return 'Microphone access denied. Click the lock icon in the address bar, set Microphone to "Allow", then reload.';
  }
  if (/Firefox/.test(ua)) {
    return 'Microphone access denied. Click the permissions icon in the address bar and allow microphone access.';
  }
  return 'Microphone access denied. Please allow microphone access in your browser settings and try again.';
}

export function useAudioCapture() {
  const setListening = useStore((s) => s.setListening);
  const isListening = useStore((s) => s.isListening);
  const setMicError = useStore((s) => s.setMicError);
  const audioInputDeviceId = useStore((s) => s.audioInputDeviceId);
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    if (isListening) return;
    setMicError(null);
    try {
      const { context, analyser, stream } = await initAudioCapture(audioInputDeviceId || undefined);
      contextRef.current = context;
      analyserRef.current = analyser;
      streamRef.current = stream;
      setListening(true);
    } catch (err) {
      console.error('Failed to start audio capture:', err);
      if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
        setMicError(getMicDeniedMessage());
      } else {
        setMicError('Failed to access microphone. Please check your device and try again.');
      }
    }
  }, [isListening, setListening, setMicError, audioInputDeviceId]);

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
