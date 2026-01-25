import { useState, useEffect, useCallback, useRef } from "react";
import type { VRM } from "@pixiv/three-vrm";

interface UseBlinkOptions {
  minInterval?: number; // 最小まばたき間隔（ミリ秒）
  maxInterval?: number; // 最大まばたき間隔（ミリ秒）
  blinkDuration?: number; // まばたきの持続時間（ミリ秒）
  enabled?: boolean; // まばたきの有効化
}

const DEFAULT_MIN_INTERVAL = 2000; // 2秒
const DEFAULT_MAX_INTERVAL = 6000; // 6秒
const DEFAULT_BLINK_DURATION = 150; // 0.15秒
const HAPPY_EXPRESSION_THRESHOLD = 0.1; // happy表情の適用判定閾値（0.1以下なら「適用されていない」とみなす）

export function useBlink(vrm: VRM | null, options: UseBlinkOptions = {}) {
  const {
    minInterval = DEFAULT_MIN_INTERVAL,
    maxInterval = DEFAULT_MAX_INTERVAL,
    blinkDuration = DEFAULT_BLINK_DURATION,
    enabled = true,
  } = options;

  const [isBlinking, setIsBlinking] = useState(false);
  const blinkTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blinkAnimationRef = useRef<number | null>(null);
  const scheduleNextBlinkRef = useRef<(() => void) | undefined>(undefined);

  // ランダムな間隔を計算
  const getRandomInterval = useCallback(() => {
    return Math.random() * (maxInterval - minInterval) + minInterval;
  }, [minInterval, maxInterval]);

  // なめらかなまばたきアニメーション
  const performBlink = useCallback(() => {
    if (!vrm?.expressionManager || !enabled) return;

    // happy表情をチェック（笑顔の時は瞬きをスキップ）
    const happyValue = vrm.expressionManager.getValue("happy");
    if ((happyValue ?? 0) > HAPPY_EXPRESSION_THRESHOLD) {
      return;
    }

    setIsBlinking(true);

    const startTime = performance.now();
    const halfDuration = blinkDuration / 2;

    const animate = () => {
      const elapsed = performance.now() - startTime;

      if (elapsed < halfDuration) {
        // 目を閉じる（0 → 1）
        const progress = elapsed / halfDuration;
        const value = progress; // linear interpolation
        vrm.expressionManager?.setValue("blink", value);
        blinkAnimationRef.current = requestAnimationFrame(animate);
      } else if (elapsed < blinkDuration) {
        // 目を開く（1 → 0）
        const progress = (elapsed - halfDuration) / halfDuration;
        const value = 1.0 - progress; // linear interpolation
        vrm.expressionManager?.setValue("blink", value);
        blinkAnimationRef.current = requestAnimationFrame(animate);
      } else {
        // アニメーション終了
        vrm.expressionManager?.setValue("blink", 0.0);
        setIsBlinking(false);
        blinkAnimationRef.current = null;
      }
    };

    blinkAnimationRef.current = requestAnimationFrame(animate);
  }, [vrm, blinkDuration, enabled]);

  // 次のまばたきをスケジュール
  const scheduleNextBlink = useCallback(() => {
    if (!enabled) return;

    const interval = getRandomInterval();
    blinkTimeoutRef.current = setTimeout(() => {
      performBlink();
      scheduleNextBlinkRef.current?.(); // 次のまばたきをスケジュール
    }, interval);
  }, [enabled, getRandomInterval, performBlink]);

  useEffect(() => {
    scheduleNextBlinkRef.current = scheduleNextBlink;
  }, [scheduleNextBlink]);

  // まばたきループを開始
  useEffect(() => {
    if (vrm && enabled) {
      scheduleNextBlink();
    }

    return () => {
      if (blinkTimeoutRef.current) {
        clearTimeout(blinkTimeoutRef.current);
      }
      if (blinkAnimationRef.current) {
        cancelAnimationFrame(blinkAnimationRef.current);
      }
    };
  }, [vrm, enabled, scheduleNextBlink]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (vrm?.expressionManager) {
        vrm.expressionManager.setValue("blink", 0.0);
      }
    };
  }, [vrm]);

  return { isBlinking };
}
