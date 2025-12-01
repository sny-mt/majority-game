export type RoomStatus = 'waiting' | 'answering' | 'showing_result' | 'finished'

export interface Room {
  id: string
  room_name: string
  created_at: string
  status: RoomStatus
  current_question_index: number
  host_player_id: string | null
}

export interface Question {
  id: string
  room_id: string
  question_text: string
  choice_a: string
  choice_b: string
  order_index: number
  created_at: string
}

export interface Player {
  id: string
  room_id: string
  nickname: string
  is_host: boolean
  score: number
  joined_at: string
}

export interface Answer {
  id: string
  question_id: string
  player_id: string
  answer: string // 'A', 'B', または自由記述
  prediction: string | null // 多数派予想: 'A', 'B', または自由記述
  comment: string | null // コメント（任意）
  is_correct_prediction: boolean // 予想が当たったか
  points_earned: number // 獲得ポイント
  created_at: string
}

// Supabase型定義
export interface Database {
  public: {
    Tables: {
      rooms: {
        Row: Room
        Insert: Omit<Room, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<Room, 'id'>>
      }
      questions: {
        Row: Question
        Insert: Omit<Question, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<Question, 'id'>>
      }
      players: {
        Row: Player
        Insert: Omit<Player, 'joined_at'> & {
          joined_at?: string
        }
        Update: Partial<Omit<Player, 'id'>>
      }
      answers: {
        Row: Answer
        Insert: Omit<Answer, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<Answer, 'id'>>
      }
    }
  }
}
