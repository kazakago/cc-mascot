import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useVRMAnimation } from "./useVRMAnimation";
import type { VRM } from "@pixiv/three-vrm";

// Mock VRM
const createMockVRM = (): VRM =>
  ({
    scene: {},
  }) as unknown as VRM;

// Three.jsとVRMAnimationのモック
const mockMixer = {
  update: vi.fn(),
  stopAllAction: vi.fn(),
  clipAction: vi.fn(() => ({
    setLoop: vi.fn(),
    clampWhenFinished: false,
    fadeOut: vi.fn(),
    fadeIn: vi.fn(),
    reset: vi.fn(),
    play: vi.fn(),
  })),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

vi.mock("three", () => ({
  AnimationMixer: vi.fn(function () {
    return mockMixer;
  }),
  LoopOnce: 1,
}));

const mockLoadAsync = vi.fn().mockResolvedValue({
  userData: {
    vrmAnimations: [
      {
        name: "test-animation",
      },
    ],
  },
});

vi.mock("three/examples/jsm/loaders/GLTFLoader.js", () => ({
  GLTFLoader: vi.fn(function () {
    return {
      register: vi.fn(),
      loadAsync: mockLoadAsync,
    };
  }),
}));

vi.mock("@pixiv/three-vrm-animation", () => ({
  VRMAnimationLoaderPlugin: vi.fn(),
  createVRMAnimationClip: vi.fn(() => ({ name: "mock-clip" })),
}));

describe("useVRMAnimation", () => {
  let mockVRM: VRM;

  beforeEach(() => {
    vi.clearAllMocks();
    mockVRM = createMockVRM();
  });

  describe("初期化", () => {
    it("updateメソッドを返す", () => {
      const { result } = renderHook(() => useVRMAnimation(mockVRM, "/test.vrma"));

      expect(result.current).toHaveProperty("update");
      expect(typeof result.current.update).toBe("function");
    });

    it("vrmがnullでもエラーにならない", () => {
      expect(() => {
        renderHook(() => useVRMAnimation(null, "/test.vrma"));
      }).not.toThrow();
    });

    it("animationUrlが空でもエラーにならない", () => {
      expect(() => {
        renderHook(() => useVRMAnimation(mockVRM, ""));
      }).not.toThrow();
    });
  });

  describe("VRMAローディング", () => {
    it("animationUrlが指定されている場合、VRMAをロードする", async () => {
      renderHook(() => useVRMAnimation(mockVRM, "/test.vrma"));

      await waitFor(() => {
        expect(mockLoadAsync).toHaveBeenCalledWith("/test.vrma");
      });
    });

    it("ロード失敗時にエラーログが出力される", async () => {
      const mockError = new Error("Load failed");
      mockLoadAsync.mockRejectedValueOnce(mockError);

      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      renderHook(() => useVRMAnimation(mockVRM, "/test-error.vrma"));

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to load VRMA:", mockError);
      });

      consoleErrorSpy.mockRestore();

      // mockをリセット
      mockLoadAsync.mockResolvedValue({
        userData: {
          vrmAnimations: [{ name: "test-animation" }],
        },
      });
    });
  });

  describe("AnimationMixer", () => {
    it("vrmが指定されている場合、AnimationMixerが作成される", () => {
      const { result } = renderHook(() => useVRMAnimation(mockVRM, "/test.vrma"));

      // updateを呼んで、mixerが動作していることを確認
      result.current.update(0.016);

      // mockMixerのupdateが呼ばれていればAnimationMixerが作成されている
      expect(mockMixer.update).toHaveBeenCalled();
    });

    it("unmount時にstopAllActionが呼ばれる", () => {
      const { unmount } = renderHook(() => useVRMAnimation(mockVRM, "/test.vrma"));

      unmount();

      expect(mockMixer.stopAllAction).toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("mixerがnullの場合でもエラーにならない", () => {
      const { result } = renderHook(() => useVRMAnimation(null, "/test.vrma"));

      expect(() => {
        result.current.update(0.016);
      }).not.toThrow();
    });

    it("mixerが存在する場合、mixer.updateが呼ばれる", () => {
      const { result } = renderHook(() => useVRMAnimation(mockVRM, "/test.vrma"));

      result.current.update(0.016);

      expect(mockMixer.update).toHaveBeenCalledWith(0.016);
    });

    it("異なるdelta値でupdateを呼べる", () => {
      const { result } = renderHook(() => useVRMAnimation(mockVRM, "/test.vrma"));

      result.current.update(0.016);
      expect(mockMixer.update).toHaveBeenCalledWith(0.016);

      result.current.update(0.033);
      expect(mockMixer.update).toHaveBeenCalledWith(0.033);

      result.current.update(0.001);
      expect(mockMixer.update).toHaveBeenCalledWith(0.001);
    });
  });

  describe("オプション", () => {
    it("loopオプションでループ再生を制御できる", async () => {
      renderHook(() => useVRMAnimation(mockVRM, "/test.vrma", { loop: false }));

      // VRMAのロード完了を待つ
      await waitFor(() => {
        expect(mockLoadAsync).toHaveBeenCalled();
      });

      // クリップアクションが作成される
      await waitFor(() => {
        expect(mockMixer.clipAction).toHaveBeenCalled();
      });

      // setLoopが呼ばれている（loop=falseの場合）
      const action = mockMixer.clipAction.mock.results[0].value;
      expect(action.setLoop).toHaveBeenCalled();
    });

    it("onAnimationEndコールバックを設定できる", async () => {
      const onAnimationEnd = vi.fn();

      renderHook(() => useVRMAnimation(mockVRM, "/test.vrma", { loop: false, onAnimationEnd }));

      // VRMAのロード完了を待つ
      await waitFor(() => {
        expect(mockLoadAsync).toHaveBeenCalled();
      });

      // イベントリスナーが登録される
      await waitFor(() => {
        expect(mockMixer.addEventListener).toHaveBeenCalledWith("finished", expect.any(Function));
      });
    });

    it("loopがtrueの場合、onAnimationEndは無視される", async () => {
      const onAnimationEnd = vi.fn();

      renderHook(() => useVRMAnimation(mockVRM, "/test.vrma", { loop: true, onAnimationEnd }));

      // VRMAのロード完了を待つ
      await waitFor(() => {
        expect(mockLoadAsync).toHaveBeenCalled();
      });

      // イベントリスナーは登録されない
      await new Promise((resolve) => setTimeout(resolve, 100));

      // finishedイベントリスナーは登録されていない
      expect(mockMixer.addEventListener).not.toHaveBeenCalledWith("finished", expect.any(Function));
    });
  });

  describe("アニメーション切り替え", () => {
    it("新しいアニメーションURLに変更すると再ロードされる", async () => {
      const { rerender } = renderHook(({ url }) => useVRMAnimation(mockVRM, url), {
        initialProps: { url: "/test1.vrma" },
      });

      await waitFor(() => {
        expect(mockLoadAsync).toHaveBeenCalledWith("/test1.vrma");
      });

      mockLoadAsync.mockClear();

      // URLを変更
      rerender({ url: "/test2.vrma" });

      await waitFor(() => {
        expect(mockLoadAsync).toHaveBeenCalledWith("/test2.vrma");
      });
    });

    it("同じURLでは再ロードされない", async () => {
      const { rerender } = renderHook(({ url }) => useVRMAnimation(mockVRM, url), {
        initialProps: { url: "/test.vrma" },
      });

      await waitFor(() => {
        expect(mockLoadAsync).toHaveBeenCalledTimes(1);
      });

      mockLoadAsync.mockClear();

      // 同じURLで再レンダリング
      rerender({ url: "/test.vrma" });

      // 新しいロードは発生しない
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(mockLoadAsync).not.toHaveBeenCalled();
    });
  });

  describe("エッジケース", () => {
    it("vrmAnimationsが空配列でもエラーにならない", async () => {
      mockLoadAsync.mockResolvedValueOnce({
        userData: {
          vrmAnimations: [],
        },
      });

      expect(() => {
        renderHook(() => useVRMAnimation(mockVRM, "/test-empty.vrma"));
      }).not.toThrow();

      // mockをリセット
      mockLoadAsync.mockResolvedValue({
        userData: {
          vrmAnimations: [{ name: "test-animation" }],
        },
      });
    });

    it("vrmAnimationsがundefinedでもエラーにならない", async () => {
      mockLoadAsync.mockResolvedValueOnce({
        userData: {},
      });

      expect(() => {
        renderHook(() => useVRMAnimation(mockVRM, "/test-no-animations.vrma"));
      }).not.toThrow();

      // mockをリセット
      mockLoadAsync.mockResolvedValue({
        userData: {
          vrmAnimations: [{ name: "test-animation" }],
        },
      });
    });

    it("VRMが後から設定されてもエラーにならない", () => {
      const { rerender } = renderHook(({ vrm }) => useVRMAnimation(vrm, "/test.vrma"), { initialProps: { vrm: null } });

      // VRMを設定
      rerender({ vrm: mockVRM });

      expect(() => {
        rerender({ vrm: mockVRM });
      }).not.toThrow();
    });
  });
});
