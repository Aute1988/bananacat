// PostgreSQL schema for 香蕉猫 Launchpad backend
// Run: psql -U user -d bananacat < schema.sql

-- 平台所有代币
CREATE TABLE IF NOT EXISTS tokens (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL,
  chain_id INTEGER NOT NULL,
  name VARCHAR(100) NOT NULL,
  symbol VARCHAR(20) NOT NULL,
  creator_address VARCHAR(42) NOT NULL,
  lock_period SMALLINT NOT NULL, -- 0~5
  label SMALLINT NOT NULL DEFAULT 0,    -- 🆕 分类 0-9
  image_url TEXT,                       -- 🆕 Logo URL(IPFS)
  curve_address VARCHAR(42) NOT NULL,
  lp_locker_address VARCHAR(42),
  total_supply NUMERIC(78, 0) DEFAULT 0,           -- 🆕 代币总量
  current_reserve NUMERIC(78, 0) DEFAULT 0,        -- 🆕 当前储备(平台币 wei)
  description TEXT,                                 -- 🆕 代币简介
  tax_buy_bps INTEGER DEFAULT 0,                    -- 🆕 买入税(基点,0-1000)
  tax_sell_bps INTEGER DEFAULT 0,                   -- 🆕 卖出税(基点,0-1000)
  anti_sniper_blocks INTEGER DEFAULT 0,             -- 🆕 反狙击区块数
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  graduated_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(chain_id, address)
);

-- 🆕 为缺的列补 ALTER(已存在的表)
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS label SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS total_supply NUMERIC(78, 0) DEFAULT 0;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS current_reserve NUMERIC(78, 0) DEFAULT 0;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS tax_buy_bps INTEGER DEFAULT 0;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS tax_sell_bps INTEGER DEFAULT 0;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS anti_sniper_blocks INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_tokens_creator ON tokens(creator_address);
CREATE INDEX IF NOT EXISTS idx_tokens_chain ON tokens(chain_id);
CREATE INDEX IF NOT EXISTS idx_tokens_created ON tokens(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_label ON tokens(label);                 -- 🆕
CREATE INDEX IF NOT EXISTS idx_tokens_graduated ON tokens(graduated_at);      -- 🆕

-- 🆕 索引器游标表(每条链独立)
CREATE TABLE IF NOT EXISTS sync_state (
  id SERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  key VARCHAR(50) NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(chain_id, key)
);

CREATE INDEX IF NOT EXISTS idx_sync_state_chain ON sync_state(chain_id);

-- 联合曲线状态(每条曲线一行)
CREATE TABLE IF NOT EXISTS bonding_curves (
  id SERIAL PRIMARY KEY,
  token_address VARCHAR(42) NOT NULL,
  chain_id INTEGER NOT NULL,
  curve_address VARCHAR(42) NOT NULL,
  currency_reserve NUMERIC(78, 0) NOT NULL DEFAULT 0, -- wei
  tokens_sold NUMERIC(78, 0) NOT NULL DEFAULT 0,
  graduation_target NUMERIC(78, 0) NOT NULL,
  graduated BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(chain_id, curve_address)
);

-- 交易记录(买卖)
CREATE TABLE IF NOT EXISTS trades (
  id BIGSERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  token_address VARCHAR(42) NOT NULL,
  curve_address VARCHAR(42) NOT NULL,
  trader_address VARCHAR(42) NOT NULL,
  trade_type VARCHAR(10) NOT NULL, -- 'buy' | 'sell'
  token_amount NUMERIC(78, 0) NOT NULL,
  currency_amount NUMERIC(78, 0) NOT NULL,
  fee NUMERIC(78, 0) NOT NULL,
  tx_hash VARCHAR(66) NOT NULL,
  block_number BIGINT NOT NULL,
  log_index INTEGER NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE(chain_id, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_trades_token ON trades(chain_id, token_address, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_trades_trader ON trades(chain_id, trader_address);

-- LP 锁仓记录
CREATE TABLE IF NOT EXISTS lp_locks (
  id SERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  lock_id VARCHAR(66) NOT NULL,
  token_address VARCHAR(42) NOT NULL,         -- 原代币地址 (creator 的代币)
  lp_token_address VARCHAR(42),               -- 🆕 v4: LP token 地址 (PancakeSwap pair)
  creator_address VARCHAR(42) NOT NULL,
  lp_amount NUMERIC(78, 0) NOT NULL,
  period SMALLINT NOT NULL, -- 0~5
  unlock_timestamp BIGINT, -- 0 for permanent
  claimed BOOLEAN DEFAULT FALSE,
  claimed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  tx_hash VARCHAR(66),
  UNIQUE(chain_id, lock_id)
);

-- 🆕 v4: 兼容已有数据库
ALTER TABLE lp_locks ADD COLUMN IF NOT EXISTS lp_token_address VARCHAR(42);

CREATE INDEX IF NOT EXISTS idx_lp_locks_creator ON lp_locks(chain_id, creator_address);
CREATE INDEX IF NOT EXISTS idx_lp_locks_token ON lp_locks(chain_id, token_address);
CREATE INDEX IF NOT EXISTS idx_lp_locks_unlock ON lp_locks(unlock_timestamp) WHERE NOT claimed AND period != 5;

-- 平台统计(每小时更新)
CREATE TABLE IF NOT EXISTS platform_stats (
  id SERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  hour_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  total_tokens INTEGER DEFAULT 0,
  new_tokens INTEGER DEFAULT 0,
  total_trades INTEGER DEFAULT 0,
  new_trades INTEGER DEFAULT 0,
  total_volume NUMERIC(78, 0) DEFAULT 0,
  new_volume NUMERIC(78, 0) DEFAULT 0,
  total_lp_locked NUMERIC(78, 0) DEFAULT 0,
  total_lp_burned NUMERIC(78, 0) DEFAULT 0,
  UNIQUE(chain_id, hour_timestamp)
);

-- 价格蜡烛表(K线数据,给前端画图表用)
-- interval 字段: 1m | 5m | 15m | 1h | 4h | 1d
CREATE TABLE IF NOT EXISTS price_candles (
  id BIGSERIAL PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  token_address VARCHAR(42) NOT NULL,
  interval VARCHAR(10) NOT NULL,
  open_time TIMESTAMP WITH TIME ZONE NOT NULL,
  open_price NUMERIC(38, 18) NOT NULL,
  high_price NUMERIC(38, 18) NOT NULL,
  low_price NUMERIC(38, 18) NOT NULL,
  close_price NUMERIC(38, 18) NOT NULL,
  volume NUMERIC(78, 0) NOT NULL DEFAULT 0,    -- 交易量(平台币 wei)
  trade_count INTEGER NOT NULL DEFAULT 0,
  market_cap NUMERIC(78, 0),                     -- 市值(当时)
  UNIQUE(chain_id, token_address, interval, open_time)
);

CREATE INDEX IF NOT EXISTS idx_candles_token ON price_candles(chain_id, token_address, interval, open_time DESC);
CREATE INDEX IF NOT EXISTS idx_candles_open_time ON price_candles(open_time);

-- 通知订阅表(webhook 配置)
CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,       -- new_token | trade | graduation | lock_event
  target_type VARCHAR(20) NOT NULL,      -- discord | telegram
  target_url TEXT NOT NULL,              -- webhook URL 或 chat_id
  chain_id INTEGER,                      -- NULL = 所有链
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subs_event_type ON notification_subscriptions(event_type) WHERE enabled;

-- 通知历史记录(去重用,防止重复发送)
CREATE TABLE IF NOT EXISTS notification_history (
  id BIGSERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  event_id VARCHAR(66) NOT NULL,         -- tx_hash 或 lockId
  chain_id INTEGER NOT NULL,
  target_type VARCHAR(20) NOT NULL,
  target_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL,          -- success | failed
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(event_type, event_id, target_url)
);

CREATE INDEX IF NOT EXISTS idx_notif_history_event ON notification_history(event_type, event_id);

-- ============================================================
-- 代币评论系统
-- ============================================================
CREATE TABLE IF NOT EXISTS token_comments (
  id            BIGSERIAL PRIMARY KEY,
  token_address TEXT      NOT NULL,
  chain_id      INTEGER   NOT NULL,
  user_address  TEXT      NOT NULL,
  parent_id     BIGINT REFERENCES token_comments(id) ON DELETE CASCADE,
  content       TEXT      NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  upvotes       INTEGER   NOT NULL DEFAULT 0,
  downvotes     INTEGER   NOT NULL DEFAULT 0,
  is_deleted    BOOLEAN   NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 🆕 复合索引:先按 (token, chain) 分组,然后按 parent_id 排序,然后按热度排序
CREATE INDEX IF NOT EXISTS idx_comments_parents_top
  ON token_comments(token_address, chain_id, upvotes DESC, created_at DESC)
  WHERE is_deleted = FALSE AND parent_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_comments_parents_latest
  ON token_comments(token_address, chain_id, created_at DESC)
  WHERE is_deleted = FALSE AND parent_id IS NULL;

-- 子评论按 parent_id
CREATE INDEX IF NOT EXISTS idx_comments_replies
  ON token_comments(parent_id, created_at ASC)
  WHERE is_deleted = FALSE;

-- 🆕 按 parent_id(已被 idx_comments_replies 替代,保留以防需要按纯 parent_id 查询)
CREATE INDEX IF NOT EXISTS idx_comments_user   ON token_comments(user_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_upvotes ON token_comments(token_address, upvotes DESC) WHERE is_deleted = FALSE;

-- 评论投票(防重复)
CREATE TABLE IF NOT EXISTS comment_votes (
  id           BIGSERIAL PRIMARY KEY,
  comment_id   BIGINT   NOT NULL REFERENCES token_comments(id) ON DELETE CASCADE,
  user_address TEXT     NOT NULL,
  vote_type    TEXT     NOT NULL CHECK (vote_type IN ('up', 'down', 'none')),
  voted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(comment_id, user_address)
);

CREATE INDEX IF NOT EXISTS idx_votes_comment ON comment_votes(comment_id);

-- 评论举报
CREATE TABLE IF NOT EXISTS comment_reports (
  id               BIGSERIAL PRIMARY KEY,
  comment_id       BIGINT   NOT NULL REFERENCES token_comments(id) ON DELETE CASCADE,
  reporter_address TEXT     NOT NULL,
  reason           TEXT     NOT NULL CHECK (char_length(reason) BETWEEN 1 AND 500),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports ON comment_reports(comment_id);
