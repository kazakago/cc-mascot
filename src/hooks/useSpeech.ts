import { useRef, useCallback, useEffect, useState } from "react";
import { speak } from "../services/voicevox";
import type { Emotion } from "../types/emotion";

interface UseSpeechOptions {
  onStart: (analyser: AnalyserNode, emotion: Emotion) => void;
  onEnd: () => void;
  speakerId: number;
  baseUrl: string;
  volumeScale: number;
}

interface QueueItem {
  id: number;
  text: string;
  emotion: Emotion;
  status: "pending" | "synthesizing" | "ready" | "playing";
  audioBuffer?: AudioBuffer;
  promise?: Promise<AudioBuffer>;
}

export function useSpeech({ onStart, onEnd, speakerId, baseUrl, volumeScale }: UseSpeechOptions) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const [isReady, setIsReady] = useState(false);
  const isSpeakingRef = useRef(false);
  const queueRef = useRef<Map<number, QueueItem>>(new Map());
  const nextIdRef = useRef(0);
  const processQueueRef = useRef<(() => Promise<void>) | undefined>(undefined);
  const currentGainNodeRef = useRef<GainNode | null>(null);

  // アプリ起動時にAudioContextを初期化（Electron用）
  useEffect(() => {
    if (audioContextRef.current) return;

    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    const initialize = async () => {
      if (ctx.state !== "running") {
        await ctx.resume();
        console.log("AudioContext resumed");
      } else {
        console.log("AudioContext initialized");
      }
      setIsReady(true);
    };

    initialize();
  }, []);

  // 音声合成を並列実行（キューに入ったら即座に開始）
  const synthesizeAudio = useCallback(
    async (item: QueueItem) => {
      if (!audioContextRef.current) return;

      try {
        console.log(`[useSpeech] Synthesizing item #${item.id}: "${item.text}"`);
        const wavBuffer = await speak(item.text, speakerId, baseUrl);
        const audioBuffer = await audioContextRef.current.decodeAudioData(wavBuffer);

        // 音声合成完了、アイテムを更新
        item.audioBuffer = audioBuffer;
        item.status = "ready";
        console.log(`[useSpeech] Item #${item.id} synthesis complete`);

        // 発話処理をトリガー
        processQueueRef.current?.();
      } catch (error) {
        console.error(`[useSpeech] Synthesis failed for item #${item.id}:`, error);
        // 失敗したアイテムは削除
        queueRef.current.delete(item.id);
        processQueueRef.current?.();
      }
    },
    [speakerId, baseUrl],
  );

  // 音声合成完了したアイテムを順番に発話
  const processQueue = useCallback(async () => {
    if (isSpeakingRef.current) {
      return;
    }

    // AudioContextが準備できていない場合は終了
    if (!isReady || !audioContextRef.current) {
      console.warn("AudioContext not ready");
      return;
    }

    const ctx = audioContextRef.current;

    // suspended状態なら無視
    if (ctx.state === "suspended") {
      console.warn("AudioContext suspended, waiting");
      return;
    }

    // 次に発話すべきアイテムを探す（ID順）
    let nextItem: QueueItem | undefined;
    for (const [id, item] of queueRef.current) {
      if (item.status === "ready") {
        // まだ再生していない最も小さいIDのアイテムを再生
        if (!nextItem || id < nextItem.id) {
          nextItem = item;
        }
      }
    }

    if (!nextItem) {
      // 準備完了アイテムがない場合は何もしない
      return;
    }

    try {
      isSpeakingRef.current = true;
      nextItem.status = "playing";

      console.log(`[useSpeech] Playing item #${nextItem.id}: "${nextItem.text}"`);

      const source = ctx.createBufferSource();
      const analyser = ctx.createAnalyser();
      const gainNode = ctx.createGain();

      analyser.fftSize = 256;
      gainNode.gain.value = volumeScale;

      source.buffer = nextItem.audioBuffer!;
      // Audio graph: source -> analyser -> gain -> destination
      source.connect(analyser);
      analyser.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Store current gain node for real-time volume updates
      currentGainNodeRef.current = gainNode;

      onStart(analyser, nextItem.emotion);

      source.onended = () => {
        console.log(`[useSpeech] Item #${nextItem.id} playback complete`);
        // 完了したアイテムを削除
        queueRef.current.delete(nextItem.id);
        isSpeakingRef.current = false;
        currentGainNodeRef.current = null;
        onEnd();
        // 次のアイテムを処理
        processQueueRef.current?.();
      };

      source.start();
    } catch (error) {
      console.error(`[useSpeech] Playback failed for item #${nextItem.id}:`, error);
      queueRef.current.delete(nextItem.id);
      isSpeakingRef.current = false;
      onEnd();
      processQueueRef.current?.();
    }
  }, [onStart, onEnd, isReady, volumeScale]);

  useEffect(() => {
    processQueueRef.current = processQueue;
  }, [processQueue]);

  // Real-time volume update: update current gain node when volumeScale changes
  useEffect(() => {
    if (currentGainNodeRef.current) {
      currentGainNodeRef.current.gain.setValueAtTime(volumeScale, currentGainNodeRef.current.context.currentTime);
    }
  }, [volumeScale]);

  const speakText = useCallback(
    (text: string, emotion: Emotion = "neutral") => {
      // AudioContextが準備できていない場合は無視
      if (!isReady) {
        console.warn("AudioContext not ready, ignoring:", text);
        return;
      }

      const id = nextIdRef.current++;
      const item: QueueItem = {
        id,
        text,
        emotion,
        status: "pending",
      };

      console.log(`[useSpeech] Queued item #${id}: "${text}" with emotion "${emotion}"`);

      // キューに追加
      queueRef.current.set(id, item);

      // 即座に音声合成を開始（並列実行）
      item.status = "synthesizing";
      synthesizeAudio(item);
    },
    [isReady, synthesizeAudio],
  );

  return { speakText, isReady };
}
