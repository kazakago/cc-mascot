import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLocalStorage } from "./useLocalStorage";

describe("useLocalStorage", () => {
  beforeEach(() => {
    // console.errorのスパイをクリア
    vi.clearAllMocks();
  });

  describe("初期化", () => {
    it("localStorageに値がない場合、初期値を返す", () => {
      const { result } = renderHook(() => useLocalStorage("test-key", "initial"));

      expect(result.current[0]).toBe("initial");
    });

    it("localStorageに値がある場合、その値を返す", () => {
      localStorage.setItem("test-key", JSON.stringify("stored-value"));

      const { result } = renderHook(() => useLocalStorage("test-key", "initial"));

      expect(result.current[0]).toBe("stored-value");
    });

    it("数値型の初期値を使用できる", () => {
      const { result } = renderHook(() => useLocalStorage("number-key", 42));

      expect(result.current[0]).toBe(42);
    });

    it("オブジェクト型の初期値を使用できる", () => {
      const initial = { name: "test", value: 123 };
      const { result } = renderHook(() => useLocalStorage("object-key", initial));

      expect(result.current[0]).toEqual(initial);
    });

    it("配列型の初期値を使用できる", () => {
      const initial = [1, 2, 3];
      const { result } = renderHook(() => useLocalStorage("array-key", initial));

      expect(result.current[0]).toEqual(initial);
    });

    it("boolean型の初期値を使用できる", () => {
      const { result } = renderHook(() => useLocalStorage("bool-key", true));

      expect(result.current[0]).toBe(true);
    });
  });

  describe("値の設定", () => {
    it("値を設定するとlocalStorageに保存される", () => {
      const { result } = renderHook(() => useLocalStorage("test-key", "initial"));

      act(() => {
        result.current[1]("new-value");
      });

      expect(result.current[0]).toBe("new-value");
      expect(localStorage.getItem("test-key")).toBe(JSON.stringify("new-value"));
    });

    it("数値を設定できる", () => {
      const { result } = renderHook(() => useLocalStorage<number>("number-key", 0));

      act(() => {
        result.current[1](100);
      });

      expect(result.current[0]).toBe(100);
      expect(localStorage.getItem("number-key")).toBe("100");
    });

    it("オブジェクトを設定できる", () => {
      const { result } = renderHook(() =>
        useLocalStorage<{ name: string; age: number }>("object-key", { name: "", age: 0 }),
      );

      const newValue = { name: "Alice", age: 30 };

      act(() => {
        result.current[1](newValue);
      });

      expect(result.current[0]).toEqual(newValue);
      expect(JSON.parse(localStorage.getItem("object-key")!)).toEqual(newValue);
    });

    it("配列を設定できる", () => {
      const { result } = renderHook(() => useLocalStorage<number[]>("array-key", []));

      act(() => {
        result.current[1]([1, 2, 3, 4, 5]);
      });

      expect(result.current[0]).toEqual([1, 2, 3, 4, 5]);
    });

    it("null を設定できる", () => {
      const { result } = renderHook(() => useLocalStorage<string | null>("nullable-key", "initial"));

      act(() => {
        result.current[1](null);
      });

      expect(result.current[0]).toBeNull();
      expect(localStorage.getItem("nullable-key")).toBe("null");
    });

    it("複数回の値変更が正しく動作する", () => {
      const { result } = renderHook(() => useLocalStorage("counter", 0));

      act(() => {
        result.current[1](1);
      });
      expect(result.current[0]).toBe(1);

      act(() => {
        result.current[1](2);
      });
      expect(result.current[0]).toBe(2);

      act(() => {
        result.current[1](3);
      });
      expect(result.current[0]).toBe(3);
    });
  });

  describe("永続化", () => {
    it("設定した値が再マウント後も保持される", () => {
      const { result: result1, unmount } = renderHook(() => useLocalStorage("persist-key", "initial"));

      act(() => {
        result1.current[1]("persisted-value");
      });

      unmount();

      const { result: result2 } = renderHook(() => useLocalStorage("persist-key", "initial"));

      expect(result2.current[0]).toBe("persisted-value");
    });

    it("異なるキーで独立して動作する", () => {
      const { result: result1 } = renderHook(() => useLocalStorage("key1", "value1"));
      const { result: result2 } = renderHook(() => useLocalStorage("key2", "value2"));

      act(() => {
        result1.current[1]("updated1");
      });

      expect(result1.current[0]).toBe("updated1");
      expect(result2.current[0]).toBe("value2");
    });
  });

  describe("エラーハンドリング", () => {
    it("不正なJSONが保存されている場合、初期値を返す", () => {
      localStorage.setItem("invalid-json", "this is not valid JSON {");

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { result } = renderHook(() => useLocalStorage("invalid-json", "fallback"));

      expect(result.current[0]).toBe("fallback");
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it("localStorageが利用できない場合でもクラッシュしない", () => {
      const getItemSpy = vi.spyOn(global.localStorage, "getItem").mockImplementation(() => {
        throw new Error("localStorage is not available");
      });
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { result } = renderHook(() => useLocalStorage("error-key", "default"));

      expect(result.current[0]).toBe("default");
      expect(consoleSpy).toHaveBeenCalled();

      getItemSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it("setItemがエラーをスローしてもクラッシュしない", () => {
      const setItemSpy = vi.spyOn(global.localStorage, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { result } = renderHook(() => useLocalStorage("quota-key", "initial"));

      act(() => {
        result.current[1]("new-value");
      });

      // 値は更新されるがlocalStorageには保存されない
      expect(result.current[0]).toBe("new-value");
      expect(consoleSpy).toHaveBeenCalled();

      setItemSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe("型安全性", () => {
    it("型パラメータで指定した型が正しく推論される", () => {
      const { result } = renderHook(() => useLocalStorage<number>("typed-key", 0));

      // TypeScriptの型チェックで確認される
      act(() => {
        result.current[1](123);
      });

      expect(result.current[0]).toBe(123);
    });

    it("複雑な型でも動作する", () => {
      interface User {
        id: number;
        name: string;
        settings: {
          theme: "light" | "dark";
          notifications: boolean;
        };
      }

      const initialUser: User = {
        id: 1,
        name: "Test User",
        settings: {
          theme: "light",
          notifications: true,
        },
      };

      const { result } = renderHook(() => useLocalStorage<User>("user-key", initialUser));

      act(() => {
        result.current[1]({
          ...initialUser,
          settings: { ...initialUser.settings, theme: "dark" },
        });
      });

      expect(result.current[0].settings.theme).toBe("dark");
    });
  });

  describe("エッジケース", () => {
    it("空文字列をキーとして使用できる", () => {
      const { result } = renderHook(() => useLocalStorage("", "value"));

      expect(result.current[0]).toBe("value");
    });

    it("特殊文字を含むキーを使用できる", () => {
      const specialKey = "test:key-with_special.chars@123";
      const { result } = renderHook(() => useLocalStorage(specialKey, "value"));

      act(() => {
        result.current[1]("updated");
      });

      expect(localStorage.getItem(specialKey)).toBe(JSON.stringify("updated"));
    });

    it("undefined を初期値として使用できる", () => {
      const { result } = renderHook(() => useLocalStorage<string | undefined>("undefined-key", undefined));

      expect(result.current[0]).toBeUndefined();
    });
  });
});
