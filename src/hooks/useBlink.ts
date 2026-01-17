import { useState, useEffect, useCallback, useRef } from 'react';
import type { VRM } from '@pixiv/three-vrm';

interface UseBlinkOptions {
  minInterval?: number; // 最小まばたき間隔（ミリ秒）
  maxInterval?: number; // 最大まばたき間隔（ミリ秒）
  blinkDuration?: number; // まばたきの持続時間（ミリ秒）
  enabled?: boolean; // まばたきの有効化
}

const DEFAULT_MIN_INTERVAL = 2000; // 2秒
const DEFAULT_MAX_INTERVAL = 6000; // 6秒
const DEFAULT_BLINK_DURATION = 150; // 0.15秒

export function useBlink(vrm: VRM | null, options: UseBlinkOptions = {}) {
  const {
    minInterval = DEFAULT_MIN_INTERVAL,
    maxInterval = DEFAULT_MAX_INTERVAL,
    blinkDuration = DEFAULT_BLINK_DURATION,
    enabled = true,
  } = options;

  const [isBlinking, setIsBlinking] = useState(false);
  const blinkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const blinkAnimationRef = useRef<NodeJS.Timeout | null>(null);

  // ランダムな間隔を計算
  const getRandomInterval = useCallback(() => {
    return Math.random() * (maxInterval - minInterval) + minInterval;
  }, [minInterval, maxInterval]);

  // まばたきアニメーション
  const performBlink = useCallback(() => {
    if (!vrm?.expressionManager || !enabled) return;

    setIsBlinking(true);

    // 目を閉じる
    vrm.expressionManager.setValue('blink', 1.0);

    // 指定時間後に目を開く
    blinkAnimationRef.current = setTimeout(() => {
      if (vrm?.expressionManager) {
        vrm.expressionManager.setValue('blink', 0.0);
        setIsBlinking(false);
      }
    }, blinkDuration);
  }, [vrm, blinkDuration, enabled]);

  // 次のまばたきをスケジュール
  const scheduleNextBlink = useCallback(() => {
    if (!enabled) return;

    const interval = getRandomInterval();
    blinkTimeoutRef.current = setTimeout(() => {
      performBlink();
      scheduleNextBlink(); // 次のまばたきをスケジュール
    }, interval);
  }, [enabled, getRandomInterval, performBlink]);

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
        clearTimeout(blinkAnimationRef.current);
      }
    };
  }, [vrm, enabled, scheduleNextBlink]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (vrm?.expressionManager) {
        vrm.expressionManager.setValue('blink', 0.0);
      }
    };
  }, [vrm]);

  return { isBlinking };
}
