let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let mediaStream: MediaStream | null = null;

export async function initAudioCapture(deviceId?: string): Promise<{
  context: AudioContext;
  analyser: AnalyserNode;
  stream: MediaStream;
}> {
  // Close previous context to prevent leaks on device change
  if (audioContext) {
    try { audioContext.close(); } catch {}
    audioContext = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (analyserNode) {
    analyserNode.disconnect();
    analyserNode = null;
  }

  const constraints: MediaStreamConstraints = {
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: 44100,
      channelCount: 1,
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    },
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);

  const context = new AudioContext();
  // Chromium kiosk on Linux may leave the context suspended even with
  // --autoplay-policy=no-user-gesture-required — force it awake.
  if (context.state === 'suspended') {
    await context.resume();
  }
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);

  audioContext = context;
  analyserNode = analyser;
  sourceNode = source;
  mediaStream = stream;

  // Handle iOS background suspend/resume
  const handleVisibility = () => {
    if (!audioContext) return;
    if (document.hidden) {
      audioContext.suspend();
    } else if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);

  // Clean up listener when context is closed
  context.addEventListener('statechange', () => {
    if (context.state === 'closed') {
      document.removeEventListener('visibilitychange', handleVisibility);
    }
  });

  return { context, analyser, stream };
}

export function getAudioContext(): AudioContext | null {
  return audioContext;
}

export function getAnalyserNode(): AnalyserNode | null {
  return analyserNode;
}

export function getMediaStream(): MediaStream | null {
  return mediaStream;
}

export function stopAudioCapture(): void {
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
    mediaStream = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (analyserNode) {
    analyserNode.disconnect();
    analyserNode = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}
