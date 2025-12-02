'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Container, TextField, Button, Typography, Box, Paper, IconButton, Divider, CircularProgress, Card, CardContent, CardActions } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import HistoryIcon from '@mui/icons-material/History'
import { supabase } from '@/lib/supabase'
import { getOrCreatePlayerId } from '@/lib/utils/player'
import { sanitizeInput, validateRoomName, validateQuestionText, validateChoice, validateNickname } from '@/lib/utils/validation'

interface QuestionInput {
  questionText: string
  choiceA: string
  choiceB: string
}

interface PastRoom {
  id: string
  room_name: string
  created_at: string
  question_count: number
}

interface ActiveRoom {
  id: string
  room_name: string
  status: string
}

export default function Home() {
  const router = useRouter()
  const [roomName, setRoomName] = useState('')
  const [hostNickname, setHostNickname] = useState('')
  const [questions, setQuestions] = useState<QuestionInput[]>([
    { questionText: '', choiceA: '', choiceB: '' }
  ])
  const [roomUrl, setRoomUrl] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState('')
  const [pastRooms, setPastRooms] = useState<PastRoom[]>([])
  const [isLoadingPastRooms, setIsLoadingPastRooms] = useState(true)
  const [activeRoom, setActiveRoom] = useState<ActiveRoom | null>(null)

  useEffect(() => {
    const loadPastRooms = async () => {
      try {
        const playerId = getOrCreatePlayerId()

        // 進行中のルームをチェック（自分が参加しているルームで、waiting/finished以外）
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

          if (roomData && roomData.status !== 'waiting' && roomData.status !== 'finished') {
            setActiveRoom(roomData)
          }
        }

        // このホストが過去に作成したルームを取得（最新5件、質問数も取得）
        const { data: roomsData, error: roomsError } = await supabase
          .from('rooms')
          .select('id, room_name, created_at')
          .eq('host_player_id', playerId)
          .order('created_at', { ascending: false })
          .limit(5)

        if (roomsError) throw roomsError

        // 各ルームの質問数を取得
        if (roomsData) {
          const roomsWithQuestionCount = await Promise.all(
            roomsData.map(async (room) => {
              const { count } = await supabase
                .from('questions')
                .select('*', { count: 'exact', head: true })
                .eq('room_id', room.id)

              return {
                ...room,
                question_count: count || 0
              }
            })
          )

          setPastRooms(roomsWithQuestionCount)
        }

        setIsLoadingPastRooms(false)
      } catch (err) {
        console.error('Error loading past rooms:', err)
        setIsLoadingPastRooms(false)
      }
    }

    loadPastRooms()
  }, [])

  const addQuestion = () => {
    setQuestions([...questions, { questionText: '', choiceA: '', choiceB: '' }])
  }

  const removeQuestion = (index: number) => {
    if (questions.length > 1) {
      setQuestions(questions.filter((_, i) => i !== index))
    }
  }

  const updateQuestion = (index: number, field: keyof QuestionInput, value: string) => {
    const newQuestions = [...questions]
    newQuestions[index][field] = value
    setQuestions(newQuestions)
  }

  const loadRoomQuestions = async (roomId: string, roomName: string) => {
    try {
      // 過去のルームから質問を取得
      const { data: questionsData, error } = await supabase
        .from('questions')
        .select('question_text, choice_a, choice_b, order_index')
        .eq('room_id', roomId)
        .order('order_index')

      if (error) throw error

      if (questionsData && questionsData.length > 0) {
        const loadedQuestions = questionsData.map(q => ({
          questionText: q.question_text,
          choiceA: q.choice_a,
          choiceB: q.choice_b
        }))
        setQuestions(loadedQuestions)
        setRoomName(roomName)
        alert(`「${roomName}」の質問を読み込みました`)
      }
    } catch (err) {
      console.error('Error loading room questions:', err)
      alert('質問の読み込みに失敗しました')
    }
  }

  const handleCreateRoom = async () => {
    setIsCreating(true)
    setError('')

    try {
      // プレイヤーIDを取得または生成
      const hostPlayerId = getOrCreatePlayerId()

      // 主催者のニックネームをバリデーションとサニタイズ
      const sanitizedNickname = sanitizeInput(hostNickname, 50)
      const nicknameValidation = validateNickname(sanitizedNickname)
      if (!nicknameValidation.valid) {
        throw new Error(nicknameValidation.error)
      }

      // ルーム名をバリデーションとサニタイズ
      const sanitizedRoomName = sanitizeInput(roomName, 100) || 'マジョリティゲーム'
      const roomNameValidation = validateRoomName(sanitizedRoomName)
      if (!roomNameValidation.valid && roomName.trim()) {
        throw new Error(roomNameValidation.error)
      }

      // 質問をバリデーションとサニタイズ
      const validatedQuestions: Array<{ questionText: string; choiceA: string; choiceB: string }> = []
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]

        // 各フィールドをサニタイズ
        const sanitizedQuestion = sanitizeInput(q.questionText, 500)
        const sanitizedChoiceA = sanitizeInput(q.choiceA, 100)
        const sanitizedChoiceB = sanitizeInput(q.choiceB, 100)

        // バリデーション
        const questionValidation = validateQuestionText(sanitizedQuestion)
        if (!questionValidation.valid) {
          throw new Error(`質問${i + 1}: ${questionValidation.error}`)
        }

        const choiceAValidation = validateChoice(sanitizedChoiceA)
        if (!choiceAValidation.valid) {
          throw new Error(`質問${i + 1}の選択肢A: ${choiceAValidation.error}`)
        }

        const choiceBValidation = validateChoice(sanitizedChoiceB)
        if (!choiceBValidation.valid) {
          throw new Error(`質問${i + 1}の選択肢B: ${choiceBValidation.error}`)
        }

        validatedQuestions.push({
          questionText: sanitizedQuestion,
          choiceA: sanitizedChoiceA,
          choiceB: sanitizedChoiceB
        })
      }

      // ルームを作成
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

      // 質問を作成
      const questionsData = validatedQuestions.map((q, index) => ({
        room_id: room.id,
        question_text: q.questionText,
        choice_a: q.choiceA,
        choice_b: q.choiceB,
        order_index: index
      }))

      const { error: questionsError } = await supabase
        .from('questions')
        .insert(questionsData)

      if (questionsError) throw questionsError

      // 主催者自身をプレイヤーとして登録（既存の場合は更新）
      const { error: playerError } = await supabase
        .from('players')
        .upsert({
          id: hostPlayerId,
          room_id: room.id,
          nickname: sanitizedNickname,
          is_host: true,
          score: 0
        }, {
          onConflict: 'id'
        })

      if (playerError) throw playerError

      // ルームURLを生成
      const url = `${window.location.origin}/room/${room.id}/join`
      setRoomUrl(url)

      console.log('Room created:', room.id)
    } catch (err: any) {
      console.error('Error creating room:', err)
      setError(err.message || 'ルームの作成に失敗しました')
    } finally {
      setIsCreating(false)
    }
  }

  const isValid = hostNickname.trim() && questions.every(q =>
    q.questionText.trim() && q.choiceA.trim() && q.choiceB.trim()
  )

  const handleRejoinRoom = () => {
    if (!activeRoom) return

    // ステータスに応じて適切なページに遷移
    if (activeRoom.status === 'answering') {
      router.push(`/room/${activeRoom.id}/answer`)
    } else if (activeRoom.status === 'showing_result') {
      router.push(`/room/${activeRoom.id}/result`)
    }
  }

  return (
    <Container maxWidth="sm" sx={{ pb: 4 }}>
      <Box sx={{ mt: 4, mb: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          マジョリティゲーム
        </Typography>
        <Typography variant="body2" gutterBottom align="center" color="text.secondary">
          主催者：お題を入力してルームを作成
        </Typography>
      </Box>

      {/* 進行中のルームに戻る */}
      {activeRoom && (
        <Paper elevation={3} sx={{ p: 3, mb: 3, bgcolor: 'warning.light', border: 2, borderColor: 'warning.main' }}>
          <Typography variant="h6" gutterBottom fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            ⚠️ 進行中のルームがあります
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {activeRoom.room_name}
          </Typography>
          <Button
            fullWidth
            variant="contained"
            color="warning"
            size="large"
            onClick={handleRejoinRoom}
            sx={{ py: 1.5 }}
          >
            ルームに戻る
          </Button>
        </Paper>
      )}

      {/* 過去のルーム */}
      {pastRooms.length > 0 && (
        <Paper elevation={3} sx={{ p: 3, mb: 3, bgcolor: 'info.light' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <HistoryIcon sx={{ mr: 1 }} />
            <Typography variant="h6" fontWeight="bold">
              過去のルーム
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            クリックして質問を再利用できます
          </Typography>
          {pastRooms.map((room) => (
            <Card
              key={room.id}
              sx={{
                mb: 1,
                cursor: 'pointer',
                '&:hover': {
                  bgcolor: 'action.hover'
                }
              }}
              onClick={() => loadRoomQuestions(room.id, room.room_name)}
            >
              <CardContent sx={{ py: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="body1" fontWeight="bold">
                      {room.room_name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(room.created_at).toLocaleDateString('ja-JP')} · {room.question_count}問
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Paper>
      )}

      <Paper elevation={3} sx={{ p: 3 }}>
        <TextField
          fullWidth
          label="主催者の名前"
          value={hostNickname}
          onChange={(e) => setHostNickname(e.target.value)}
          placeholder="例：たろう"
          sx={{ mb: 2 }}
          required
        />
        <TextField
          fullWidth
          label="ルーム名"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="例：新年会ゲーム"
          sx={{ mb: 3 }}
        />
        {questions.map((question, index) => (
          <Box key={index} sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ flexGrow: 1 }}>
                お題 {index + 1}
              </Typography>
              {questions.length > 1 && (
                <IconButton
                  color="error"
                  size="small"
                  onClick={() => removeQuestion(index)}
                >
                  <DeleteIcon />
                </IconButton>
              )}
            </Box>

            <TextField
              fullWidth
              label="質問"
              multiline
              rows={2}
              value={question.questionText}
              onChange={(e) => updateQuestion(index, 'questionText', e.target.value)}
              placeholder="例：好きな季節は？"
              sx={{ mb: 2 }}
            />

            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth
                label="選択肢 A"
                value={question.choiceA}
                onChange={(e) => updateQuestion(index, 'choiceA', e.target.value)}
                placeholder="例：春"
              />
              <TextField
                fullWidth
                label="選択肢 B"
                value={question.choiceB}
                onChange={(e) => updateQuestion(index, 'choiceB', e.target.value)}
                placeholder="例：秋"
              />
            </Box>

            {index < questions.length - 1 && <Divider sx={{ mt: 3 }} />}
          </Box>
        ))}

        <Button
          fullWidth
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={addQuestion}
          sx={{ mb: 2 }}
        >
          お題を追加
        </Button>

        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={handleCreateRoom}
          disabled={!isValid || isCreating}
          sx={{ py: 1.5 }}
        >
          {isCreating ? <CircularProgress size={24} /> : 'ルームを作成'}
        </Button>

        {error && (
          <Box sx={{ mt: 2, p: 2, bgcolor: 'error.light', borderRadius: 1 }}>
            <Typography variant="body2" color="error.dark">
              {error}
            </Typography>
          </Box>
        )}

        {roomUrl && (
          <Box sx={{ mt: 3, p: 2, bgcolor: 'success.light', borderRadius: 1 }}>
            <Typography variant="body2" gutterBottom fontWeight="bold">
              ルームURL:
            </Typography>
            <Typography variant="body2" sx={{ wordBreak: 'break-all', mb: 2 }}>
              {roomUrl}
            </Typography>
            <Button
              variant="contained"
              size="small"
              onClick={() => {
                navigator.clipboard.writeText(roomUrl)
                alert('URLをコピーしました')
              }}
              sx={{ mr: 1 }}
            >
              URLをコピー
            </Button>
            <Button
              variant="outlined"
              size="small"
              onClick={() => {
                const roomId = roomUrl.split('/room/')[1]?.split('/')[0]
                if (roomId) {
                  router.push(`/room/${roomId}/answer`)
                }
              }}
            >
              ルームへ移動
            </Button>
          </Box>
        )}
      </Paper>
    </Container>
  )
}
