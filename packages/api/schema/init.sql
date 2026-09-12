-- 開発環境リセット用: 全テーブルを削除して再作成する
-- 使い方: wrangler d1 execute hono-bbs-db --local --file=schema/init.sql

DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS threads;
DROP TABLE IF EXISTS boards;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS images;
DROP TABLE IF EXISTS ip_bans;
DROP TABLE IF EXISTS reports;

-- acl 列の形式 (JSON, RBAC): {
--   "ownerUserId": string|null,
--   "grants": [{ "roleIds"?: string[], "userIds"?: string[], "actions": ("read"|"create"|"update"|"delete")[] }],
--   "authenticatedActions": (...)[],
--   "anonymousActions": (...)[]
-- }
-- ownerUserId は常にフルアクセス。grants は任意のロール/ユーザーに任意のアクションを付与できる。
-- authenticated/anonymousActions は grants に該当しない場合のフォールバック。
-- roles.id を grants.roleIds に指定することで、板ごとに自由な名前付きロールを運用できる。

-- roles を先に作成 (users が FK で参照するため)
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  -- 個別の管理権限 (JSON配列)。isSysAdmin(admin-role)は常に全権限を持つのでここには依らない。
  -- 例: ["manage_threads"]
  permissions TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,                          -- ログインID兼表示ID (英数字・ハイフン・アンダーバー、7-128文字、変更不可)
  display_name TEXT NOT NULL DEFAULT '',        -- 表示名 (日本語可)
  bio TEXT,                                     -- 自己紹介 (省略可)
  email TEXT,                                   -- メールアドレス (省略可)
  is_active INTEGER NOT NULL DEFAULT 1,         -- アカウント有効フラグ (0=無効)
  password_hash TEXT NOT NULL,
  primary_role_id TEXT,
  preferences TEXT NOT NULL DEFAULT '{}',       -- クライアント設定の同期用 (JSON、サーバー側は中身を解釈しない)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (primary_role_id) REFERENCES roles(id)
);

CREATE TABLE user_roles (
  user_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE boards (
  id TEXT PRIMARY KEY,
  acl TEXT NOT NULL DEFAULT '{"ownerUserId":null,"grants":[],"authenticatedActions":["read","create"],"anonymousActions":["read"]}',
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  max_threads INTEGER NOT NULL DEFAULT 1000,          -- 0=無制限
  max_thread_title_length INTEGER NOT NULL DEFAULT 200, -- 0=無制限
  default_max_posts INTEGER NOT NULL DEFAULT 1000,    -- 0=無制限
  default_max_post_length INTEGER NOT NULL DEFAULT 2000, -- 0=無制限
  default_max_post_lines INTEGER NOT NULL DEFAULT 100,   -- 0=無制限
  default_max_poster_name_length INTEGER NOT NULL DEFAULT 50,   -- 0=無制限
  default_max_poster_option_length INTEGER NOT NULL DEFAULT 100, -- 0=無制限
  default_poster_name TEXT NOT NULL DEFAULT '名無し',
  default_id_format TEXT NOT NULL DEFAULT 'daily_hash',
  -- スレッド/レス作成時に instantiateAcl() でコピーされるテンプレート (ownerUserId は作成時に上書きされる)
  default_thread_acl TEXT NOT NULL DEFAULT '{"ownerUserId":null,"grants":[],"authenticatedActions":["read","create","update","delete"],"anonymousActions":["read","create"]}',
  default_post_acl TEXT NOT NULL DEFAULT '{"ownerUserId":null,"grants":[],"authenticatedActions":["read","create","update","delete"],"anonymousActions":["read","create"]}',
  -- サーバー側NGワード (JSON配列): [{ "pattern": string, "isRegex": boolean, "target": "title"|"posterName"|"content" }]
  -- 一致した投稿は拒否される (client側のNGワード機能とは別物で、こちらは実際に投稿をブロックする)
  ng_words TEXT NOT NULL DEFAULT '[]',
  category TEXT NOT NULL DEFAULT '',
  icon TEXT,          -- 板アイコン画像のURL (未設定ならNULL、クライアント側でcolor_themeのアバターにフォールバック)
  color_theme TEXT,   -- 例: '#7566e6' (アイコン未設定時のアバター背景色)
  created_at TEXT NOT NULL,
  creator_user_id TEXT,
  creator_session_id TEXT,
  creator_turnstile_session_id TEXT
);

CREATE TABLE threads (
  id TEXT PRIMARY KEY,
  board_id TEXT NOT NULL,
  acl TEXT NOT NULL DEFAULT '{"ownerUserId":null,"grants":[],"authenticatedActions":["read","create","update","delete"],"anonymousActions":["read","create"]}',
  title TEXT NOT NULL,
  max_posts INTEGER NOT NULL DEFAULT 0,             -- 0=ボードのデフォルトを継承
  max_post_length INTEGER NOT NULL DEFAULT 0,
  max_post_lines INTEGER NOT NULL DEFAULT 0,
  max_poster_name_length INTEGER NOT NULL DEFAULT 0,
  max_poster_option_length INTEGER NOT NULL DEFAULT 0,
  poster_name TEXT NOT NULL DEFAULT '',             -- '' = ボードのデフォルトを継承
  id_format TEXT NOT NULL DEFAULT '',               -- '' = ボードのデフォルトを継承
  post_count INTEGER NOT NULL DEFAULT 0,
  is_edited INTEGER NOT NULL DEFAULT 0,
  edited_at TEXT,
  -- dat落ち(過去ログ化)。レス数上限到達 or 板のスレ数上限による押し出しで立つ。物理削除はしない
  is_archived INTEGER NOT NULL DEFAULT 0,
  archived_at TEXT,  -- dat落ちした時刻。一覧のTTL表示判定に使う (ARCHIVED_THREAD_VISIBLE_SECONDS)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  creator_user_id TEXT,
  creator_session_id TEXT,
  creator_turnstile_session_id TEXT,
  FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_threads_board_archived ON threads(board_id, is_archived, updated_at);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  post_number INTEGER NOT NULL,
  acl TEXT NOT NULL DEFAULT '{"ownerUserId":null,"grants":[],"authenticatedActions":["read","create","update","delete"],"anonymousActions":["read","create"]}',
  author_id TEXT NOT NULL DEFAULT '',  -- idFormat に従って計算された表示ID
  poster_name TEXT NOT NULL DEFAULT '',
  poster_option_info TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  is_edited INTEGER NOT NULL DEFAULT 0,
  edited_at TEXT,
  created_at TEXT NOT NULL,
  creator_user_id TEXT,
  creator_session_id TEXT,
  creator_turnstile_session_id TEXT,
  FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE
);

-- 画像アップロード (旧 imageUploader プラグイン)
-- S3互換ストレージ(R2/S3/MinIO)への Presigned PUT URL 発行と組み合わせて使う。
-- Worker はファイルバイトを経由せず、認可・メタデータ管理のみを担当する。
CREATE TABLE images (
  id                    TEXT    PRIMARY KEY,
  storage_key           TEXT    NOT NULL UNIQUE,
  original_filename     TEXT,
  content_type          TEXT    NOT NULL,
  size                  INTEGER,
  status                TEXT    NOT NULL DEFAULT 'pending', -- pending, active, reported, deleted
  turnstile_session_id  TEXT,
  report_count          INTEGER NOT NULL DEFAULT 0,
  created_at            TEXT    NOT NULL,
  confirmed_at          TEXT,
  expires_at            TEXT,
  delete_token          TEXT    -- アップロード者が削除するためのトークン (投稿時に生成)
);

CREATE INDEX IF NOT EXISTS idx_images_status     ON images(status);
CREATE INDEX IF NOT EXISTS idx_images_expires_at ON images(expires_at);

-- IPBAN (書き込み系エンドポイントのみをブロックする。閲覧(GET)はブロックしない)
CREATE TABLE ip_bans (
  id          TEXT    PRIMARY KEY,
  ip          TEXT    NOT NULL UNIQUE,
  reason      TEXT,
  created_at  TEXT    NOT NULL,
  created_by  TEXT                    -- BAN登録した管理者のuserId
);

-- スレッド/レスの通報キュー (画像の report_count とは別の、moderation向けの仕組み)
CREATE TABLE reports (
  id                              TEXT    PRIMARY KEY,
  target_type                     TEXT    NOT NULL,  -- 'thread' | 'post'
  board_id                        TEXT    NOT NULL,
  thread_id                       TEXT    NOT NULL,
  post_number                     INTEGER,            -- target_type='post' のときのみ
  content_snapshot                TEXT    NOT NULL,   -- 通報時点のタイトル/本文 (後から編集・削除されても残る)
  reporter_turnstile_session_id   TEXT,
  status                          TEXT    NOT NULL DEFAULT 'open', -- open, resolved, dismissed
  created_at                      TEXT    NOT NULL,
  resolved_at                     TEXT,
  resolved_by                     TEXT                -- 対応した管理者のuserId
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- 組み込みロール
-- ADMIN_USERNAME 環境変数でカスタマイズ可能 (デフォルト: admin)
-- USER_ADMIN_ROLE 環境変数でカスタマイズ可能
INSERT OR IGNORE INTO roles (id, name, created_at) VALUES
  ('user-admin-role', 'userAdminRole', '2024-01-01T00:00:00.000Z'),
  ('admin-role',      'adminRole',     '2024-01-01T00:00:00.000Z'),
  ('general-role',    'general',       '2024-01-01T00:00:00.000Z');

-- admin ユーザー (パスワードは POST /auth/setup で設定)
INSERT OR IGNORE INTO users (id, display_name, bio, email, is_active, password_hash, primary_role_id, created_at, updated_at) VALUES
  ('admin', 'admin', NULL, NULL, 1, '__NEEDS_SETUP__', 'admin-role', '2024-01-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z');

-- admin を全システムロールに追加
INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES
  ('admin', 'admin-role'),
  ('admin', 'user-admin-role'),
  ('admin', 'general-role');
