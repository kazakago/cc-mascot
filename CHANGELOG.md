# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-02-04

### Added

- Windows向けマイクモニター機能を実装 (#92)
- サブエージェントのメッセージ処理機能を追加 (#90)
- 設定画面にサブエージェント切り替えUIを追加
- 設定画面でエンジン起動失敗時のエラー表示を追加 (#91)

### Changed

- ネイティブヘルパーのビルドプロセスとGit管理を整理 (#93)
- Windows向けビルドスクリプトを拡張
- エンジン起動関数の戻り値処理を改善

### Fixed

- vswhere.exeのパス検出とBuild Tools検索を修正
- サブエージェントメッセージ処理を文字列型contentのみに限定
- マイクミュート機能のデフォルト値をfalseに変更 (#89)

### Documentation

- READMEとCLAUDE.mdの用語を「アバター」から「キャラクター」に統一 (#94)
- package.jsonの説明文を「キャラクター」に統一

## [0.3.0] - 2025-01-XX

Initial tagged release.
