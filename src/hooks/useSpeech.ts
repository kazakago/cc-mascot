import { useRef, useCallback } from 'react';
import { speak } from '../services/aivisSpeech';

interface UseSpeechOptions {
  onStart: (analyser: AnalyserNode) => void;
  onEnd: () => void;
}

export function useSpeech({ onStart, onEnd }: UseSpeechOptions) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const isSpeakingRef = useRef(false);
  const queueRef = useRef<string[]>([]);

  const processQueue = useCallback(async () => {
    if (isSpeakingRef.current || queueRef.current.length === 0) {
      return;
    }

    const text = queueRef.current.shift();
    if (!text) return;

    try {
      isSpeakingRef.current = true;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      const wavBuffer = await speak(text);
      const audioBuffer = await ctx.decodeAudioData(wavBuffer);

      const source = ctx.createBufferSource();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;

      source.buffer = audioBuffer;
      source.connect(analyser);
      analyser.connect(ctx.destination);

      onStart(analyser);

      source.onended = () => {
        isSpeakingRef.current = false;
        onEnd();
        // 次のキューを処理
        processQueue();
      };

      source.start();
    } catch (error) {
      console.error('Speech failed:', error);
      isSpeakingRef.current = false;
      onEnd();
      // エラーが起きても次のキューを処理
      processQueue();
    }
  }, [onStart, onEnd]);

  const speakText = useCallback((text: string) => {
    console.log(`Queued: "${text}" (queue size: ${queueRef.current.length})`);
    queueRef.current.push(text);
    processQueue();
  }, [processQueue]);

  return { speakText };
}
