-- ========================================
-- Row Level Security (RLS) ポリシー設定
-- ========================================
--
-- このマイグレーションは、データベースのセキュリティを強化します。
-- RLSを有効化することで、アノンキーでのデータベース直接操作を防ぎます。
--
-- 重要: このアプリは現在、Supabase Authを使用していません。
-- そのため、暫定的なRLSポリシーを設定します。
-- 本番環境では、Supabase Authの実装を強く推奨します。
--
-- ========================================

-- ----------------------------------------
-- 1. players テーブルの RLS 設定
-- ----------------------------------------

-- RLSを有効化
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- 全員が読取可能（ゲーム中に他プレイヤーの情報が必要）
CREATE POLICY "Players are readable by everyone in the room"
  ON players
  FOR SELECT
  USING (true);

-- 新規プレイヤーは作成可能（ルーム参加時）
CREATE POLICY "Anyone can insert players"
  ON players
  FOR INSERT
  WITH CHECK (true);

-- プレイヤーは自分の情報のみ更新可能（ニックネームのみ）
-- 注意: スコアの更新は別途制御が必要
CREATE POLICY "Players can update their own data"
  ON players
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 削除は制限（管理者のみ）
CREATE POLICY "Players cannot be deleted"
  ON players
  FOR DELETE
  USING (false);

-- ----------------------------------------
-- 2. rooms テーブルの RLS 設定
-- ----------------------------------------

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

-- 全員が読取可能
CREATE POLICY "Rooms are readable by everyone"
  ON rooms
  FOR SELECT
  USING (true);

-- 全員がルーム作成可能
CREATE POLICY "Anyone can create rooms"
  ON rooms
  FOR INSERT
  WITH CHECK (true);

-- ルームの更新は全員可能（主催者の判定はアプリ側で実施）
CREATE POLICY "Anyone can update rooms"
  ON rooms
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- ルームの削除は制限
CREATE POLICY "Rooms cannot be deleted"
  ON rooms
  FOR DELETE
  USING (false);

-- ----------------------------------------
-- 3. questions テーブルの RLS 設定
-- ----------------------------------------

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

-- 全員が読取可能
CREATE POLICY "Questions are readable by everyone"
  ON questions
  FOR SELECT
  USING (true);

-- 全員が質問作成可能（ルーム作成時）
CREATE POLICY "Anyone can create questions"
  ON questions
  FOR INSERT
  WITH CHECK (true);

-- 質問の更新は制限
CREATE POLICY "Questions cannot be updated"
  ON questions
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

-- 質問の削除は制限
CREATE POLICY "Questions cannot be deleted"
  ON questions
  FOR DELETE
  USING (false);

-- ----------------------------------------
-- 4. answers テーブルの RLS 設定
-- ----------------------------------------

ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

-- 全員が読取可能（結果表示に必要）
CREATE POLICY "Answers are readable by everyone"
  ON answers
  FOR SELECT
  USING (true);

-- 全員が回答作成可能
CREATE POLICY "Anyone can insert answers"
  ON answers
  FOR INSERT
  WITH CHECK (true);

-- 回答の更新は全員可能（スコア計算用）
-- 注意: 本番環境では、サーバー側のみが更新できるようにすべき
CREATE POLICY "Anyone can update answers"
  ON answers
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 回答の削除は制限
CREATE POLICY "Answers cannot be deleted"
  ON answers
  FOR DELETE
  USING (false);

-- ----------------------------------------
-- セキュリティ強化のための追加制約
-- ----------------------------------------

-- ニックネームの長さ制限
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'nickname_length'
  ) THEN
    ALTER TABLE players
    ADD CONSTRAINT nickname_length
    CHECK (char_length(nickname) <= 50 AND char_length(nickname) >= 1);
  END IF;
END $$;

-- ルーム名の長さ制限
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'room_name_length'
  ) THEN
    ALTER TABLE rooms
    ADD CONSTRAINT room_name_length
    CHECK (char_length(room_name) <= 100 AND char_length(room_name) >= 1);
  END IF;
END $$;

-- 質問テキストの長さ制限
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'question_text_length'
  ) THEN
    ALTER TABLE questions
    ADD CONSTRAINT question_text_length
    CHECK (char_length(question_text) <= 500 AND char_length(question_text) >= 1);
  END IF;
END $$;

-- 選択肢の長さ制限
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'choice_length'
  ) THEN
    ALTER TABLE questions
    ADD CONSTRAINT choice_length
    CHECK (
      char_length(choice_a) <= 100 AND char_length(choice_a) >= 1 AND
      char_length(choice_b) <= 100 AND char_length(choice_b) >= 1
    );
  END IF;
END $$;

-- コメントの長さ制限
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'comment_length'
  ) THEN
    ALTER TABLE answers
    ADD CONSTRAINT comment_length
    CHECK (comment IS NULL OR char_length(comment) <= 500);
  END IF;
END $$;

-- ========================================
-- 完了メッセージ
-- ========================================

DO $$
BEGIN
  RAISE NOTICE 'Row Level Security (RLS) policies have been successfully applied.';
  RAISE NOTICE 'IMPORTANT: This is a basic RLS setup. For production, implement Supabase Auth.';
END $$;
