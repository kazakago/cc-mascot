import { describe, it, expect, beforeEach, vi } from "vitest";
import { getSpeakers, createAudioQuery, synthesis, speak } from "./voicevox";

describe("voicevox", () => {
  const mockBaseUrl = "http://localhost:50021";

  beforeEach(() => {
    vi.clearAllMocks();
    globalThis.fetch = vi.fn();
  });

  describe("getSpeakers", () => {
    it("スピーカー一覧を取得できる", async () => {
      const mockSpeakers = [
        {
          name: "四国めたん",
          speaker_uuid: "test-uuid-1",
          styles: [{ id: 0, name: "ノーマル" }],
        },
        {
          name: "ずんだもん",
          speaker_uuid: "test-uuid-2",
          styles: [{ id: 1, name: "ノーマル" }],
        },
      ];

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSpeakers,
      });

      const result = await getSpeakers(mockBaseUrl);

      expect(result).toEqual(mockSpeakers);
      expect(globalThis.fetch).toHaveBeenCalledWith(`${mockBaseUrl}/speakers`);
    });

    it("APIエラー時にエラーをスローする", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(getSpeakers(mockBaseUrl)).rejects.toThrow("speakers failed: 500");
    });

    it("ネットワークエラー時にエラーをスローする", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("Network error"));

      await expect(getSpeakers(mockBaseUrl)).rejects.toThrow("Network error");
    });
  });

  describe("createAudioQuery", () => {
    it("音声クエリを作成できる", async () => {
      const mockQuery = {
        accent_phrases: [],
        speedScale: 1.0,
        pitchScale: 0.0,
        intonationScale: 1.0,
        volumeScale: 1.0,
        prePhonemeLength: 0.1,
        postPhonemeLength: 0.1,
        outputSamplingRate: 24000,
        outputStereo: false,
      };

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuery,
      });

      const result = await createAudioQuery("こんにちは", 0, mockBaseUrl);

      expect(result).toEqual(mockQuery);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/audio_query?text=${encodeURIComponent("こんにちは")}&speaker=0`,
        { method: "POST" },
      );
    });

    it("テキストを正しくエンコードする", async () => {
      const specialText = "テスト&特殊文字=値";

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await createAudioQuery(specialText, 0, mockBaseUrl);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        `${mockBaseUrl}/audio_query?text=${encodeURIComponent(specialText)}&speaker=0`,
        { method: "POST" },
      );
    });

    it("異なるスピーカーIDで呼び出せる", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await createAudioQuery("テキスト", 3, mockBaseUrl);

      expect(globalThis.fetch).toHaveBeenCalledWith(expect.stringContaining("speaker=3"), expect.any(Object));
    });

    it("APIエラー時にエラーをスローする", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(createAudioQuery("テキスト", 0, mockBaseUrl)).rejects.toThrow("audio_query failed: 400");
    });
  });

  describe("synthesis", () => {
    it("音声を合成できる", async () => {
      const mockQuery = {
        accent_phrases: [],
        speedScale: 1.0,
        pitchScale: 0.0,
        intonationScale: 1.0,
        volumeScale: 1.0,
        prePhonemeLength: 0.1,
        postPhonemeLength: 0.1,
        outputSamplingRate: 24000,
        outputStereo: false,
      };

      const mockAudioData = new ArrayBuffer(1024);

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockAudioData,
      });

      const result = await synthesis(mockQuery, 0, mockBaseUrl);

      expect(result).toBe(mockAudioData);
      expect(globalThis.fetch).toHaveBeenCalledWith(`${mockBaseUrl}/synthesis?speaker=0`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mockQuery),
      });
    });

    it("クエリオブジェクトをJSON形式で送信する", async () => {
      const mockQuery = {
        accent_phrases: [{ moras: [], accent: 1 }],
        speedScale: 1.2,
        pitchScale: 0.5,
        intonationScale: 1.0,
        volumeScale: 0.8,
        prePhonemeLength: 0.1,
        postPhonemeLength: 0.1,
        outputSamplingRate: 24000,
        outputStereo: false,
      };

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(0),
      });

      await synthesis(mockQuery, 0, mockBaseUrl);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          body: JSON.stringify(mockQuery),
        }),
      );
    });

    it("APIエラー時にエラーをスローする", async () => {
      const mockQuery = {
        accent_phrases: [],
        speedScale: 1.0,
        pitchScale: 0.0,
        intonationScale: 1.0,
        volumeScale: 1.0,
        prePhonemeLength: 0.1,
        postPhonemeLength: 0.1,
        outputSamplingRate: 24000,
        outputStereo: false,
      };

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(synthesis(mockQuery, 0, mockBaseUrl)).rejects.toThrow("synthesis failed: 500");
    });
  });

  describe("speak", () => {
    it("テキストから音声を生成できる（統合）", async () => {
      const mockQuery = {
        accent_phrases: [],
        speedScale: 1.0,
        pitchScale: 0.0,
        intonationScale: 1.0,
        volumeScale: 1.0,
        prePhonemeLength: 0.1,
        postPhonemeLength: 0.1,
        outputSamplingRate: 24000,
        outputStereo: false,
      };

      const mockAudioData = new ArrayBuffer(2048);

      // 1回目の呼び出し: audio_query
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockQuery,
      });

      // 2回目の呼び出し: synthesis
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => mockAudioData,
      });

      const result = await speak("こんにちは", 0, mockBaseUrl);

      expect(result).toBe(mockAudioData);
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      expect(globalThis.fetch).toHaveBeenNthCalledWith(1, expect.stringContaining("/audio_query"), expect.any(Object));
      expect(globalThis.fetch).toHaveBeenNthCalledWith(2, expect.stringContaining("/synthesis"), expect.any(Object));
    });

    it("audio_queryのエラーを伝播する", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 400,
      });

      await expect(speak("テキスト", 0, mockBaseUrl)).rejects.toThrow("audio_query failed: 400");
    });

    it("synthesisのエラーを伝播する", async () => {
      // audio_queryは成功
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      // synthesisは失敗
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(speak("テキスト", 0, mockBaseUrl)).rejects.toThrow("synthesis failed: 500");
    });
  });

  describe("エッジケース", () => {
    it("空文字列でも処理できる", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await createAudioQuery("", 0, mockBaseUrl);

      expect(globalThis.fetch).toHaveBeenCalled();
    });

    it("長文テキストを処理できる", async () => {
      const longText = "あ".repeat(1000);

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      await createAudioQuery(longText, 0, mockBaseUrl);

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent(longText)),
        expect.any(Object),
      );
    });

    it("異なるベースURLを使用できる", async () => {
      const customUrl = "http://custom-server:12345";

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      await getSpeakers(customUrl);

      expect(globalThis.fetch).toHaveBeenCalledWith(`${customUrl}/speakers`);
    });
  });
});
