-- Majority Game Database Schema

-- ルームテーブル
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_name TEXT NOT NULL DEFAULT 'マジョリティゲーム',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT DEFAULT 'waiting',
  current_question_index INTEGER DEFAULT 0,
  host_player_id UUID
);

-- 質問テーブル（1つのルームに複数の質問）
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  choice_a TEXT NOT NULL,
  choice_b TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- プレイヤーテーブル
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL,
  is_host BOOLEAN DEFAULT FALSE,
  score INTEGER DEFAULT 0, -- スコア
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 回答テーブル
CREATE TABLE IF NOT EXISTS answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  answer TEXT NOT NULL, -- 自分の回答: 'A', 'B', または自由記述
  prediction TEXT, -- 多数派予想: 'A', 'B', または自由記述
  comment TEXT, -- コメント（任意）
  is_correct_prediction BOOLEAN DEFAULT FALSE, -- 予想が当たったか
  points_earned INTEGER DEFAULT 0, -- 獲得ポイント
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(question_id, player_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_questions_room_id ON questions(room_id);
CREATE INDEX IF NOT EXISTS idx_questions_order ON questions(room_id, order_index);
CREATE INDEX IF NOT EXISTS idx_players_room_id ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_players_score ON players(room_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_answers_question_id ON answers(question_id);
CREATE INDEX IF NOT EXISTS idx_answers_player_id ON answers(player_id);
