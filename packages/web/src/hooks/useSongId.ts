import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { getMediaStream } from '../services/audioEngine';
import { identifySong } from '../services/identifyApi';

const CAPTURE_DURATION_MS = 12000;
const IDENTIFY_INTERVAL_MS = 20000;

export function useSongId() {
  const isListening = useStore((s) => s.isListening);
  const setCurrentSong = useStore((s) => s.setCurrentSong);
  const setIdentifying = useStore((s) => s.setIdentifying);
  const currentSong = useStore((s) => s.currentSong);
  const intervalRef = useRef<number>(0);

  const captureAndIdentify = useCallback(async () => {
    const stream = getMediaStream();
    if (!stream) return;

    setIdentifying(true);

    try {
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const blob = await new Promise<Blob>((resolve) => {
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

      const song = await identifySong(blob);
      if (song) {
        // Only update if it's a different song
        if (!currentSong || song.title !== currentSong.title || song.artist !== currentSong.artist) {
          setCurrentSong(song);
        }
      }
    } catch (err) {
      console.error('Song identification error:', err);
    } finally {
      setIdentifying(false);
    }
  }, [currentSong, setCurrentSong, setIdentifying]);

  useEffect(() => {
    if (!isListening) return;

    // First identification after a short delay
    const initialTimeout = setTimeout(captureAndIdentify, 3000);

    // Then periodically
    intervalRef.current = window.setInterval(captureAndIdentify, IDENTIFY_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalRef.current);
    };
  }, [isListening, captureAndIdentify]);
}
