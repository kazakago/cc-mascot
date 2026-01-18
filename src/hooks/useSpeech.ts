import { useRef, useCallback, useEffect, useState } from 'react';
import { speak } from '../services/voicevox';
import type { Emotion } from '../types/emotion';

interface UseSpeechOptions {
  onStart: (analyser: AnalyserNode, emotion: Emotion) => void;
  onEnd: () => void;
  speakerId: number;
  baseUrl: string;
  volumeScale: number;
}

interface QueueItem {
  text: string;
  emotion: Emotion;
}

export function useSpeech({ onStart, onEnd, speakerId, baseUrl, volumeScale }: UseSpeechOptions) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isReady, setIsReady] = useState(false);
  const isSpeakingRef = useRef(false);
  const queueRef = useRef<QueueItem[]>([]);
  const processQueueRef = useRef<(() => Promise<void>) | undefined>(undefined);

  // アプリ起動時にAudioContextを初期化（Electron用）
  useEffect(() => {
    if (audioContextRef.current) return;

    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    const initialize = async () => {
      if (ctx.state !== 'running') {
        await ctx.resume();
        console.log('AudioContext resumed');
      } else {
        console.log('AudioContext initialized');
      }
      setIsReady(true);
    };

    initialize();
  }, []);

  const processQueue = useCallback(async () => {
    if (isSpeakingRef.current || queueRef.current.length === 0) {
      return;
    }

    // AudioContextが準備できていない場合はキューをクリアして終了
    if (!isReady || !audioContextRef.current) {
      console.warn('AudioContext not ready, discarding queued text');
      queueRef.current = [];
      return;
    }

    const item = queueRef.current.shift();
    if (!item) return;

    const ctx = audioContextRef.current;

    // suspended状態なら無視して次へ
    if (ctx.state === 'suspended') {
      console.warn('AudioContext suspended, skipping:', item.text);
      processQueueRef.current?.();
      return;
    }

    try {
      isSpeakingRef.current = true;

      console.log(`[useSpeech] Synthesizing with Speaker ID: ${speakerId}`);
      const wavBuffer = await speak(item.text, speakerId, baseUrl);
      const audioBuffer = await ctx.decodeAudioData(wavBuffer);

      const source = ctx.createBufferSource();
      const analyser = ctx.createAnalyser();
      const gainNode = ctx.createGain();

      analyser.fftSize = 256;
      gainNode.gain.value = volumeScale;

      source.buffer = audioBuffer;
      // Audio graph: source -> analyser -> gain -> destination
      source.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(ctx.destination);

      onStart(analyser, item.emotion);

      source.onended = () => {
        isSpeakingRef.current = false;
        onEnd();
        processQueueRef.current?.();
      };

      source.start();
    } catch (error) {
      console.error('Speech failed:', error);
      isSpeakingRef.current = false;
      onEnd();
      processQueueRef.current?.();
    }
  }, [onStart, onEnd, isReady, speakerId, baseUrl, volumeScale]);

  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  const speakText = useCallback((text: string, emotion: Emotion = 'neutral') => {
    // AudioContextが準備できていない場合は無視
    if (!isReady) {
      console.warn('AudioContext not ready, ignoring:', text);
      return;
    }

    console.log(`Queued: "${text}" with emotion "${emotion}" (queue size: ${queueRef.current.length})`);
    queueRef.current.push({ text, emotion });
    processQueueRef.current?.();
  }, [isReady]);

  return { speakText, isReady };
}
