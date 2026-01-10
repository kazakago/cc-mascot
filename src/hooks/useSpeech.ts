import { useRef, useCallback } from 'react';
import { speak } from '../services/aivisSpeech';

interface UseSpeechOptions {
  onStart: (analyser: AnalyserNode) => void;
  onEnd: () => void;
}

export function useSpeech({ onStart, onEnd }: UseSpeechOptions) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const isSpeakingRef = useRef(false);

  const speakText = useCallback(async (text: string) => {
    if (isSpeakingRef.current) {
      console.warn('Already speaking, ignoring request');
      return;
    }

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
      };

      source.start();
    } catch (error) {
      console.error('Speech failed:', error);
      isSpeakingRef.current = false;
      onEnd();
    }
  }, [onStart, onEnd]);

  return { speakText };
}
