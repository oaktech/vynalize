import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { getMediaStream } from '../services/audioEngine';
import { identifySong } from '../services/identifyApi';

const CAPTURE_DURATION_MS = 15000;
const IDENTIFY_INTERVAL_MS = 30000;

export function useSongId() {
  const isListening = useStore((s) => s.isListening);
  const setCurrentSong = useStore((s) => s.setCurrentSong);
  const setIdentifying = useStore((s) => s.setIdentifying);
  const currentSongRef = useRef(useStore.getState().currentSong);
  const isRunning = useRef(false);

  // Keep ref in sync without causing re-renders
  useEffect(() => {
    return useStore.subscribe((state) => {
      currentSongRef.current = state.currentSong;
    });
  }, []);

  const captureAndIdentify = useCallback(async () => {
    if (isRunning.current) return;
    const stream = getMediaStream();
    if (!stream) {
      console.warn('[songid] No media stream available');
      return;
    }

    isRunning.current = true;
    setIdentifying(true);
    console.log('[songid] Starting 15s audio capture...');

    try {
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
        audioBitsPerSecond: 128000,
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const blob = await new Promise<Blob>((resolve, reject) => {
        mediaRecorder.onerror = (e) => reject(e);
        mediaRecorder.onstop = () => {
          resolve(new Blob(chunks, { type: mediaRecorder.mimeType }));
        };
        mediaRecorder.start();
        setTimeout(() => {
          if (mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
          }
        }, CAPTURE_DURATION_MS);
      });

      console.log(`[songid] Captured ${(blob.size / 1024).toFixed(1)}KB, sending to server...`);

      const song = await identifySong(blob);

      if (song) {
        const current = currentSongRef.current;
        if (!current || song.title !== current.title || song.artist !== current.artist) {
          console.log(`[songid] Identified: "${song.title}" by ${song.artist}`);
          setCurrentSong(song);
        } else {
          console.log('[songid] Same song still playing');
        }
      } else {
        console.log('[songid] No match found');
      }
    } catch (err) {
      console.error('[songid] Error:', err);
    } finally {
      isRunning.current = false;
      setIdentifying(false);
    }
  }, [setCurrentSong, setIdentifying]);

  useEffect(() => {
    if (!isListening) return;

    // First identification after a short delay
    const initialTimeout = setTimeout(captureAndIdentify, 2000);

    // Then periodically
    const intervalId = window.setInterval(captureAndIdentify, IDENTIFY_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [isListening, captureAndIdentify]);
}
