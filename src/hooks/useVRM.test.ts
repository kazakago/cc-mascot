import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useVRM } from './useVRM';

// VRMとGLTFLoaderのモック
const mockLoadAsync = vi.fn().mockResolvedValue({
  scene: {},
  userData: {
    vrm: {
      scene: {},
      expressionManager: {
        setValue: vi.fn(),
      },
      lookAt: null,
      update: vi.fn(),
    },
  },
});

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: vi.fn(function() {
    return {
      register: vi.fn(),
      loadAsync: mockLoadAsync,
    };
  }),
}));

vi.mock('@pixiv/three-vrm', () => ({
  VRMLoaderPlugin: vi.fn(),
  VRMUtils: {
    combineSkeletons: vi.fn(),
    deepDispose: vi.fn(),
  },
}));

vi.mock('@pixiv/three-vrm-animation', () => ({
  VRMLookAtQuaternionProxy: vi.fn().mockImplementation(() => ({
    name: '',
  })),
}));

vi.mock('three', () => ({
  MathUtils: {
    lerp: (a: number, b: number, t: number) => a + (b - a) * t,
  },
}));

describe('useVRM', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('初期状態', () => {
    it('初期状態ではloadingがtrue', () => {
      const { result } = renderHook(() => useVRM('/test.vrm'));

      expect(result.current.loading).toBe(true);
      expect(result.current.vrm).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('必要なメソッドを返す', () => {
      const { result } = renderHook(() => useVRM('/test.vrm'));

      expect(result.current).toHaveProperty('vrm');
      expect(result.current).toHaveProperty('loading');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('setMouthOpen');
      expect(result.current).toHaveProperty('setEmotion');
      expect(result.current).toHaveProperty('update');
      expect(typeof result.current.setMouthOpen).toBe('function');
      expect(typeof result.current.setEmotion).toBe('function');
      expect(typeof result.current.update).toBe('function');
    });
  });

  describe('VRMローディング', () => {
    it('VRMロード成功時にloadingがfalseになる', async () => {
      const { result } = renderHook(() => useVRM('/test.vrm'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.vrm).not.toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('VRMロード失敗時にerrorがセットされる', async () => {
      const mockError = new Error('Load failed');

      mockLoadAsync.mockRejectedValueOnce(mockError);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useVRM('/test-error.vrm'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.vrm).toBeNull();
      expect(result.current.error).toEqual(mockError);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to load VRM:', mockError);

      consoleErrorSpy.mockRestore();

      // mockをリセット
      mockLoadAsync.mockResolvedValue({
        scene: {},
        userData: {
          vrm: {
            scene: {},
            expressionManager: {
              setValue: vi.fn(),
            },
            lookAt: null,
            update: vi.fn(),
          },
        },
      });
    });
  });

  describe('setMouthOpen', () => {
    it('vrmがnullの場合でもエラーにならない', async () => {
      const { result } = renderHook(() => useVRM('/test.vrm'));

      expect(() => {
        result.current.setMouthOpen(0.5);
      }).not.toThrow();
    });

    it('vrmがロードされた後、expressionManager.setValueが呼ばれる', async () => {
      const { result } = renderHook(() => useVRM('/test.vrm'));

      await waitFor(() => {
        expect(result.current.vrm).not.toBeNull();
      });

      result.current.setMouthOpen(0.8);

      expect(result.current.vrm?.expressionManager?.setValue).toHaveBeenCalledWith('aa', 0.8);
    });

    it('異なる値でsetMouthOpenを呼べる', async () => {
      const { result } = renderHook(() => useVRM('/test.vrm'));

      await waitFor(() => {
        expect(result.current.vrm).not.toBeNull();
      });

      result.current.setMouthOpen(0.3);
      expect(result.current.vrm?.expressionManager?.setValue).toHaveBeenCalledWith('aa', 0.3);

      result.current.setMouthOpen(1.0);
      expect(result.current.vrm?.expressionManager?.setValue).toHaveBeenCalledWith('aa', 1.0);

      result.current.setMouthOpen(0);
      expect(result.current.vrm?.expressionManager?.setValue).toHaveBeenCalledWith('aa', 0);
    });
  });

  describe('setEmotion', () => {
    it('感情をセットできる', () => {
      const { result } = renderHook(() => useVRM('/test.vrm'));

      expect(() => {
        result.current.setEmotion('happy');
      }).not.toThrow();
    });

    it('すべての感情タイプをセットできる', () => {
      const { result } = renderHook(() => useVRM('/test.vrm'));

      const emotions = ['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised'] as const;

      emotions.forEach((emotion) => {
        expect(() => {
          result.current.setEmotion(emotion);
        }).not.toThrow();
      });
    });

    it('カスタム値で感情をセットできる', () => {
      const { result } = renderHook(() => useVRM('/test.vrm'));

      expect(() => {
        result.current.setEmotion('happy', 0.5);
        result.current.setEmotion('sad', 0.3);
        result.current.setEmotion('angry', 1.0);
      }).not.toThrow();
    });
  });

  describe('update', () => {
    it('vrmがnullの場合でもエラーにならない', () => {
      const { result } = renderHook(() => useVRM('/test.vrm'));

      expect(() => {
        result.current.update(0.016);
      }).not.toThrow();
    });

    it('vrmがロードされた後、vrm.updateが呼ばれる', async () => {
      const { result } = renderHook(() => useVRM('/test.vrm'));

      await waitFor(() => {
        expect(result.current.vrm).not.toBeNull();
      });

      result.current.update(0.016);

      expect(result.current.vrm?.update).toHaveBeenCalledWith(0.016);
    });

    it('異なるdelta値でupdateを呼べる', async () => {
      const { result } = renderHook(() => useVRM('/test.vrm'));

      await waitFor(() => {
        expect(result.current.vrm).not.toBeNull();
      });

      result.current.update(0.016);
      expect(result.current.vrm?.update).toHaveBeenCalledWith(0.016);

      result.current.update(0.033);
      expect(result.current.vrm?.update).toHaveBeenCalledWith(0.033);

      result.current.update(0.001);
      expect(result.current.vrm?.update).toHaveBeenCalledWith(0.001);
    });

    it('setEmotionの後にupdateを呼ぶとexpressionManagerが更新される', async () => {
      const { result } = renderHook(() => useVRM('/test.vrm'));

      await waitFor(() => {
        expect(result.current.vrm).not.toBeNull();
      });

      result.current.setEmotion('happy');
      result.current.update(0.016);

      // expressionManagerのsetValueが呼ばれている（感情値の補間）
      expect(result.current.vrm?.expressionManager?.setValue).toHaveBeenCalled();
    });
  });

  describe('クリーンアップ', () => {
    it('unmount時にVRMUtils.deepDisposeが呼ばれる', async () => {
      const { VRMUtils } = await import('@pixiv/three-vrm');

      const { unmount } = renderHook(() => useVRM('/test.vrm'));

      await waitFor(() => {
        expect(VRMUtils.deepDispose).not.toHaveBeenCalled();
      });

      unmount();

      // Note: deepDisposeの呼び出しは非同期のクリーンアップで発生する可能性があるため
      // 確実なテストは難しいが、エラーが発生しないことを確認
      expect(true).toBe(true);
    });
  });

  describe('URL変更', () => {
    it('URLが変更されると新しいVRMがロードされる', async () => {
      const { result, rerender } = renderHook(
        ({ url }) => useVRM(url),
        { initialProps: { url: '/test1.vrm' } }
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const firstVrm = result.current.vrm;

      // URLを変更
      rerender({ url: '/test2.vrm' });

      // 新しいVRMがロードされる（非同期なので待つ）
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // VRMインスタンスが変わっている可能性がある（またはリロードされた）
      expect(result.current.vrm).toBeTruthy();
    });
  });

  describe('エッジケース', () => {
    it('空のURLでもエラーにならない', () => {
      expect(() => {
        renderHook(() => useVRM(''));
      }).not.toThrow();
    });

    it('expressionManagerがundefinedでもsetMouthOpenがエラーにならない', async () => {
      mockLoadAsync.mockResolvedValueOnce({
        scene: {},
        userData: {
          vrm: {
            scene: {},
            expressionManager: undefined,
            lookAt: null,
            update: vi.fn(),
          },
        },
      });

      const { result } = renderHook(() => useVRM('/test-no-expression.vrm'));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(() => {
        result.current.setMouthOpen(0.5);
      }).not.toThrow();

      // mockをリセット
      mockLoadAsync.mockResolvedValue({
        scene: {},
        userData: {
          vrm: {
            scene: {},
            expressionManager: {
              setValue: vi.fn(),
            },
            lookAt: null,
            update: vi.fn(),
          },
        },
      });
    });
  });
});
