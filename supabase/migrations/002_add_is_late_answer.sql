-- Add is_late_answer column to answers table
-- This column tracks whether an answer was submitted after the question period ended (reference record)

ALTER TABLE answers
ADD COLUMN IF NOT EXISTS is_late_answer BOOLEAN NOT NULL DEFAULT false;

-- Add comment to explain the column
COMMENT ON COLUMN answers.is_late_answer IS '遅れて回答した参考記録かどうか。trueの場合はポイント加算なし';
