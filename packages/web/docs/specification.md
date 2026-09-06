# アプリケーション仕様

## 概要

AnonBoard は匿名掲示板フロントエンドです。ユーザーはアカウント登録なしで投稿でき、Bot対策として Cloudflare Turnstile によるセッション発行を必要とします。ログインはオプションで、ログイン時は追加の操作権限が付与されます。

---

## 画面一覧

### 1. メイン掲示板画面（`/` / `/:boardId` / `/:boardId/:threadId`）

3カラムレイアウト。

#### 左カラム — 板一覧サイドバー

- 板の一覧を表示。`GET /boards` で取得
- 折りたたみボタンでアイコンのみ表示に切り替え可能
- 現在選択中の板をハイライト（左ボーダー + 薄青背景）
- 下部にアカウント設定リンク・ログイン/ログアウトボタン
- ログイン中はユーザー表示名を表示

#### 中央カラム — スレッド一覧

- 選択中の板のスレッド一覧を表示。`GET /boards/:boardId` で取得
- スレッドカードに表示する情報：タイトル・レス数・勢い・最終更新からの相対時間
- 勢い = `postCount / 経過時間(時間)` で計算。閾値50超でトレンドバッジを表示
- 新規スレッド作成ボタン（`/new-thread/:boardId` へ遷移）
- NGフィルタリング（スレッドタイトル）を適用して表示

#### 右カラム — スレッド本文

- 選択中のスレッドの投稿一覧を表示。`GET /boards/:boardId/:threadId` で取得
- 各投稿に表示する情報：レス番号・投稿者名・sage等サブ情報・投稿日時・displayUserId
- 投稿本文内の `>>数字` をアンカーリンクとして処理（クリックで対象投稿へスクロール）
- 投稿本文内の画像URL（png/jpg/jpeg/gif/webp/bmp/svg）をサムネイル展開（24×24）
- ミニマップ：画像・動画URLを含む投稿をマーカーで表示、クリックでスクロール
- 書き込みフォーム（フッター固定）：書き込み後にスレッドを自動再取得

### 2. スレッド作成画面（`/new-thread/:boardId`）

- タイトル入力（最大文字数は板の `maxThreadTitleLength`）
- 本文入力（最大文字数は板の `defaultMaxPostLength`、Markdown対応）
- ツールバー：太字（`**text**`）・斜体（`*text*`）・コード（`code`）挿入ボタン
- プレビュートグル：本文のプレビュー表示切り替え
- 匿名投稿に関する注意事項の表示（静的）
- 投稿成功後はスレッド詳細画面（`/:boardId/:threadId`）へリダイレクト

### 3. ユーザー設定画面（`/settings`）

タブ構成：**プロフィール・設定** / 閲覧履歴（未実装）/ 投稿履歴（未実装）

#### プロフィール・設定タブ

| セクション | 内容 |
|---|---|
| プロフィール表示 | アバター（イニシャル）・表示名・ユーザーID・登録日 |
| プロフィール編集 | 表示名・自己紹介・メールアドレス（`PUT /profile`） |
| NGワード設定 | スレッドタイトル・投稿者ID・名前・本文（各4種、正規表現オプション付き） |
| 外観 | テーマ切り替え（ライト/ダーク/自動）・セーフサーチトグル |
| 通知設定 | 自分の投稿へのレス・DM・お知らせ（チェックボックス） |
| Danger Zone | アカウント削除（`DELETE /profile`、確認ダイアログあり） |

---

## 認証・セッション管理

### ログインセッション

- `POST /auth/login` でセッションIDを取得し `authStore`（localStorage）に保存
- 以降のAPIリクエストで `X-Session-Id` ヘッダーに自動付与
- セッションは24時間有効。`expiresAt` を保存し期限切れを検知
- ログアウト時は `POST /auth/logout` → `authStore` クリア

### Turnstile セッション

書き込み操作（POST/PUT/DELETE）に必要。

**本番フロー（`ALLOW_BBS_UI_DOMAINS` 設定時）**

1. 未取得の場合、`GET /auth/turnstile` へ誘導
2. ユーザーがチャレンジ完了 → `?setTurnstileToken=<sessionId>` でリダイレクト
3. `App.tsx` の `TurnstileHandler` がクエリパラメータを読み取り `turnstileStore` に保存

**開発フロー（`VITE_DISABLE_TURNSTILE=true`）**

- ストアに固定値 `"dev-turnstile-disabled"` をセット。APIへのリクエスト時に使用

---

## NGフィルタリング

すべてクライアントサイド処理。`settingsStore` に保存（localStorage永続化）。

| フィルター対象 | 設定場所 | 正規表現オプション |
|---|---|---|
| スレッドタイトル | NGワード設定 > スレッドタイトル | あり |
| 投稿者ID（displayUserId） | NGワード設定 > 投稿者ID | なし |
| 投稿者名（posterName） | NGワード設定 > 名前 | なし |
| 投稿本文（content） | NGワード設定 > レス | あり |

---

## 権限制御

APIレスポンスの `permissions` フィールド（`"owner,group,auth,anon"` 形式のビットマスク）を使ってUI表示を制御。

- `8` = GET、`4` = POST、`2` = PUT、`1` = DELETE
- `src/utils/permissions.ts` の `canDo(permissions, role, action)` で判定

ユーザーのロール判定：
- ログイン中かつ `ownerUserId` と一致 → `owner`
- ログイン中かつ `ownerGroupId` のメンバー → `group`
- ログイン中 → `auth`
- 未ログイン → `anon`

---

## データフロー

```
URLパラメータ (boardId, threadId)
  ↓
TanStack Query (useBoards / useThreads / usePosts)
  ↓
API fetch (src/api/client.ts)
  ↓ ヘッダー自動注入
Zustand Store (authStore, turnstileStore)
```

NGフィルタリングはTanStack Queryの返り値をレンダリング直前に適用する。

---

## ローカルストレージ

| キー | 内容 |
|---|---|
| `bbs-auth` | ログインセッション（sessionId・userId・displayName・expiresAt） |
| `bbs-turnstile` | TurnstileセッションID・発行日時 |
| `bbs-settings` | テーマ・セーフサーチ・NGワード・通知設定 |
