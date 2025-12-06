-- リアクションテーブルの作成
CREATE TABLE IF NOT EXISTS reactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  answer_id UUID REFERENCES answers(id) ON DELETE CASCADE,
  player_id VARCHAR(36) NOT NULL,
  reaction VARCHAR(10) NOT NULL, -- 絵文字: 😲, 🎉, 😭, 👍, 😂
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_reactions_answer_id ON reactions(answer_id);
CREATE INDEX IF NOT EXISTS idx_reactions_player_id ON reactions(player_id);

-- 同じプレイヤーが同じ回答に同じリアクションを複数回できないようにする
CREATE UNIQUE INDEX IF NOT EXISTS idx_reactions_unique ON reactions(answer_id, player_id, reaction);

-- RLSポリシー
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reactions" ON reactions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert reactions" ON reactions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can delete own reactions" ON reactions FOR DELETE USING (true);
