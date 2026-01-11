import { useRef, useCallback, useEffect, useState } from 'react';
import { speak } from '../services/aivisSpeech';

interface UseSpeechOptions {
  onStart: (analyser: AnalyserNode) => void;
  onEnd: () => void;
  speakerId: number;
  baseUrl: string;
}

export function useSpeech({ onStart, onEnd, speakerId, baseUrl }: UseSpeechOptions) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isReady, setIsReady] = useState(false);
  const isSpeakingRef = useRef(false);
  const queueRef = useRef<string[]>([]);

  // ユーザーインタラクションでAudioContextを初期化
  useEffect(() => {
    const initAudioContext = () => {
      if (audioContextRef.current) return;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      if (ctx.state === 'running') {
        setIsReady(true);
        console.log('AudioContext initialized');
      } else {
        ctx.resume().then(() => {
          setIsReady(true);
          console.log('AudioContext resumed');
        });
      }
    };

    // クリック・キー押下・タッチでAudioContextを初期化
    const events = ['click', 'keydown', 'touchstart'];
    events.forEach((event) => {
      document.addEventListener(event, initAudioContext, { once: true });
    });

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, initAudioContext);
      });
    };
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

    const text = queueRef.current.shift();
    if (!text) return;

    const ctx = audioContextRef.current;

    // suspended状態なら無視して次へ
    if (ctx.state === 'suspended') {
      console.warn('AudioContext suspended, skipping:', text);
      processQueue();
      return;
    }

    try {
      isSpeakingRef.current = true;

      const wavBuffer = await speak(text, speakerId, baseUrl);
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
        processQueue();
      };

      source.start();
    } catch (error) {
      console.error('Speech failed:', error);
      isSpeakingRef.current = false;
      onEnd();
      processQueue();
    }
  }, [onStart, onEnd, isReady, speakerId, baseUrl]);

  const speakText = useCallback((text: string) => {
    // AudioContextが準備できていない場合は無視
    if (!isReady) {
      console.warn('AudioContext not ready, ignoring:', text);
      return;
    }

    console.log(`Queued: "${text}" (queue size: ${queueRef.current.length})`);
    queueRef.current.push(text);
    processQueue();
  }, [processQueue, isReady]);

  return { speakText, isReady };
}
