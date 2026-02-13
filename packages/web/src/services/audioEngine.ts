let audioContext: AudioContext | null = null;
let analyserNode: AnalyserNode | null = null;
let sourceNode: MediaStreamAudioSourceNode | null = null;
let mediaStream: MediaStream | null = null;

export async function initAudioCapture(): Promise<{
  context: AudioContext;
  analyser: AnalyserNode;
  stream: MediaStream;
}> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      sampleRate: 44100,
      channelCount: 1,
    },
  });

  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);

  audioContext = context;
  analyserNode = analyser;
  sourceNode = source;
  mediaStream = stream;

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
