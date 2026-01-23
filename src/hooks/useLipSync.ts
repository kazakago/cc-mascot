import { useRef, useCallback, useEffect } from "react";

interface UseLipSyncOptions {
  onMouthValueChange: (value: number) => void;
}

export function useLipSync({ onMouthValueChange }: UseLipSyncOptions) {
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationIdRef = useRef<number>(0);
  const isActiveRef = useRef(false);
  const updateLipSyncRef = useRef<(() => void) | undefined>(undefined);

  const calculateMouthValue = useCallback((analyser: AnalyserNode): number => {
    const dataArray = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const value = (dataArray[i] - 128) / 128;
      sum += value * value;
    }
    const rms = Math.sqrt(sum / dataArray.length);

    return Math.min(1, rms * 4);
  }, []);

  const updateLipSync = useCallback(() => {
    if (!isActiveRef.current || !analyserRef.current) return;

    const mouthValue = calculateMouthValue(analyserRef.current);
    onMouthValueChange(mouthValue);

    animationIdRef.current = requestAnimationFrame(() => {
      updateLipSyncRef.current?.();
    });
  }, [calculateMouthValue, onMouthValueChange]);

  useEffect(() => {
    updateLipSyncRef.current = updateLipSync;
  }, [updateLipSync]);

  const startLipSync = useCallback((analyser: AnalyserNode) => {
    analyserRef.current = analyser;
    isActiveRef.current = true;
    updateLipSyncRef.current?.();
  }, []);

  const stopLipSync = useCallback(() => {
    isActiveRef.current = false;
    cancelAnimationFrame(animationIdRef.current);
    onMouthValueChange(0);
  }, [onMouthValueChange]);

  useEffect(() => {
    return () => {
      cancelAnimationFrame(animationIdRef.current);
    };
  }, []);

  return { startLipSync, stopLipSync };
}
