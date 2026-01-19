import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLipSync } from './useLipSync';

// AnalyserNode のモック
class MockAnalyserNode {
  fftSize: number = 256;
  private mockData: Uint8Array;

  constructor(data?: Uint8Array) {
    this.mockData = data || new Uint8Array(this.fftSize).fill(128); // デフォルトは無音
  }

  getByteTimeDomainData(array: Uint8Array) {
    for (let i = 0; i < array.length && i < this.mockData.length; i++) {
      array[i] = this.mockData[i];
    }
  }

  setMockData(data: Uint8Array) {
    this.mockData = data;
  }
}

describe('useLipSync', () => {
  let mockOnMouthValueChange: ReturnType<typeof vi.fn>;
  let mockAnalyser: MockAnalyserNode;

  beforeEach(() => {
    mockOnMouthValueChange = vi.fn();
    mockAnalyser = new MockAnalyserNode();

    // requestAnimationFrame と cancelAnimationFrame のモック
    vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((cb) => {
      // 即座に実行
      setTimeout(cb, 0);
      return 1;
    });
    vi.spyOn(globalThis, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('初期化', () => {
    it('startLipSyncとstopLipSyncを返す', () => {
      const { result } = renderHook(() =>
        useLipSync({ onMouthValueChange: mockOnMouthValueChange })
      );

      expect(result.current.startLipSync).toBeDefined();
      expect(result.current.stopLipSync).toBeDefined();
      expect(typeof result.current.startLipSync).toBe('function');
      expect(typeof result.current.stopLipSync).toBe('function');
    });
  });

  describe('リップシンク開始', () => {
    it('startLipSyncでアニメーションが開始される', async () => {
      const { result } = renderHook(() =>
        useLipSync({ onMouthValueChange: mockOnMouthValueChange })
      );

      act(() => {
        result.current.startLipSync(mockAnalyser as unknown as AnalyserNode);
      });

      // onMouthValueChangeが呼ばれるまで待つ
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockOnMouthValueChange).toHaveBeenCalled();
    });

    it('無音状態では口の値が0に近い', async () => {
      // 無音データ（すべて128）
      const silentData = new Uint8Array(256).fill(128);
      mockAnalyser.setMockData(silentData);

      const { result } = renderHook(() =>
        useLipSync({ onMouthValueChange: mockOnMouthValueChange })
      );

      act(() => {
        result.current.startLipSync(mockAnalyser as unknown as AnalyserNode);
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockOnMouthValueChange).toHaveBeenCalled();
      const lastCallValue = mockOnMouthValueChange.mock.calls[
        mockOnMouthValueChange.mock.calls.length - 1
      ][0];
      expect(lastCallValue).toBeLessThan(0.1); // ほぼ0
    });

    it('音声がある場合は口の値が大きくなる', async () => {
      // 音声データ（振幅のある波形）
      const audioData = new Uint8Array(256);
      for (let i = 0; i < audioData.length; i++) {
        // サイン波を生成
        audioData[i] = Math.floor(128 + 64 * Math.sin((i / 256) * Math.PI * 4));
      }
      mockAnalyser.setMockData(audioData);

      const { result } = renderHook(() =>
        useLipSync({ onMouthValueChange: mockOnMouthValueChange })
      );

      act(() => {
        result.current.startLipSync(mockAnalyser as unknown as AnalyserNode);
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockOnMouthValueChange).toHaveBeenCalled();
      const lastCallValue = mockOnMouthValueChange.mock.calls[
        mockOnMouthValueChange.mock.calls.length - 1
      ][0];
      expect(lastCallValue).toBeGreaterThan(0.1); // 音声があるので大きい値
    });

    it('大きな音声では口の値が1.0に制限される', async () => {
      // 非常に大きな振幅のデータ
      const loudData = new Uint8Array(256);
      for (let i = 0; i < loudData.length; i++) {
        // 最大振幅
        loudData[i] = i % 2 === 0 ? 0 : 255;
      }
      mockAnalyser.setMockData(loudData);

      const { result } = renderHook(() =>
        useLipSync({ onMouthValueChange: mockOnMouthValueChange })
      );

      act(() => {
        result.current.startLipSync(mockAnalyser as unknown as AnalyserNode);
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockOnMouthValueChange).toHaveBeenCalled();
      const lastCallValue = mockOnMouthValueChange.mock.calls[
        mockOnMouthValueChange.mock.calls.length - 1
      ][0];
      expect(lastCallValue).toBeLessThanOrEqual(1.0); // 最大値は1.0
      expect(lastCallValue).toBeGreaterThan(0.5); // でも大きい値
    });
  });

  describe('リップシンク停止', () => {
    it('stopLipSyncでアニメーションが停止される', async () => {
      const { result } = renderHook(() =>
        useLipSync({ onMouthValueChange: mockOnMouthValueChange })
      );

      act(() => {
        result.current.startLipSync(mockAnalyser as unknown as AnalyserNode);
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const callCountBeforeStop = mockOnMouthValueChange.mock.calls.length;

      act(() => {
        result.current.stopLipSync();
      });

      // 停止後は呼ばれない
      await new Promise((resolve) => setTimeout(resolve, 10));

      // stopLipSync自体がonMouthValueChange(0)を呼ぶので+1
      expect(mockOnMouthValueChange.mock.calls.length).toBe(callCountBeforeStop + 1);
    });

    it('stopLipSyncで口の値が0にリセットされる', () => {
      const { result } = renderHook(() =>
        useLipSync({ onMouthValueChange: mockOnMouthValueChange })
      );

      act(() => {
        result.current.startLipSync(mockAnalyser as unknown as AnalyserNode);
      });

      mockOnMouthValueChange.mockClear();

      act(() => {
        result.current.stopLipSync();
      });

      expect(mockOnMouthValueChange).toHaveBeenCalledWith(0);
    });

    it('cancelAnimationFrameが呼ばれる', () => {
      const { result } = renderHook(() =>
        useLipSync({ onMouthValueChange: mockOnMouthValueChange })
      );

      act(() => {
        result.current.startLipSync(mockAnalyser as unknown as AnalyserNode);
      });

      act(() => {
        result.current.stopLipSync();
      });

      expect(cancelAnimationFrame).toHaveBeenCalled();
    });
  });

  describe('アニメーションループ', () => {
    it('requestAnimationFrameが継続的に呼ばれる', async () => {
      const requestAnimationFrameSpy = vi.spyOn(globalThis, 'requestAnimationFrame');

      const { result } = renderHook(() =>
        useLipSync({ onMouthValueChange: mockOnMouthValueChange })
      );

      act(() => {
        result.current.startLipSync(mockAnalyser as unknown as AnalyserNode);
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // 複数回呼ばれている
      expect(requestAnimationFrameSpy.mock.calls.length).toBeGreaterThan(1);
    });

    it('stopLipSync後はonMouthValueChangeが呼ばれない（0以外）', async () => {
      const { result } = renderHook(() =>
        useLipSync({ onMouthValueChange: mockOnMouthValueChange })
      );

      act(() => {
        result.current.startLipSync(mockAnalyser as unknown as AnalyserNode);
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      act(() => {
        result.current.stopLipSync();
      });

      const callCountAfterStop = mockOnMouthValueChange.mock.calls.length;

      // 停止後、少し待ってもonMouthValueChangeは呼ばれない（0のリセット呼び出し以外）
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(mockOnMouthValueChange.mock.calls.length).toBe(callCountAfterStop);
    });
  });

  describe('RMS計算', () => {
    it('異なる音量レベルで異なる口の値を返す', async () => {
      const values: number[] = [];

      // 小さい音量
      const quietData = new Uint8Array(256);
      for (let i = 0; i < quietData.length; i++) {
        quietData[i] = Math.floor(128 + 16 * Math.sin((i / 256) * Math.PI * 4));
      }
      mockAnalyser.setMockData(quietData);

      const { result, unmount } = renderHook(() =>
        useLipSync({
          onMouthValueChange: (value) => {
            values.push(value);
          },
        })
      );

      act(() => {
        result.current.startLipSync(mockAnalyser as unknown as AnalyserNode);
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const quietValue = values[values.length - 1];

      unmount();
      values.length = 0;

      // 大きい音量
      const loudData = new Uint8Array(256);
      for (let i = 0; i < loudData.length; i++) {
        loudData[i] = Math.floor(128 + 64 * Math.sin((i / 256) * Math.PI * 4));
      }
      mockAnalyser.setMockData(loudData);

      const { result: result2 } = renderHook(() =>
        useLipSync({
          onMouthValueChange: (value) => {
            values.push(value);
          },
        })
      );

      act(() => {
        result2.current.startLipSync(mockAnalyser as unknown as AnalyserNode);
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      const loudValue = values[values.length - 1];

      // 大きい音量の方が口の値も大きい
      expect(loudValue).toBeGreaterThan(quietValue);
    });

    it('全ての値が0-1の範囲内', async () => {
      const values: number[] = [];

      // ランダムなデータ
      const randomData = new Uint8Array(256);
      for (let i = 0; i < randomData.length; i++) {
        randomData[i] = Math.floor(Math.random() * 256);
      }
      mockAnalyser.setMockData(randomData);

      const { result } = renderHook(() =>
        useLipSync({
          onMouthValueChange: (value) => {
            values.push(value);
          },
        })
      );

      act(() => {
        result.current.startLipSync(mockAnalyser as unknown as AnalyserNode);
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // すべての値が0-1の範囲
      values.forEach((value) => {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('クリーンアップ', () => {
    it('unmount時にcancelAnimationFrameが呼ばれる', () => {
      const cancelAnimationFrameSpy = vi.spyOn(globalThis, 'cancelAnimationFrame');

      const { result, unmount } = renderHook(() =>
        useLipSync({ onMouthValueChange: mockOnMouthValueChange })
      );

      act(() => {
        result.current.startLipSync(mockAnalyser as unknown as AnalyserNode);
      });

      unmount();

      expect(cancelAnimationFrameSpy).toHaveBeenCalled();
    });

    it('複数回のstart/stopサイクルが正常に動作する', async () => {
      const { result } = renderHook(() =>
        useLipSync({ onMouthValueChange: mockOnMouthValueChange })
      );

      // サイクル1
      act(() => {
        result.current.startLipSync(mockAnalyser as unknown as AnalyserNode);
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      act(() => {
        result.current.stopLipSync();
      });

      mockOnMouthValueChange.mockClear();

      // サイクル2
      act(() => {
        result.current.startLipSync(mockAnalyser as unknown as AnalyserNode);
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockOnMouthValueChange).toHaveBeenCalled();
      expect(mockOnMouthValueChange.mock.calls.length).toBeGreaterThan(0);

      act(() => {
        result.current.stopLipSync();
      });

      expect(mockOnMouthValueChange).toHaveBeenCalledWith(0);
    });
  });

  describe('エッジケース', () => {
    it('analyserがnullの場合でもエラーにならない', async () => {
      const { result } = renderHook(() =>
        useLipSync({ onMouthValueChange: mockOnMouthValueChange })
      );

      // analyserなしでstopLipSyncを呼ぶ
      expect(() => {
        act(() => {
          result.current.stopLipSync();
        });
      }).not.toThrow();

      expect(mockOnMouthValueChange).toHaveBeenCalledWith(0);
    });

    it('異なるfftSizeでも動作する', async () => {
      mockAnalyser.fftSize = 512;
      const largeData = new Uint8Array(512).fill(128);
      mockAnalyser.setMockData(largeData);

      const { result } = renderHook(() =>
        useLipSync({ onMouthValueChange: mockOnMouthValueChange })
      );

      act(() => {
        result.current.startLipSync(mockAnalyser as unknown as AnalyserNode);
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockOnMouthValueChange).toHaveBeenCalled();
    });

    it('onMouthValueChangeが変更されても動作する', async () => {
      const mockCallback1 = vi.fn();
      const mockCallback2 = vi.fn();

      const { result, rerender } = renderHook(
        ({ callback }) => useLipSync({ onMouthValueChange: callback }),
        {
          initialProps: { callback: mockCallback1 },
        }
      );

      act(() => {
        result.current.startLipSync(mockAnalyser as unknown as AnalyserNode);
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockCallback1).toHaveBeenCalled();

      // コールバックを変更
      rerender({ callback: mockCallback2 });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockCallback2).toHaveBeenCalled();
    });
  });
});
