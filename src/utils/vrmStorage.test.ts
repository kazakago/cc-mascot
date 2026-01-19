import { describe, it, expect } from 'vitest';
import { createBlobURL, revokeBlobURL } from './vrmStorage';

// Note: IndexedDB関連のテスト（saveVRMFile, loadVRMFile, deleteVRMFile）は
// fake-indexeddbの複雑さと非同期処理の問題により、統合テストで実施する

describe('vrmStorage - Blob URL utilities', () => {
  describe('createBlobURL', () => {
    it('ファイルからBlob URLを作成できる', () => {
      const file = new File(['content'], 'test.vrm', { type: 'model/vnd.vrm' });
      const url = createBlobURL(file);

      expect(url).toMatch(/^blob:/);

      revokeBlobURL(url); // クリーンアップ
    });

    it('異なるファイルから異なるURLを生成する', () => {
      const file1 = new File(['content1'], 'file1.vrm', { type: 'model/vnd.vrm' });
      const file2 = new File(['content2'], 'file2.vrm', { type: 'model/vnd.vrm' });

      const url1 = createBlobURL(file1);
      const url2 = createBlobURL(file2);

      expect(url1).not.toBe(url2);

      revokeBlobURL(url1);
      revokeBlobURL(url2);
    });

    it('同じファイルでも毎回新しいURLを生成する', () => {
      const file = new File(['content'], 'test.vrm', { type: 'model/vnd.vrm' });

      const url1 = createBlobURL(file);
      const url2 = createBlobURL(file);

      expect(url1).not.toBe(url2);

      revokeBlobURL(url1);
      revokeBlobURL(url2);
    });

    it('空のファイルでもURLを生成できる', () => {
      const file = new File([], 'empty.vrm', { type: 'model/vnd.vrm' });
      const url = createBlobURL(file);

      expect(url).toMatch(/^blob:/);

      revokeBlobURL(url);
    });

    it('大きなファイルでもURLを生成できる', () => {
      const largeContent = new Uint8Array(1024 * 1024); // 1MB
      const file = new File([largeContent], 'large.vrm', { type: 'model/vnd.vrm' });
      const url = createBlobURL(file);

      expect(url).toMatch(/^blob:/);

      revokeBlobURL(url);
    });
  });

  describe('revokeBlobURL', () => {
    it('Blob URLを解放できる', () => {
      const file = new File(['content'], 'test.vrm', { type: 'model/vnd.vrm' });
      const url = createBlobURL(file);

      expect(() => revokeBlobURL(url)).not.toThrow();
    });

    it('存在しないURLでもエラーにならない', () => {
      expect(() => revokeBlobURL('blob:invalid-url')).not.toThrow();
    });

    it('同じURLを複数回解放してもエラーにならない', () => {
      const file = new File(['content'], 'test.vrm', { type: 'model/vnd.vrm' });
      const url = createBlobURL(file);

      revokeBlobURL(url);
      expect(() => revokeBlobURL(url)).not.toThrow();
    });

    it('空文字列でもエラーにならない', () => {
      expect(() => revokeBlobURL('')).not.toThrow();
    });
  });

  describe('URL lifecycle', () => {
    it('作成→解放のサイクルが正常に動作する', () => {
      const file = new File(['content'], 'test.vrm', { type: 'model/vnd.vrm' });

      // 作成
      const url = createBlobURL(file);
      expect(url).toMatch(/^blob:/);

      // 解放
      expect(() => revokeBlobURL(url)).not.toThrow();
    });

    it('複数のURLを順次作成・解放できる', () => {
      for (let i = 0; i < 5; i++) {
        const file = new File([`content${i}`], `file${i}.vrm`, { type: 'model/vnd.vrm' });
        const url = createBlobURL(file);

        expect(url).toMatch(/^blob:/);

        revokeBlobURL(url);
      }
    });

    it('複数のURLを同時に作成・まとめて解放できる', () => {
      const urls = [];

      for (let i = 0; i < 3; i++) {
        const file = new File([`content${i}`], `file${i}.vrm`, { type: 'model/vnd.vrm' });
        urls.push(createBlobURL(file));
      }

      expect(urls).toHaveLength(3);
      urls.forEach(url => expect(url).toMatch(/^blob:/));

      // まとめて解放
      urls.forEach(url => revokeBlobURL(url));
    });
  });
});
