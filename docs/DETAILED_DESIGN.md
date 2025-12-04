# マジョリティゲーム 詳細設計書

## 目次
1. [共通処理](#1-共通処理)
2. [ホーム画面](#2-ホーム画面)
3. [参加画面](#3-参加画面)
4. [待機画面](#4-待機画面)
5. [回答画面](#5-回答画面)
6. [結果画面](#6-結果画面)
7. [最終結果画面](#7-最終結果画面)
8. [ユーティリティ関数](#8-ユーティリティ関数)
9. [コンポーネント](#9-コンポーネント)

---

## 1. 共通処理

### 1.1 プレイヤーID管理 (`lib/utils/player.ts`)

プレイヤーの識別はlocalStorageに保存されたUUIDで行います。

```typescript
// UUIDv4を生成
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// localStorageからプレイヤーIDを取得、なければ生成して保存
export function getOrCreatePlayerId(): string {
  // SSR時は空文字を返す
  if (typeof window === 'undefined') return ''

  let playerId = localStorage.getItem('majority_game_player_id')
  if (!playerId) {
    playerId = generateUUID()
    localStorage.setItem('majority_game_player_id', playerId)
  }
  return playerId
}
```

**処理フロー:**
1. `typeof window === 'undefined'` でSSR判定
2. localStorageから既存IDを取得
3. なければ新規UUID生成して保存
4. IDを返却

### 1.2 入力バリデーション (`lib/utils/validation.ts`)

全ての入力値はサニタイズとバリデーションを実施。

```typescript
// HTMLエスケープ（XSS対策）
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// 入力値のサニタイズ
export function sanitizeInput(input: string, maxLength: number = 500): string {
  return escapeHtml(input.trim()).slice(0, maxLength)
}

// ニックネームバリデーション
export function validateNickname(nickname: string): ValidationResult {
  if (!nickname || nickname.trim().length === 0) {
    return { valid: false, error: 'ニックネームを入力してください' }
  }
  if (nickname.length > 50) {
    return { valid: false, error: 'ニックネームは50文字以内で入力してください' }
  }
  return { valid: true }
}
```

### 1.3 Supabaseクライアント (`lib/supabase.ts`)

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 1.4 回答集計ロジック (`lib/utils/aggregation.ts`)

```typescript
export interface AnswerGroup {
  answer: string      // 回答テキスト
  count: number       // 回答人数
  percentage: number  // 割合
  players: string[]   // 回答したプレイヤー名
  isMajority: boolean // マジョリティフラグ
}

export function aggregateAnswers(
  answers: Answer[],
  players: Player[],
  choiceA: string,
  choiceB: string
): AnswerGroup[] {
  // 1. 回答をグループ化
  const groups = new Map<string, { count: number; players: string[] }>()

  answers.forEach(answer => {
    // A/Bを選択肢テキストに変換
    let displayAnswer = answer.answer
    if (displayAnswer === 'A') displayAnswer = `${choiceA} (A)`
    if (displayAnswer === 'B') displayAnswer = `${choiceB} (B)`

    const player = players.find(p => p.id === answer.player_id)
    const group = groups.get(displayAnswer) || { count: 0, players: [] }
    group.count++
    if (player) group.players.push(player.nickname)
    groups.set(displayAnswer, group)
  })

  // 2. 最大回答数を特定
  const maxCount = Math.max(...Array.from(groups.values()).map(g => g.count))

  // 3. AnswerGroup配列に変換
  const total = answers.length
  return Array.from(groups.entries())
    .map(([answer, data]) => ({
      answer,
      count: data.count,
      percentage: (data.count / total) * 100,
      players: data.players,
      isMajority: data.count === maxCount  // 同率1位も全てマジョリティ
    }))
    .sort((a, b) => b.count - a.count)  // 多い順にソート
}
```

---

## 2. ホーム画面

**ファイル:** `app/page.tsx`

### 2.1 State定義

```typescript
const [roomName, setRoomName] = useState('')           // ルーム名
const [hostNickname, setHostNickname] = useState('')   // ホスト名
const [questions, setQuestions] = useState<QuestionInput[]>([
  { questionText: '', choiceA: '', choiceB: '' }       // 質問リスト
])
const [roomUrl, setRoomUrl] = useState('')             // 生成されたURL
const [isCreating, setIsCreating] = useState(false)   // 作成中フラグ
const [error, setError] = useState('')                 // エラーメッセージ
const [pastRooms, setPastRooms] = useState<PastRoom[]>([])  // 過去ルーム
const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null)  // 進行中ルーム
const [qrDataUrl, setQrDataUrl] = useState('')         // QRコードデータURL
```

### 2.2 初期化処理 (useEffect)

```typescript
useEffect(() => {
  const loadPastRooms = async () => {
    const playerId = getOrCreatePlayerId()

    // 1. 進行中のルームをチェック
    const { data: playerData } = await supabase
      .from('players')
      .select('room_id')
      .eq('id', playerId)
      .single()

    if (playerData) {
      const { data: roomData } = await supabase
        .from('rooms')
        .select('id, room_name, status')
        .eq('id', playerData.room_id)
        .single()

      // waiting以外なら「進行中」として表示
      if (roomData && roomData.status !== 'waiting') {
        setActiveRoom(roomData)
      }
    }

    // 2. 過去に作成したルームを取得（最新5件）
    const { data: roomsData } = await supabase
      .from('rooms')
      .select('id, room_name, created_at')
      .eq('host_player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(5)

    // 3. 各ルームの質問数を取得
    if (roomsData) {
      const roomsWithCount = await Promise.all(
        roomsData.map(async (room) => {
          const { count } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('room_id', room.id)
          return { ...room, question_count: count || 0 }
        })
      )
      setPastRooms(roomsWithCount)
    }
  }

  loadPastRooms()
}, [])
```

### 2.3 ルーム作成処理

```typescript
const handleCreateRoom = async () => {
  setIsCreating(true)
  setError('')

  try {
    const hostPlayerId = getOrCreatePlayerId()

    // 1. 入力値のバリデーション
    const sanitizedNickname = sanitizeInput(hostNickname, 50)
    const nicknameValidation = validateNickname(sanitizedNickname)
    if (!nicknameValidation.valid) throw new Error(nicknameValidation.error)

    // 2. ルームをDBに作成
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .insert({
        room_name: sanitizedRoomName,
        status: 'waiting',
        current_question_index: 0,
        host_player_id: hostPlayerId
      })
      .select()
      .single()

    if (roomError) throw roomError

    // 3. 質問をDBに作成
    const questionsData = validatedQuestions.map((q, index) => ({
      room_id: room.id,
      question_text: q.questionText,
      choice_a: q.choiceA,
      choice_b: q.choiceB,
      order_index: index
    }))

    await supabase.from('questions').insert(questionsData)

    // 4. ホストをプレイヤーとして登録
    await supabase.from('players').upsert({
      id: hostPlayerId,
      room_id: room.id,
      nickname: sanitizedNickname,
      is_host: true,
      score: 0
    }, { onConflict: 'id' })

    // 5. 参加用URLを生成
    const url = `${window.location.origin}/room/${room.id}/join`
    setRoomUrl(url)

  } catch (err) {
    setError(err.message)
  } finally {
    setIsCreating(false)
  }
}
```

### 2.4 過去ルームからの質問読み込み

```typescript
const loadRoomQuestions = async (roomId: string, roomName: string) => {
  const { data: questionsData } = await supabase
    .from('questions')
    .select('question_text, choice_a, choice_b, order_index')
    .eq('room_id', roomId)
    .order('order_index')

  if (questionsData && questionsData.length > 0) {
    // 質問フォームに読み込み
    const loadedQuestions = questionsData.map(q => ({
      questionText: q.question_text,
      choiceA: q.choice_a,
      choiceB: q.choice_b
    }))
    setQuestions(loadedQuestions)
    setRoomName(roomName)
  }
}
```

### 2.5 QRコード生成

```typescript
// QRCodeCanvasでcanvasを生成し、データURLに変換
useEffect(() => {
  if (!roomUrl) return

  const timer = setTimeout(() => {
    const canvas = document.querySelector('#qr-canvas-home canvas')
    if (canvas) {
      setQrDataUrl(canvas.toDataURL('image/png'))
    }
  }, 100)

  return () => clearTimeout(timer)
}, [roomUrl])
```

---

## 3. 参加画面

**ファイル:** `app/room/[roomId]/join/page.tsx`

### 3.1 State定義

```typescript
const [nickname, setNickname] = useState('')
const [isJoining, setIsJoining] = useState(false)
const [error, setError] = useState('')
const [roomExists, setRoomExists] = useState(true)
const [isCheckingRoom, setIsCheckingRoom] = useState(true)
const [roomName, setRoomName] = useState('')
```

### 3.2 ルーム存在確認 (useEffect)

```typescript
useEffect(() => {
  const checkRoom = async () => {
    const { data, error } = await supabase
      .from('rooms')
      .select('id, room_name')
      .eq('id', roomId)
      .single()

    if (error || !data) {
      setRoomExists(false)
    } else {
      setRoomName(data.room_name || 'マジョリティゲーム')
    }
    setIsCheckingRoom(false)
  }

  checkRoom()
}, [roomId])
```

### 3.3 参加処理

```typescript
const handleJoin = async () => {
  setIsJoining(true)
  setError('')

  try {
    // 1. ニックネームのバリデーション
    const sanitizedNickname = sanitizeInput(nickname, 50)
    const validation = validateNickname(sanitizedNickname)
    if (!validation.valid) throw new Error(validation.error)

    // 2. プレイヤーIDを取得
    const playerId = getOrCreatePlayerId()

    // 3. ルーム情報を取得（ステータス確認用）
    const { data: roomData } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    // 4. 既に参加済みかチェック
    const { data: existingPlayer } = await supabase
      .from('players')
      .select('id')
      .eq('id', playerId)
      .eq('room_id', roomId)
      .single()

    if (existingPlayer) {
      // 既に参加済み → ステータスに応じて遷移
      navigateByStatus(roomData.status)
      return
    }

    // 5. プレイヤーを登録
    await supabase.from('players').upsert({
      id: playerId,
      room_id: roomId,
      nickname: sanitizedNickname,
      is_host: false,
      score: 0
    }, { onConflict: 'id' })

    // 6. ステータスに応じて遷移
    navigateByStatus(roomData.status)

  } catch (err) {
    setError(err.message)
    setIsJoining(false)
  }
}

// ステータスに応じた画面遷移
const navigateByStatus = (status: string) => {
  switch (status) {
    case 'answering':
      router.push(`/room/${roomId}/answer`)
      break
    case 'showing_result':
      router.push(`/room/${roomId}/result`)
      break
    case 'finished':
      router.push(`/room/${roomId}/summary`)
      break
    default:
      router.push(`/room/${roomId}/waiting`)
  }
}
```

---

## 4. 待機画面

**ファイル:** `app/room/[roomId]/waiting/page.tsx`

### 4.1 State定義

```typescript
const [room, setRoom] = useState<Room | null>(null)
const [players, setPlayers] = useState<Player[]>([])
const [isHost, setIsHost] = useState(false)
const [isLoading, setIsLoading] = useState(true)
const [isStarting, setIsStarting] = useState(false)
const [showAllPlayers, setShowAllPlayers] = useState(false)
const [qrDataUrl, setQrDataUrl] = useState('')
const [showHowToPlay, setShowHowToPlay] = useState(false)
```

### 4.2 初期化処理

```typescript
useEffect(() => {
  const initializeWaiting = async () => {
    const pid = getOrCreatePlayerId()
    setPlayerId(pid)

    // 1. ルーム情報を取得
    const { data: roomData } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    setRoom(roomData)
    setIsHost(roomData.host_player_id === pid)

    // 2. 参加者リストを取得
    const { data: playersData } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('joined_at')

    setPlayers(playersData || [])
    setIsLoading(false)
  }

  initializeWaiting()
}, [roomId])
```

### 4.3 リアルタイム購読

```typescript
useEffect(() => {
  if (!room) return

  // 1. プレイヤーの追加を監視
  const playersChannel = supabase
    .channel(`players:${roomId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'players',
      filter: `room_id=eq.${roomId}`
    }, (payload) => {
      // 新しいプレイヤーをリストに追加
      setPlayers(prev => [...prev, payload.new as Player])
    })
    .subscribe()

  // 2. ルームのステータス変更を監視
  const roomChannel = supabase
    .channel(`room:${roomId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${roomId}`
    }, (payload) => {
      const updatedRoom = payload.new as Room
      setRoom(updatedRoom)

      // answering になったら回答画面へ遷移
      if (updatedRoom.status === 'answering') {
        router.push(`/room/${roomId}/answer`)
      }
    })
    .subscribe()

  return () => {
    playersChannel.unsubscribe()
    roomChannel.unsubscribe()
  }
}, [room, roomId, router])
```

### 4.4 ゲーム開始処理（ホストのみ）

```typescript
const handleStartGame = async () => {
  if (!isHost || players.length < 2) return

  setIsStarting(true)

  // ルームのステータスを 'answering' に更新
  const { error } = await supabase
    .from('rooms')
    .update({ status: 'answering' })
    .eq('id', roomId)

  if (error) {
    alert('ゲームの開始に失敗しました')
    setIsStarting(false)
    return
  }

  router.push(`/room/${roomId}/answer`)
}
```

---

## 5. 回答画面

**ファイル:** `app/room/[roomId]/answer/page.tsx`

### 5.1 State定義

```typescript
const [room, setRoom] = useState<Room | null>(null)
const [question, setQuestion] = useState<Question | null>(null)
const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
const [freeText, setFreeText] = useState('')
const [prediction, setPrediction] = useState<string | null>(null)
const [comment, setComment] = useState('')
const [hasAnswered, setHasAnswered] = useState(false)
const [isSubmitting, setIsSubmitting] = useState(false)
const [answeredCount, setAnsweredCount] = useState(0)
const [totalPlayers, setTotalPlayers] = useState(0)
const [isHost, setIsHost] = useState(false)
const [isLateAnswer, setIsLateAnswer] = useState(false)
const [showConfirmDialog, setShowConfirmDialog] = useState(false)
```

### 5.2 初期化処理

```typescript
useEffect(() => {
  const initializeAnswer = async () => {
    const pid = getOrCreatePlayerId()
    setPlayerId(pid)

    // 1. ルーム情報を取得
    const { data: roomData } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    setRoom(roomData)
    setIsHost(roomData.host_player_id === pid)

    // 2. 現在の質問を取得
    const { data: questionData } = await supabase
      .from('questions')
      .select('*')
      .eq('room_id', roomId)
      .eq('order_index', roomData.current_question_index)
      .single()

    setQuestion(questionData)

    // 3. プレイヤー総数を取得
    const { count: playerCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)

    setTotalPlayers(playerCount || 0)

    // 4. 既存の回答を取得（回答済みチェック）
    const { data: answersData } = await supabase
      .from('answers')
      .select('*')
      .eq('question_id', questionData.id)

    setAnsweredCount(answersData?.length || 0)

    // 自分が既に回答済みか確認
    const myAnswer = answersData?.find(a => a.player_id === pid)
    if (myAnswer) {
      setHasAnswered(true)
      setSelectedAnswer(myAnswer.answer)
      // ... 既存の回答を復元
    }

    // 結果表示中なら遅延参加フラグを立てる
    if (roomData.status === 'showing_result') {
      setIsLateAnswer(true)
    }

    setIsLoading(false)
  }

  initializeAnswer()
}, [roomId])
```

### 5.3 リアルタイム購読

```typescript
useEffect(() => {
  if (!question) return

  // 1. 回答数の変化を監視
  const answersChannel = supabase
    .channel(`answers:${question.id}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'answers',
      filter: `question_id=eq.${question.id}`
    }, () => {
      // 回答数をインクリメント
      setAnsweredCount(prev => prev + 1)
    })
    .subscribe()

  // 2. ルームステータスの変化を監視
  const roomChannel = supabase
    .channel(`room_answer:${roomId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${roomId}`
    }, (payload) => {
      const updatedRoom = payload.new as Room
      setRoom(updatedRoom)

      // 結果画面へ遷移
      if (updatedRoom.status === 'showing_result') {
        // ホストは即遷移、他は3秒後
        if (isHost) {
          router.push(`/room/${roomId}/result`)
        } else {
          setShowTransitionSnackbar(true)
        }
      }
    })
    .subscribe()

  return () => {
    answersChannel.unsubscribe()
    roomChannel.unsubscribe()
  }
}, [question, roomId, isHost, router])
```

### 5.4 回答選択処理

```typescript
// 選択肢A/Bの選択
const handleSelectAnswer = (answer: 'A' | 'B') => {
  if (hasAnswered) return
  setSelectedAnswer(answer)
  setFreeText('')  // 自由記述をクリア
}

// 自由記述の入力
const handleFreeTextChange = (text: string) => {
  if (hasAnswered) return
  setFreeText(text)
  if (text.trim()) {
    setSelectedAnswer(null)  // A/Bの選択をクリア
  }
}

// 多数派予想の選択
const handlePredictionChange = (value: string) => {
  if (hasAnswered) return
  setPrediction(value)
}
```

### 5.5 回答送信処理

```typescript
const handleConfirmSubmit = async () => {
  setShowConfirmDialog(false)
  setIsSubmitting(true)

  try {
    const finalAnswer = freeText.trim() || selectedAnswer

    // 1. バリデーション
    if (!finalAnswer) throw new Error('回答を選択してください')

    // 2. 回答をDBに保存
    const answerData = {
      question_id: question.id,
      player_id: playerId,
      answer: sanitizeInput(finalAnswer, 100),
      prediction: isLateAnswer ? null : prediction,
      comment: sanitizeInput(comment, 500),
      is_correct_prediction: false,
      points_earned: 0
    }

    const { error } = await supabase
      .from('answers')
      .insert(answerData)

    if (error) throw error

    setHasAnswered(true)

    // 3. 紙吹雪エフェクト
    import('canvas-confetti').then((confettiModule) => {
      confettiModule.default({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#667eea', '#764ba2', '#10b981'],
      })
    })

  } catch (err) {
    setError(err.message)
  } finally {
    setIsSubmitting(false)
  }
}
```

### 5.6 回答締め切り処理（ホストのみ）

```typescript
const handleCloseAnswers = async () => {
  if (!isHost) return

  // ステータスを 'showing_result' に更新
  const { error } = await supabase
    .from('rooms')
    .update({ status: 'showing_result' })
    .eq('id', roomId)

  if (error) {
    alert('締め切りに失敗しました')
    return
  }

  router.push(`/room/${roomId}/result`)
}
```

---

## 6. 結果画面

**ファイル:** `app/room/[roomId]/result/page.tsx`

### 6.1 State定義

```typescript
const [room, setRoom] = useState<Room | null>(null)
const [result, setResult] = useState<QuestionResult | null>(null)
const [isHost, setIsHost] = useState(false)
const [players, setPlayers] = useState<Player[]>([])
const [answers, setAnswers] = useState<Answer[]>([])
const [currentPlayerCorrect, setCurrentPlayerCorrect] = useState(false)
const [currentPlayerFreeTextBonus, setCurrentPlayerFreeTextBonus] = useState(0)
const [myAnswer, setMyAnswer] = useState<string>('')
const [myPrediction, setMyPrediction] = useState<string>('')
const [currentPlayerIncorrect, setCurrentPlayerIncorrect] = useState(false)
const [previousRanks, setPreviousRanks] = useState<Map<string, number>>(new Map())
const [rankChanges, setRankChanges] = useState<Map<string, number>>(new Map())
const [animatedPercentages, setAnimatedPercentages] = useState<Map<string, number>>(new Map())
```

### 6.2 初期化処理（ポイント計算含む）

```typescript
useEffect(() => {
  const initializeResult = async () => {
    const pid = getOrCreatePlayerId()
    setPlayerId(pid)

    // 1. ルーム・質問・回答・プレイヤー情報を取得
    const { data: roomData } = await supabase.from('rooms')...
    const { data: questionData } = await supabase.from('questions')...
    const { data: answersData } = await supabase.from('answers')...
    const { data: playersData } = await supabase.from('players')...

    // 2. 現在の順位を保存（変動計算用）
    const prevRanks = new Map<string, number>()
    playersData.forEach((player, index) => {
      // 同スコアは同順位
      prevRanks.set(player.id, calculateRank(player, playersData))
    })
    setPreviousRanks(prevRanks)

    // 3. 回答を集計
    const answerGroups = aggregateAnswers(
      answersData, playersData,
      questionData.choice_a, questionData.choice_b
    )

    // 4. マジョリティ回答を特定
    const majorityGroups = answerGroups.filter(g => g.isMajority)
    const majorityAnswers = majorityGroups.map(g => g.answer)

    // 5. 自由記述の一致数をカウント
    const freeTextAnswerCounts = new Map<string, number>()
    answersData.forEach(ans => {
      if (ans.answer !== 'A' && ans.answer !== 'B') {
        const count = freeTextAnswerCounts.get(ans.answer) || 0
        freeTextAnswerCounts.set(ans.answer, count + 1)
      }
    })

    // 6. 各プレイヤーのポイントを計算
    const answersToUpdate = []
    answersData.forEach((answer) => {
      // 既に計算済みならスキップ
      if (answer.points_earned !== 0) return

      // 予想が的中したかチェック
      const isCorrect = checkPredictionCorrect(
        answer.prediction,
        majorityAnswers,
        questionData
      )

      // ポイント計算
      let points = isCorrect ? 10 : 0

      // シンクロボーナス（自由記述の一致）
      if (answer.answer !== 'A' && answer.answer !== 'B') {
        const matchCount = freeTextAnswerCounts.get(answer.answer) || 0
        if (matchCount >= 2) {
          points += matchCount * 5
        }
      }

      answersToUpdate.push({ id: answer.id, isCorrect, points })
    })

    // 7. DBを更新
    await Promise.all(
      answersToUpdate.map(({ id, isCorrect, points }) =>
        supabase.from('answers')
          .update({ is_correct_prediction: isCorrect, points_earned: points })
          .eq('id', id)
      )
    )

    // 8. プレイヤーの総合スコアを再計算
    await recalculatePlayerScores(roomId)

    // 9. 自分の回答情報を設定（表示用）
    const myAnswerData = answersData.find(a => a.player_id === pid)
    if (myAnswerData) {
      setMyAnswer(formatAnswer(myAnswerData.answer, questionData))
      setMyPrediction(formatAnswer(myAnswerData.prediction, questionData))

      // シンクロボーナスを設定
      if (myAnswerData.answer !== 'A' && myAnswerData.answer !== 'B') {
        const matchCount = freeTextAnswerCounts.get(myAnswerData.answer) || 0
        if (matchCount >= 2) {
          setCurrentPlayerFreeTextBonus(matchCount * 5)
        }
      }

      // 正解/不正解フラグ
      if (myAnswerData.is_correct_prediction) {
        setCurrentPlayerCorrect(true)
      } else if (myAnswerData.prediction) {
        setCurrentPlayerIncorrect(true)
      }
    }

    // 10. 順位変動を計算
    const updatedPlayers = await fetchUpdatedPlayers()
    calculateRankChanges(updatedPlayers, prevRanks)

    setResult({ questionText, answerGroups, ... })
    setIsLoading(false)
  }

  initializeResult()
}, [roomId])
```

### 6.3 エフェクト処理

```typescript
// 正解時の紙吹雪
useEffect(() => {
  if (currentPlayerCorrect && !isLoading) {
    import('canvas-confetti').then((confettiModule) => {
      const confetti = confettiModule.default

      // 大爆発
      confetti({ particleCount: 150, spread: 100, ... })

      // 左右から花火
      confetti({ angle: 60, origin: { x: 0 }, ... })
      confetti({ angle: 120, origin: { x: 1 }, ... })

      // 継続的な紙吹雪（4秒間）
      const interval = setInterval(() => {
        confetti({ particleCount: 60, ... })
      }, 200)

      setTimeout(() => clearInterval(interval), 4000)
    })
  }
}, [currentPlayerCorrect, isLoading])

// 不正解時の画面シェイク
useEffect(() => {
  if (currentPlayerIncorrect && !isLoading) {
    setTimeout(() => shake(), 800)
  }
}, [currentPlayerIncorrect, isLoading])

// バーグラフのアニメーション
useEffect(() => {
  if (!result) return

  result.answerGroups.forEach((group, index) => {
    const duration = 1000 + index * 200
    animateValue(0, group.percentage, duration, (value) => {
      setAnimatedPercentages(prev => {
        const newMap = new Map(prev)
        newMap.set(group.answer, value)
        return newMap
      })
    })
  })
}, [result])
```

### 6.4 次の質問への遷移（ホストのみ）

```typescript
const handleNextQuestion = async () => {
  if (!isHost || !room) return

  const nextIndex = room.current_question_index + 1

  // ルームを更新
  await supabase.from('rooms').update({
    current_question_index: nextIndex,
    status: 'answering'
  }).eq('id', roomId)

  router.push(`/room/${roomId}/answer`)
}

const handleFinishGame = async () => {
  if (!isHost) return

  // ステータスを 'finished' に更新
  await supabase.from('rooms')
    .update({ status: 'finished' })
    .eq('id', roomId)

  router.push(`/room/${roomId}/summary`)
}
```

### 6.5 リアルタイム購読

```typescript
useEffect(() => {
  if (!room) return

  const roomChannel = supabase
    .channel(`room_result:${roomId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'rooms',
      filter: `id=eq.${roomId}`
    }, (payload) => {
      const updatedRoom = payload.new as Room

      // 次の質問へ
      if (updatedRoom.status === 'answering') {
        if (isHost) {
          router.push(`/room/${roomId}/answer`)
        } else {
          // 3秒カウントダウン後に遷移
          setShowTransitionSnackbar(true)
        }
      }

      // ゲーム終了
      if (updatedRoom.status === 'finished') {
        router.push(`/room/${roomId}/summary`)
      }
    })
    .subscribe()

  return () => roomChannel.unsubscribe()
}, [room, roomId, router, isHost])
```

---

## 7. 最終結果画面

**ファイル:** `app/room/[roomId]/summary/page.tsx`

### 7.1 State定義

```typescript
const [room, setRoom] = useState<Room | null>(null)
const [players, setPlayers] = useState<Player[]>([])
const [questions, setQuestions] = useState<Question[]>([])
const [allAnswers, setAllAnswers] = useState<Answer[]>([])
const [showAllRankings, setShowAllRankings] = useState(false)
const [selectedQuestion, setSelectedQuestion] = useState<number | null>(null)
```

### 7.2 初期化処理

```typescript
useEffect(() => {
  const initializeSummary = async () => {
    // 1. ルーム情報を取得
    const { data: roomData } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', roomId)
      .single()

    setRoom(roomData)

    // 2. プレイヤーをスコア順で取得
    const { data: playersData } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', roomId)
      .order('score', { ascending: false })
      .order('joined_at', { ascending: true })

    setPlayers(playersData || [])

    // 3. 全質問を取得
    const { data: questionsData } = await supabase
      .from('questions')
      .select('*')
      .eq('room_id', roomId)
      .order('order_index')

    setQuestions(questionsData || [])

    // 4. 全回答を取得
    if (questionsData) {
      const questionIds = questionsData.map(q => q.id)
      const { data: answersData } = await supabase
        .from('answers')
        .select('*')
        .in('question_id', questionIds)

      setAllAnswers(answersData || [])
    }

    setIsLoading(false)
  }

  initializeSummary()
}, [roomId])
```

### 7.3 初回表示時の紙吹雪

```typescript
useEffect(() => {
  if (!isLoading && players.length > 0) {
    import('canvas-confetti').then((confettiModule) => {
      const confetti = confettiModule.default

      // 優勝者用の金色紙吹雪
      confetti({
        particleCount: 200,
        spread: 180,
        origin: { y: 0.6 },
        colors: ['#fbbf24', '#f59e0b', '#d97706', '#fcd34d', '#fef3c7'],
      })

      // 継続演出
      setTimeout(() => {
        confetti({
          particleCount: 100,
          angle: 60,
          spread: 80,
          origin: { x: 0 },
          colors: ['#667eea', '#764ba2'],
        })
        confetti({
          particleCount: 100,
          angle: 120,
          spread: 80,
          origin: { x: 1 },
          colors: ['#667eea', '#764ba2'],
        })
      }, 500)
    })
  }
}, [isLoading, players])
```

### 7.4 結果画像の保存機能

```typescript
const handleSaveImage = async () => {
  // html2canvasで画面をキャプチャ
  const element = document.getElementById('summary-content')
  if (!element) return

  const canvas = await html2canvas(element, {
    backgroundColor: '#1a1a2e',
    scale: 2,
  })

  // ダウンロードリンクを生成
  const link = document.createElement('a')
  link.download = `majority-game-result-${roomId}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
```

### 7.5 質問ごとの結果表示

```typescript
// 質問を選択すると詳細を表示
const handleQuestionClick = (index: number) => {
  setSelectedQuestion(selectedQuestion === index ? null : index)
}

// 選択された質問の回答を集計
const getQuestionResults = (questionId: string) => {
  const questionAnswers = allAnswers.filter(a => a.question_id === questionId)
  const question = questions.find(q => q.id === questionId)

  if (!question) return []

  return aggregateAnswers(
    questionAnswers,
    players,
    question.choice_a,
    question.choice_b
  )
}
```

---

## 8. ユーティリティ関数

### 8.1 順位計算

```typescript
// 同スコアは同順位として計算
function calculateRank(player: Player, allPlayers: Player[]): number {
  let rank = 1
  for (const p of allPlayers) {
    if (p.score > player.score) {
      rank++
    }
  }
  return rank
}

// 順位変動を計算
function calculateRankChanges(
  newPlayers: Player[],
  previousRanks: Map<string, number>
): Map<string, number> {
  const changes = new Map<string, number>()

  newPlayers.forEach((player) => {
    const newRank = calculateRank(player, newPlayers)
    const oldRank = previousRanks.get(player.id) || newRank
    changes.set(player.id, oldRank - newRank)  // プラス = 上昇
  })

  return changes
}
```

### 8.2 プレイヤースコア再計算

```typescript
async function recalculatePlayerScores(roomId: string) {
  // 1. ルームの全質問IDを取得
  const { data: questions } = await supabase
    .from('questions')
    .select('id')
    .eq('room_id', roomId)

  if (!questions) return

  const questionIds = questions.map(q => q.id)

  // 2. 全回答のポイントを取得
  const { data: answers } = await supabase
    .from('answers')
    .select('player_id, points_earned')
    .in('question_id', questionIds)

  if (!answers) return

  // 3. プレイヤーごとに集計
  const playerScores = new Map<string, number>()
  for (const answer of answers) {
    const current = playerScores.get(answer.player_id) || 0
    playerScores.set(answer.player_id, current + (answer.points_earned || 0))
  }

  // 4. 一括更新
  await Promise.all(
    Array.from(playerScores.entries()).map(([playerId, score]) =>
      supabase
        .from('players')
        .update({ score })
        .eq('id', playerId)
        .eq('room_id', roomId)
    )
  )
}
```

---

## 9. コンポーネント

### 9.1 AnimatedButton (`components/AnimatedButton.tsx`)

ホバー・クリック時にアニメーションするボタン。

```typescript
export function AnimatedButton({ children, ...props }: ButtonProps) {
  return (
    <Button
      {...props}
      sx={{
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)',
        },
        '&:active': {
          transform: 'translateY(0) scale(0.98)',
        },
        ...props.sx,
      }}
    >
      {children}
    </Button>
  )
}
```

### 9.2 HowToPlayDialog (`components/HowToPlayDialog.tsx`)

遊び方を説明するスライド形式ダイアログ。

**構成:**
- 5ステップのチュートリアル
- 各ステップにSVGで描画したスマホ画面イメージ
- MobileStepperで「戻る」「次へ」ナビゲーション

```typescript
const tutorialSteps = [
  { title: 'みんなで参加', description: 'QRコードで招待', image: <QRShareImage /> },
  { title: '問題が出題される', description: '全員に同じ問題', image: <QuestionImage /> },
  { title: '回答を選ぶ', description: '多数派を予想', image: <AnswerSelectImage /> },
  { title: '多数派が勝ち！', description: 'ポイント獲得', image: <ResultImage /> },
  { title: '結果発表', description: 'ランキング表示', image: <RankingImage /> },
]
```

### 9.3 PopEffect (`components/PopEffect.tsx`)

#### useShakeEffect - 画面シェイクフック

```typescript
export function useShakeEffect() {
  const [isShaking, setIsShaking] = useState(false)

  const shake = () => {
    setIsShaking(true)
    setTimeout(() => setIsShaking(false), 1000)  // 1秒間
  }

  const shakeStyle = isShaking ? {
    animation: 'shake 0.5s ease-in-out 2',  // 0.5秒 × 2回
    '@keyframes shake': {
      '0%, 100%': { transform: 'translateX(0)' },
      '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
      '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' },
    },
  } : {}

  return { shake, shakeStyle, isShaking }
}
```

#### useCountUp - カウントアップアニメーションフック

```typescript
export function useCountUp(targetValue: number, duration: number = 1000) {
  const [displayValue, setDisplayValue] = useState(0)

  const startCountUp = (from: number = 0) => {
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)

      // easeOutExpo イージング
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
      setDisplayValue(Math.round(from + (targetValue - from) * eased))

      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
  }

  return { displayValue, startCountUp }
}
```

---

## 更新履歴

| 日付 | バージョン | 更新内容 |
|------|------------|----------|
| 2025-12-05 | 1.0 | 初版作成 |
