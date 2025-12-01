'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Container,
  Button,
  Typography,
  Box,
  Paper,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Collapse
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PeopleIcon from '@mui/icons-material/People'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { supabase } from '@/lib/supabase'
import { getOrCreatePlayerId } from '@/lib/utils/player'
import type { Room, Question, Player, Answer } from '@/types/database'

export default function AnswerPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string

  const [room, setRoom] = useState<Room | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [selectedChoice, setSelectedChoice] = useState<string>('')
  const [freeText, setFreeText] = useState('')
  const [selectedPrediction, setSelectedPrediction] = useState<string>('')
  const [predictionText, setPredictionText] = useState('')
  const [comment, setComment] = useState('')
  const [hasAnswered, setHasAnswered] = useState(false)

  // 自分の回答データ
  const [myAnswer, setMyAnswer] = useState<string>('')
  const [myPrediction, setMyPrediction] = useState<string>('')
  const [myComment, setMyComment] = useState<string>('')

  // リアルタイム状態
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [isHost, setIsHost] = useState(false)
  const [playerId, setPlayerId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [showQuestionList, setShowQuestionList] = useState(false)

  useEffect(() => {
    const initializeRoom = async () => {
      try {
        // プレイヤーIDを取得
        const pid = getOrCreatePlayerId()
        setPlayerId(pid)

        // ルーム情報を取得
        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single()

        if (roomError) throw roomError
        setRoom(roomData)

        // 主催者かチェック
        setIsHost(roomData.host_player_id === pid)

        // 現在の質問を取得
        const { data: questionData, error: questionError } = await supabase
          .from('questions')
          .select('*')
          .eq('room_id', roomId)
          .eq('order_index', roomData.current_question_index)
          .single()

        if (questionError) throw questionError
        setCurrentQuestion(questionData)

        // 全ての質問を取得
        const { data: allQuestionsData, error: allQuestionsError } = await supabase
          .from('questions')
          .select('*')
          .eq('room_id', roomId)
          .order('order_index', { ascending: true })

        if (allQuestionsError) throw allQuestionsError
        setAllQuestions(allQuestionsData || [])

        // 自分が既に回答しているかチェック
        const { data: answerData } = await supabase
          .from('answers')
          .select('*')
          .eq('question_id', questionData.id)
          .eq('player_id', pid)
          .maybeSingle()

        if (answerData) {
          setHasAnswered(true)
          setMyAnswer(answerData.answer)
          setMyPrediction(answerData.prediction || '')
          setMyComment(answerData.comment || '')
        }

        // プレイヤー数を取得
        await fetchPlayerCount()

        // 回答済み人数を取得
        await fetchAnsweredCount(questionData.id)

        setIsLoading(false)
      } catch (error) {
        console.error('Error initializing room:', error)
        setIsLoading(false)
      }
    }

    initializeRoom()
  }, [roomId])

  // Realtimeリスナーの設定
  useEffect(() => {
    if (!currentQuestion) return

    // プレイヤーの変更を購読
    const playersChannel = supabase
      .channel(`players:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'players',
          filter: `room_id=eq.${roomId}`
        },
        () => {
          fetchPlayerCount()
        }
      )
      .subscribe()

    // 回答の変更を購読
    const answersChannel = supabase
      .channel(`answers:${currentQuestion.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'answers',
          filter: `question_id=eq.${currentQuestion.id}`
        },
        () => {
          fetchAnsweredCount(currentQuestion.id)
        }
      )
      .subscribe()

    // ルームステータスの変更を購読
    const roomChannel = supabase
      .channel(`room:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'rooms',
          filter: `id=eq.${roomId}`
        },
        (payload) => {
          const updatedRoom = payload.new as Room
          setRoom(updatedRoom)

          // ステータスが'showing_result'に変わったら結果ページへ
          if (updatedRoom.status === 'showing_result') {
            router.push(`/room/${roomId}/result`)
          }
        }
      )
      .subscribe()

    return () => {
      playersChannel.unsubscribe()
      answersChannel.unsubscribe()
      roomChannel.unsubscribe()
    }
  }, [currentQuestion, roomId, router])

  const fetchPlayerCount = async () => {
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId)

    setTotalPlayers(count || 0)
  }

  const fetchAnsweredCount = async (questionId: string) => {
    const { count } = await supabase
      .from('answers')
      .select('*', { count: 'exact', head: true })
      .eq('question_id', questionId)

    setAnsweredCount(count || 0)
  }

  const handleChoiceChange = (event: React.MouseEvent<HTMLElement>, newChoice: string | null) => {
    if (newChoice !== null && !hasAnswered) {
      setSelectedChoice(newChoice)
      setFreeText('')
    }
  }

  const handleFreeTextChange = (value: string) => {
    if (!hasAnswered) {
      setFreeText(value)
      if (value.trim()) {
        setSelectedChoice('')
      }
    }
  }

  const handlePredictionChange = (event: React.MouseEvent<HTMLElement>, newPrediction: string | null) => {
    if (newPrediction !== null && !hasAnswered) {
      setSelectedPrediction(newPrediction)
      setPredictionText('')
    }
  }

  const handlePredictionTextChange = (value: string) => {
    if (!hasAnswered) {
      setPredictionText(value)
      if (value.trim()) {
        setSelectedPrediction('')
      }
    }
  }

  const handleSubmitAnswer = async () => {
    if (!currentQuestion) return

    const answer = freeText.trim() || selectedChoice
    const prediction = predictionText.trim() || selectedPrediction
    if (!answer || !prediction || hasAnswered) return

    try {
      const { error } = await supabase
        .from('answers')
        .insert({
          question_id: currentQuestion.id,
          player_id: playerId,
          answer,
          prediction,
          comment: comment.trim() || null
        })

      if (error) throw error

      setHasAnswered(true)
      console.log('Answer, prediction and comment submitted:', { answer, prediction, comment })
    } catch (error) {
      console.error('Error submitting answer:', error)
      alert('回答の送信に失敗しました')
    }
  }

  const handleShowResults = async () => {
    if (!isHost) return

    try {
      const { error } = await supabase
        .from('rooms')
        .update({ status: 'showing_result' })
        .eq('id', roomId)

      if (error) throw error

      console.log('Showing results')
      router.push(`/room/${roomId}/result`)
    } catch (error) {
      console.error('Error showing results:', error)
      alert('結果表示の開始に失敗しました')
    }
  }

  const isAnswerValid = (selectedChoice !== '' || freeText.trim() !== '') &&
                        (selectedPrediction !== '' || predictionText.trim() !== '') &&
                        !hasAnswered
  const allPlayersAnswered = totalPlayers > 0 && answeredCount === totalPlayers

  if (isLoading) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, textAlign: 'center' }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>読み込み中...</Typography>
        </Box>
      </Container>
    )
  }

  if (!room || !currentQuestion) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8 }}>
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="error">
              ルームまたは質問が見つかりません
            </Typography>
          </Paper>
        </Box>
      </Container>
    )
  }

  return (
    <Container maxWidth="sm" sx={{ pb: 4 }}>
      <Box sx={{ mt: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Chip
            icon={<PeopleIcon />}
            label={`参加: ${totalPlayers}人`}
            color="primary"
            size="small"
          />
          <Chip
            icon={<CheckCircleIcon />}
            label={`回答済み: ${answeredCount}/${totalPlayers}人`}
            color={allPlayersAnswered ? 'success' : 'default'}
            size="small"
          />
        </Box>

        <Typography variant="body2" color="text.secondary" gutterBottom align="center">
          質問 {room.current_question_index + 1}
        </Typography>
        <Typography variant="h5" component="h1" gutterBottom align="center" sx={{ fontWeight: 'bold' }}>
          {currentQuestion.question_text}
        </Typography>
      </Box>

      {/* 質問一覧 */}
      <Paper elevation={2} sx={{ mb: 3 }}>
        <Box
          sx={{
            p: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            '&:hover': { bgcolor: 'action.hover' }
          }}
          onClick={() => setShowQuestionList(!showQuestionList)}
        >
          <Typography variant="subtitle1" fontWeight="bold">
            問題一覧 ({allQuestions.length}問)
          </Typography>
          {showQuestionList ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </Box>
        <Collapse in={showQuestionList}>
          <Divider />
          <List sx={{ py: 0 }}>
            {allQuestions.map((question, index) => {
              const isCurrent = question.id === currentQuestion.id
              const isPast = index < (room.current_question_index)

              return (
                <ListItem
                  key={question.id}
                  sx={{
                    bgcolor: isCurrent ? 'primary.light' : isPast ? 'action.hover' : 'background.paper',
                    borderLeft: isCurrent ? 4 : 0,
                    borderColor: 'primary.main',
                    opacity: isPast ? 0.7 : 1
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={isCurrent ? 'bold' : 'normal'}>
                          Q{index + 1}
                        </Typography>
                        {isCurrent && (
                          <Chip label="回答中" color="primary" size="small" />
                        )}
                        {isPast && (
                          <Chip label="終了" size="small" />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" color="text.secondary">
                        {question.question_text}
                      </Typography>
                    }
                  />
                </ListItem>
              )
            })}
          </List>
        </Collapse>
      </Paper>

      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        {hasAnswered ? (
          <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
            回答済みです。他の参加者の回答を待っています...
          </Alert>
        ) : (
          <>
            <Typography variant="h6" gutterBottom sx={{ color: 'primary.main', fontWeight: 'bold' }}>
              あなたの意見
            </Typography>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              選択肢から選ぶ
            </Typography>
            <ToggleButtonGroup
              value={selectedChoice}
              exclusive
              onChange={handleChoiceChange}
              fullWidth
              orientation="vertical"
              sx={{ mb: 2 }}
            >
              <ToggleButton
                value="A"
                disabled={hasAnswered}
                sx={{
                  py: 2,
                  fontSize: '1.1rem',
                  justifyContent: 'flex-start',
                  textTransform: 'none'
                }}
              >
                A: {currentQuestion.choice_a}
              </ToggleButton>
              <ToggleButton
                value="B"
                disabled={hasAnswered}
                sx={{
                  py: 2,
                  fontSize: '1.1rem',
                  justifyContent: 'flex-start',
                  textTransform: 'none'
                }}
              >
                B: {currentQuestion.choice_b}
              </ToggleButton>
            </ToggleButtonGroup>

            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              または自由に記述
            </Typography>
            <TextField
              fullWidth
              placeholder="自分の答えを入力"
              value={freeText}
              onChange={(e) => handleFreeTextChange(e.target.value)}
              disabled={hasAnswered}
              sx={{ mb: 4 }}
            />

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom sx={{ color: 'secondary.main', fontWeight: 'bold' }}>
              多数派の予想
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
              多数派が選ぶ答えを予想してください（予想が当たると+10ポイント）
            </Typography>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              選択肢から選ぶ
            </Typography>
            <ToggleButtonGroup
              value={selectedPrediction}
              exclusive
              onChange={handlePredictionChange}
              fullWidth
              orientation="vertical"
              sx={{ mb: 2 }}
            >
              <ToggleButton
                value="A"
                disabled={hasAnswered}
                sx={{
                  py: 2,
                  fontSize: '1.1rem',
                  justifyContent: 'flex-start',
                  textTransform: 'none'
                }}
              >
                A: {currentQuestion.choice_a}
              </ToggleButton>
              <ToggleButton
                value="B"
                disabled={hasAnswered}
                sx={{
                  py: 2,
                  fontSize: '1.1rem',
                  justifyContent: 'flex-start',
                  textTransform: 'none'
                }}
              >
                B: {currentQuestion.choice_b}
              </ToggleButton>
            </ToggleButtonGroup>

            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              または自由に記述
            </Typography>
            <TextField
              fullWidth
              placeholder="多数派の予想を入力"
              value={predictionText}
              onChange={(e) => handlePredictionTextChange(e.target.value)}
              disabled={hasAnswered}
              sx={{ mb: 3 }}
            />

            <Divider sx={{ my: 3 }} />

            <Typography variant="h6" gutterBottom sx={{ color: 'text.secondary', fontWeight: 'bold' }}>
              💬 コメント（任意）
            </Typography>
            <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
              結果画面で名前をタップすると表示されます
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={2}
              placeholder="面白いコメントを残そう！"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              disabled={hasAnswered}
              sx={{ mb: 3 }}
            />

            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleSubmitAnswer}
              disabled={!isAnswerValid}
              sx={{ py: 1.5 }}
            >
              回答する
            </Button>
          </>
        )}
      </Paper>

      {/* 主催者用コントロール */}
      {isHost && (
        <Paper elevation={3} sx={{ p: 3, bgcolor: 'warning.light' }}>
          <Typography variant="subtitle1" gutterBottom fontWeight="bold">
            主催者コントロール
          </Typography>
          <Button
            fullWidth
            variant="contained"
            color="success"
            size="large"
            onClick={handleShowResults}
            disabled={!allPlayersAnswered}
            sx={{ py: 1.5 }}
          >
            {allPlayersAnswered ? '回答を表示する' : `回答待ち (${answeredCount}/${totalPlayers})`}
          </Button>
        </Paper>
      )}
    </Container>
  )
}
