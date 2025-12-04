'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
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
  Fade,
  Grow,
  Skeleton,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Drawer,
  IconButton,
  Collapse
} from '@mui/material'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import PeopleIcon from '@mui/icons-material/People'
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted'
import CloseIcon from '@mui/icons-material/Close'
import SendIcon from '@mui/icons-material/Send'
import QuizIcon from '@mui/icons-material/Quiz'
import LightbulbIcon from '@mui/icons-material/Lightbulb'
import ChatIcon from '@mui/icons-material/Chat'
import VisibilityIcon from '@mui/icons-material/Visibility'
import TimerIcon from '@mui/icons-material/Timer'
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty'
import PersonIcon from '@mui/icons-material/Person'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { supabase } from '@/lib/supabase'
import { getOrCreatePlayerId } from '@/lib/utils/player'
import { sanitizeInput, validateComment } from '@/lib/utils/validation'
import type { Room, Question } from '@/types/database'
import { AnimatedButton } from '@/components/AnimatedButton'

// ローディングコンポーネント
function AnswerPageLoading() {
  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Skeleton variant="text" width="60%" height={32} sx={{ mb: 2 }} />
          <Skeleton variant="text" width="100%" height={48} sx={{ mb: 3 }} />
          <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 2, mb: 2 }} />
          <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 2, mb: 2 }} />
          <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 2 }} />
        </Paper>
      </Box>
    </Container>
  )
}

// メインページをSuspenseでラップするためのエントリーポイント
export default function AnswerPage() {
  return (
    <Suspense fallback={<AnswerPageLoading />}>
      <AnswerPageContent />
    </Suspense>
  )
}

function AnswerPageContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const roomId = params.roomId as string

  const [room, setRoom] = useState<Room | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null)
  const [allQuestions, setAllQuestions] = useState<Question[]>([])
  const [viewQuestionIndex, setViewQuestionIndex] = useState<number | null>(null)
  const [isLateAnswer, setIsLateAnswer] = useState(false)
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)
  const [freeText, setFreeText] = useState('')
  const [selectedPrediction, setSelectedPrediction] = useState<string | null>(null)
  const [predictionText, setPredictionText] = useState('')
  const [comment, setComment] = useState('')
  const [hasAnswered, setHasAnswered] = useState(false)

  const [myAnswer, setMyAnswer] = useState<string>('')
  const [myPrediction, setMyPrediction] = useState<string>('')
  const [myComment, setMyComment] = useState<string>('')

  const [totalPlayers, setTotalPlayers] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [isHost, setIsHost] = useState(false)
  const [playerId, setPlayerId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [showQuestionList, setShowQuestionList] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState(180) // 3分 = 180秒
  const [timerStarted, setTimerStarted] = useState(false)
  const [players, setPlayers] = useState<{id: string; nickname: string; hasAnswered: boolean}[]>([])
  const [showAnswerDetails, setShowAnswerDetails] = useState(false)

  const INITIAL_PLAYER_DISPLAY = 8 // 初期表示人数

  // ========== 開発用ダミーデータ（本番では削除） ==========
  const DEV_MODE = false // falseにすると無効化
  const generateDummyPlayers = (count: number, realPlayers: typeof players) => {
    if (!DEV_MODE || realPlayers.length >= count) return realPlayers
    const dummyNames = [
      'たろう', 'はなこ', 'ゆうき', 'さくら', 'けんた', 'みさき', 'りょう', 'あおい',
      'そうた', 'ひなた', 'ゆうと', 'めい', 'はると', 'りん', 'そら', 'こはる',
      'ゆい', 'あかり', 'れん', 'みお', 'かいと', 'ゆな', 'りく', 'ほのか'
    ]
    const dummies = []
    for (let i = realPlayers.length; i < count; i++) {
      dummies.push({
        id: `dummy-${i}`,
        nickname: dummyNames[i] || `テスト${i + 1}`,
        hasAnswered: Math.random() > 0.3 // 70%が回答済み
      })
    }
    return [...realPlayers, ...dummies]
  }
  // ========== ダミーデータここまで ==========

  useEffect(() => {
    const initializeRoom = async () => {
      try {
        const pid = getOrCreatePlayerId()
        setPlayerId(pid)

        const { data: roomData, error: roomError } = await supabase
          .from('rooms')
          .select('*')
          .eq('id', roomId)
          .single()

        if (roomError) throw roomError
        setRoom(roomData)

        setIsHost(roomData.host_player_id === pid)

        const questionParam = searchParams.get('question')
        const targetQuestionIndex = questionParam ? parseInt(questionParam) : roomData.current_question_index
        setViewQuestionIndex(targetQuestionIndex)

        const isPastQuestion = targetQuestionIndex < roomData.current_question_index
        setIsLateAnswer(isPastQuestion)

        const { data: questionData, error: questionError } = await supabase
          .from('questions')
          .select('*')
          .eq('room_id', roomId)
          .eq('order_index', targetQuestionIndex)
          .single()

        if (questionError) throw questionError
        setCurrentQuestion(questionData)

        const { data: allQuestionsData, error: allQuestionsError } = await supabase
          .from('questions')
          .select('*')
          .eq('room_id', roomId)
          .order('order_index', { ascending: true })

        if (allQuestionsError) throw allQuestionsError
        setAllQuestions(allQuestionsData || [])

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

        await fetchPlayerCount()
        await fetchAnsweredCount(questionData.id)

        setIsLoading(false)
      } catch (error) {
        console.error('Error initializing room:', error)
        setIsLoading(false)
      }
    }

    initializeRoom()
  }, [roomId, searchParams])

  // タイマー処理
  useEffect(() => {
    if (!room || room.status !== 'answering' || isLateAnswer || hasAnswered) return

    // タイマー開始
    if (!timerStarted) {
      setTimerStarted(true)
      setTimeRemaining(180) // 3分リセット
    }

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [room, isLateAnswer, hasAnswered, timerStarted])

  // プレイヤー一覧と回答状況を取得
  const fetchPlayersWithAnswerStatus = async (questionId: string) => {
    const { data: playersData } = await supabase
      .from('players')
      .select('id, nickname')
      .eq('room_id', roomId)
      .order('joined_at', { ascending: true })

    if (!playersData) return

    const { data: answersData } = await supabase
      .from('answers')
      .select('player_id')
      .eq('question_id', questionId)

    const answeredPlayerIds = new Set(answersData?.map(a => a.player_id) || [])

    setPlayers(playersData.map(p => ({
      id: p.id,
      nickname: p.nickname,
      hasAnswered: answeredPlayerIds.has(p.id)
    })))
  }

  // ルームステータス購読（roomIdのみに依存）
  useEffect(() => {
    if (!room) return

    const roomChannel = supabase
      .channel(`room_answer:${roomId}`)
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

          if (updatedRoom.status === 'showing_result') {
            router.push(`/room/${roomId}/result`)
          }
        }
      )
      .subscribe()

    return () => {
      roomChannel.unsubscribe()
    }
  }, [room?.id, roomId, router])

  // プレイヤー購読（roomIdのみに依存）
  useEffect(() => {
    const playersChannel = supabase
      .channel(`players_answer:${roomId}`)
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

    return () => {
      playersChannel.unsubscribe()
    }
  }, [roomId])

  // 回答購読（currentQuestionに依存）
  useEffect(() => {
    if (!currentQuestion) return

    // 初回取得
    fetchPlayersWithAnswerStatus(currentQuestion.id)

    const answersChannel = supabase
      .channel(`answers_answer:${currentQuestion.id}`)
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
          fetchPlayersWithAnswerStatus(currentQuestion.id)
        }
      )
      .subscribe()

    return () => {
      answersChannel.unsubscribe()
    }
  }, [currentQuestion?.id])

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
        setSelectedChoice(null)
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
        setSelectedPrediction(null)
      }
    }
  }

  // 確認ダイアログを開く
  const handleOpenConfirmDialog = () => {
    if (!currentQuestion) return
    const answer = freeText.trim() || selectedChoice || ''
    const prediction = isLateAnswer ? '' : (predictionText.trim() || selectedPrediction || '')
    if (!answer || (!isLateAnswer && !prediction) || hasAnswered) return
    setConfirmDialogOpen(true)
  }

  // 実際の回答送信処理
  const handleConfirmSubmit = async () => {
    setConfirmDialogOpen(false)
    if (!currentQuestion) return

    const answer = freeText.trim() || selectedChoice || ''
    const prediction = isLateAnswer ? '' : (predictionText.trim() || selectedPrediction || '')
    if (!answer || (!isLateAnswer && !prediction) || hasAnswered) return

    try {
      const sanitizedComment = sanitizeInput(comment, 500)
      const commentValidation = validateComment(sanitizedComment)

      if (!commentValidation.valid) {
        alert(commentValidation.error)
        return
      }

      const { error } = await supabase
        .from('answers')
        .insert({
          question_id: currentQuestion.id,
          player_id: playerId,
          answer: sanitizeInput(answer, 100),
          prediction: isLateAnswer ? null : sanitizeInput(prediction, 100),
          comment: sanitizedComment || null,
          is_late_answer: isLateAnswer
        })

      if (error) throw error

      // 送信成功時のポップエフェクト
      if (typeof window !== 'undefined') {
        import('canvas-confetti').then((confettiModule) => {
          const confetti = confettiModule.default
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.7 },
            colors: ['#667eea', '#764ba2', '#10b981'],
          })
        })
      }

      setHasAnswered(true)
      setMyAnswer(answer)
      setMyPrediction(prediction)
      setMyComment(sanitizedComment)
      console.log('Answer submitted:', { answer, prediction, comment: sanitizedComment, isLateAnswer })
    } catch (error) {
      console.error('Error submitting answer:', error)
      alert('回答の送信に失敗しました')
    }
  }

  // 表示用の回答テキストを取得
  const getDisplayAnswer = () => {
    const answer = freeText.trim() || selectedChoice || ''
    if (answer === 'A') return `A: ${currentQuestion?.choice_a}`
    if (answer === 'B') return `B: ${currentQuestion?.choice_b}`
    return answer
  }

  const getDisplayPrediction = () => {
    const prediction = predictionText.trim() || selectedPrediction || ''
    if (prediction === 'A') return `A: ${currentQuestion?.choice_a}`
    if (prediction === 'B') return `B: ${currentQuestion?.choice_b}`
    return prediction
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

  const isAnswerValid = (selectedChoice !== null || freeText.trim() !== '') &&
                        (isLateAnswer || selectedPrediction !== null || predictionText.trim() !== '') &&
                        !hasAnswered
  const allPlayersAnswered = totalPlayers > 0 && answeredCount === totalPlayers
  const progressPercent = totalPlayers > 0 ? (answeredCount / totalPlayers) * 100 : 0

  if (isLoading) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 4 }}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Skeleton variant="text" width="60%" height={32} sx={{ mb: 2 }} />
            <Skeleton variant="text" width="100%" height={48} sx={{ mb: 3 }} />
            <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 2, mb: 2 }} />
            <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 2, mb: 2 }} />
            <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 2 }} />
          </Paper>
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
    <>
      {/* 固定ステータスバー - すりガラス風 */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          pt: 1.5,
          pb: 1.5,
          px: 2,
          background: (theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(15, 23, 42, 0.4)'
              : 'rgba(255, 255, 255, 0.35)',
          backdropFilter: 'blur(20px) saturate(200%)',
          WebkitBackdropFilter: 'blur(20px) saturate(200%)',
          borderBottom: (theme) =>
            theme.palette.mode === 'dark'
              ? '1px solid rgba(255, 255, 255, 0.15)'
              : '1px solid rgba(255, 255, 255, 0.6)',
          boxShadow: (theme) =>
            theme.palette.mode === 'dark'
              ? '0 4px 30px rgba(0, 0, 0, 0.2)'
              : '0 4px 30px rgba(31, 38, 135, 0.08)',
        }}
      >
        <Container maxWidth="sm" sx={{ px: { xs: 0, sm: 2 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Chip
              icon={<PeopleIcon />}
              label={`${totalPlayers}人参加`}
              size="small"
              sx={{
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
                border: '1px solid rgba(102, 126, 234, 0.3)',
              }}
            />
            {/* タイマー表示 */}
            {!isLateAnswer && !hasAnswered && (
              <Chip
                icon={<TimerIcon />}
                label={`${Math.floor(timeRemaining / 60)}:${String(timeRemaining % 60).padStart(2, '0')}`}
                size="small"
                sx={{
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  background: timeRemaining <= 30
                    ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(248, 113, 113, 0.2) 100%)'
                    : timeRemaining <= 60
                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(251, 191, 36, 0.2) 100%)'
                    : 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(52, 211, 153, 0.15) 100%)',
                  border: timeRemaining <= 30
                    ? '1px solid rgba(239, 68, 68, 0.4)'
                    : timeRemaining <= 60
                    ? '1px solid rgba(245, 158, 11, 0.4)'
                    : '1px solid rgba(16, 185, 129, 0.3)',
                  color: timeRemaining <= 30 ? '#dc2626' : timeRemaining <= 60 ? '#d97706' : 'inherit',
                  animation: timeRemaining <= 30 ? 'pulse 1s ease-in-out infinite' : 'none',
                  '@keyframes pulse': {
                    '0%, 100%': { transform: 'scale(1)' },
                    '50%': { transform: 'scale(1.05)' },
                  },
                }}
              />
            )}
            <Chip
              icon={<CheckCircleIcon />}
              label={`${answeredCount}/${totalPlayers}人回答`}
              size="small"
              color={allPlayersAnswered ? 'success' : 'default'}
              sx={{
                background: allPlayersAnswered
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(52, 211, 153, 0.15) 100%)'
                  : 'rgba(255, 255, 255, 0.5)',
                border: allPlayersAnswered ? '1px solid rgba(16, 185, 129, 0.3)' : undefined,
              }}
            />
          </Box>
          <LinearProgress
            variant="determinate"
            value={progressPercent}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'rgba(102, 126, 234, 0.1)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                background: allPlayersAnswered
                  ? 'linear-gradient(135deg, #10b981 0%, #34d399 100%)'
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              },
            }}
          />
        </Container>
      </Box>

      <Container maxWidth="sm" sx={{ pb: 4, pt: 10 }}>
        {/* 質問カード */}
        <Grow in timeout={600}>
          <Paper
            elevation={3}
            sx={{
              p: 3,
              mb: 3,
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
              border: '2px solid rgba(102, 126, 234, 0.2)',
              textAlign: 'center',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 2 }}>
              <QuizIcon sx={{ color: 'primary.main' }} />
              <Typography variant="body2" color="text.secondary">
                質問 {room.current_question_index + 1}
              </Typography>
            </Box>
            <Typography
              variant="h5"
              component="h1"
              sx={{
                fontWeight: 700,
                lineHeight: 1.4,
              }}
            >
              {currentQuestion.question_text}
            </Typography>
          </Paper>
        </Grow>

      {/* 質問一覧ボタン */}
      <Fade in timeout={700}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<FormatListBulletedIcon />}
          onClick={() => setShowQuestionList(true)}
          sx={{
            mb: 2,
            borderRadius: 2,
            textTransform: 'none',
          }}
        >
          問題一覧 ({allQuestions.length}問)
        </Button>
      </Fade>

      {/* 質問一覧ボトムシート */}
      <Drawer
        anchor="bottom"
        open={showQuestionList}
        onClose={() => setShowQuestionList(false)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '70vh',
          }
        }}
      >
        {/* ドラッグハンドル */}
        <Box
          sx={{
            width: 40,
            height: 4,
            borderRadius: 2,
            bgcolor: 'rgba(0, 0, 0, 0.2)',
            mx: 'auto',
            mt: 1.5,
            mb: 1,
          }}
        />
        <Box sx={{ px: 2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" fontWeight="bold">
            問題一覧
          </Typography>
          <IconButton onClick={() => setShowQuestionList(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider />
        <List sx={{ py: 0, overflow: 'auto' }}>
          {allQuestions.map((question, index) => {
            const isCurrent = question.id === currentQuestion.id
            const isPast = index < (room.current_question_index)

            return (
              <ListItem
                key={question.id}
                sx={(theme) => ({
                  background: isCurrent
                    ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)'
                    : isPast
                    ? theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)'
                    : 'transparent',
                  borderLeft: isCurrent ? '4px solid' : '4px solid transparent',
                  borderColor: isCurrent ? 'primary.main' : 'transparent',
                  opacity: isPast ? 0.6 : 1
                })}
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={isCurrent ? 700 : 400}>
                        Q{index + 1}
                      </Typography>
                      {isCurrent && (
                        <Chip label="回答中" color="primary" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                      )}
                      {isPast && (
                        <Chip label="終了" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                      )}
                    </Box>
                  }
                  secondary={question.question_text}
                />
              </ListItem>
            )
          })}
        </List>
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button
            fullWidth
            variant="contained"
            onClick={() => setShowQuestionList(false)}
          >
            閉じる
          </Button>
        </Box>
      </Drawer>

      {/* 回答フォーム */}
      <Fade in timeout={800}>
        <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          {isLateAnswer && !hasAnswered && (
            <Alert
              severity="info"
              sx={{ mb: 3 }}
              icon={<LightbulbIcon />}
            >
              <Typography variant="subtitle2" fontWeight="bold">
                参考記録として回答
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5 }}>
                この問題は既に終了しています。ポイントは加算されませんが、あなたの意見を記録できます。
              </Typography>
            </Alert>
          )}

          {hasAnswered ? (
            <Box>
              <Alert
                severity="success"
                icon={<CheckCircleIcon />}
                sx={{
                  mb: 2,
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(52, 211, 153, 0.15) 100%)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                {isLateAnswer ? '参考記録として回答済みです' : '回答完了！他の参加者を待っています...'}
              </Alert>

              <Box sx={{ p: 2, borderRadius: 2, background: 'rgba(102, 126, 234, 0.05)', mb: 2 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>あなたの回答</Typography>
                <Typography variant="body1" fontWeight="600">
                  {myAnswer === 'A' ? `${currentQuestion?.choice_a}（A）` :
                   myAnswer === 'B' ? `${currentQuestion?.choice_b}（B）` :
                   myAnswer}
                </Typography>
                {myPrediction && (
                  <>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }} gutterBottom>多数派予想</Typography>
                    <Typography variant="body1" fontWeight="600">
                      {myPrediction === 'A' ? `${currentQuestion?.choice_a}（A）` :
                       myPrediction === 'B' ? `${currentQuestion?.choice_b}（B）` :
                       myPrediction}
                    </Typography>
                  </>
                )}
              </Box>

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {room?.status === 'showing_result' && (
                  <Button
                    variant="contained"
                    fullWidth
                    onClick={() => router.push(`/room/${roomId}/result`)}
                    startIcon={<VisibilityIcon />}
                  >
                    結果を見る
                  </Button>
                )}
                {room && room.current_question_index > 0 && (
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={() => router.push(`/room/${roomId}/summary`)}
                  >
                    全ての結果
                  </Button>
                )}
              </Box>
            </Box>
          ) : (
            <>
              {/* あなたの意見 */}
              <Box sx={{ mb: 2.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <QuizIcon sx={{ fontSize: 18, color: 'white' }} />
                  </Box>
                  <Typography variant="h6" fontWeight="bold">
                    あなたの意見
                  </Typography>
                </Box>

                <ToggleButtonGroup
                  value={selectedChoice}
                  exclusive
                  onChange={handleChoiceChange}
                  fullWidth
                  orientation="vertical"
                  sx={{ mb: 2 }}
                >
                  <ToggleButton value="A" disabled={hasAnswered}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'flex-start' }}>
                      <Chip label="A" size="small" sx={{ fontWeight: 700, bgcolor: '#ef4444', color: 'white' }} />
                      <Typography>{currentQuestion.choice_a}</Typography>
                    </Box>
                  </ToggleButton>
                  <ToggleButton value="B" disabled={hasAnswered}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'flex-start' }}>
                      <Chip label="B" size="small" sx={{ fontWeight: 700, bgcolor: '#3b82f6', color: 'white' }} />
                      <Typography>{currentQuestion.choice_b}</Typography>
                    </Box>
                  </ToggleButton>
                </ToggleButtonGroup>

                <TextField
                  fullWidth
                  placeholder="または自由に記述..."
                  value={freeText}
                  onChange={(e) => handleFreeTextChange(e.target.value)}
                  disabled={hasAnswered}
                  size="small"
                />
              </Box>

              {/* 多数派予想 */}
              {!isLateAnswer && (
                <Box sx={{ mb: 2.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '10px',
                        background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <LightbulbIcon sx={{ fontSize: 18, color: 'white' }} />
                    </Box>
                    <Box>
                      <Typography variant="h6" fontWeight="bold">
                        多数派の予想
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        当たると +10pt
                      </Typography>
                    </Box>
                  </Box>

                  <ToggleButtonGroup
                    value={selectedPrediction}
                    exclusive
                    onChange={handlePredictionChange}
                    fullWidth
                    orientation="vertical"
                    sx={{ mb: 2 }}
                  >
                    <ToggleButton value="A" disabled={hasAnswered}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'flex-start' }}>
                        <Chip label="A" size="small" sx={{ fontWeight: 700, bgcolor: '#ef4444', color: 'white' }} />
                        <Typography>{currentQuestion.choice_a}</Typography>
                      </Box>
                    </ToggleButton>
                    <ToggleButton value="B" disabled={hasAnswered}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', justifyContent: 'flex-start' }}>
                        <Chip label="B" size="small" sx={{ fontWeight: 700, bgcolor: '#3b82f6', color: 'white' }} />
                        <Typography>{currentQuestion.choice_b}</Typography>
                      </Box>
                    </ToggleButton>
                  </ToggleButtonGroup>

                  <TextField
                    fullWidth
                    placeholder="または自由に記述..."
                    value={predictionText}
                    onChange={(e) => handlePredictionTextChange(e.target.value)}
                    disabled={hasAnswered}
                    size="small"
                  />
                </Box>
              )}

              {/* コメント */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '10px',
                      background: 'linear-gradient(135deg, #64748b 0%, #94a3b8 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ChatIcon sx={{ fontSize: 18, color: 'white' }} />
                  </Box>
                  <Box>
                    <Typography variant="h6" fontWeight="bold">
                      コメント
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      任意・結果画面で表示
                    </Typography>
                  </Box>
                </Box>
                <TextField
                  fullWidth
                  multiline
                  rows={2}
                  placeholder="面白いコメントを残そう！"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={hasAnswered}
                />
              </Box>

              <AnimatedButton
                fullWidth
                variant="contained"
                size="large"
                onClick={handleOpenConfirmDialog}
                disabled={!isAnswerValid}
                startIcon={<SendIcon />}
                sx={{ py: 2 }}
              >
                {isLateAnswer ? '参考記録として回答' : '回答する'}
              </AnimatedButton>
            </>
          )}
        </Paper>
      </Fade>

      {/* 参加者一覧・回答状況 */}
      <Fade in timeout={850}>
        <Paper
          elevation={3}
          sx={{
            p: 2,
            mb: 2,
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
            borderRadius: 3,
          }}
        >
          {(() => {
            // ダミーデータを含めた表示用プレイヤーリスト
            const displayPlayers = generateDummyPlayers(20, players)
            const displayAnsweredCount = displayPlayers.filter(p => p.hasAnswered).length
            const displayTotalPlayers = displayPlayers.length

            return (
              <>
                <Box
                  onClick={() => displayPlayers.length > INITIAL_PLAYER_DISPLAY && setShowAnswerDetails(!showAnswerDetails)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: showAnswerDetails || displayPlayers.length <= INITIAL_PLAYER_DISPLAY ? 1.5 : 0,
                    cursor: displayPlayers.length > INITIAL_PLAYER_DISPLAY ? 'pointer' : 'default',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PersonIcon fontSize="small" color="primary" />
                    <Typography variant="subtitle2" fontWeight="bold">
                      回答状況
                    </Typography>
                    <Chip
                      label={`${displayAnsweredCount}/${displayTotalPlayers}人`}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        background: displayAnsweredCount === displayTotalPlayers
                          ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(52, 211, 153, 0.2) 100%)'
                          : 'rgba(102, 126, 234, 0.15)',
                        color: displayAnsweredCount === displayTotalPlayers ? '#059669' : 'primary.main',
                      }}
                    />
                  </Box>
                  {displayPlayers.length > INITIAL_PLAYER_DISPLAY && (
                    <IconButton size="small" sx={{ p: 0.5 }}>
                      {showAnswerDetails ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                  )}
                </Box>

                {/* 常時表示部分（最初の数人 or 全員） */}
                {displayPlayers.length <= INITIAL_PLAYER_DISPLAY ? (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {displayPlayers.map((player) => (
                      <Chip
                        key={player.id}
                        label={player.nickname}
                        size="small"
                        icon={player.hasAnswered ? <CheckCircleIcon /> : <HourglassEmptyIcon />}
                        sx={{
                          background: player.hasAnswered
                            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(52, 211, 153, 0.2) 100%)'
                            : 'rgba(0, 0, 0, 0.05)',
                          border: player.hasAnswered
                            ? '1px solid rgba(16, 185, 129, 0.3)'
                            : '1px solid rgba(0, 0, 0, 0.1)',
                          fontWeight: player.id === playerId ? 700 : 400,
                          '& .MuiChip-icon': {
                            color: player.hasAnswered ? '#10b981' : '#9ca3af',
                          },
                        }}
                      />
                    ))}
                  </Box>
                ) : (
                  <Collapse in={showAnswerDetails}>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {displayPlayers.map((player) => (
                        <Chip
                          key={player.id}
                          label={player.nickname}
                          size="small"
                          icon={player.hasAnswered ? <CheckCircleIcon /> : <HourglassEmptyIcon />}
                          sx={{
                            background: player.hasAnswered
                              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(52, 211, 153, 0.2) 100%)'
                              : 'rgba(0, 0, 0, 0.05)',
                            border: player.hasAnswered
                              ? '1px solid rgba(16, 185, 129, 0.3)'
                              : '1px solid rgba(0, 0, 0, 0.1)',
                            fontWeight: player.id === playerId ? 700 : 400,
                            '& .MuiChip-icon': {
                              color: player.hasAnswered ? '#10b981' : '#9ca3af',
                            },
                          }}
                        />
                      ))}
                    </Box>
                  </Collapse>
                )}

                {/* 折りたたみ状態の場合のサマリー */}
                {displayPlayers.length > INITIAL_PLAYER_DISPLAY && !showAnswerDetails && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      タップして詳細を表示
                    </Typography>
                  </Box>
                )}
              </>
            )
          })()}
        </Paper>
      </Fade>

      {/* 主催者コントロール */}
      {isHost && (
        <Fade in timeout={900}>
          <Paper
            elevation={3}
            sx={{
              p: 3,
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(251, 191, 36, 0.15) 100%)',
              border: '2px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            <Typography variant="subtitle1" gutterBottom fontWeight="bold" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <VisibilityIcon sx={{ color: '#f59e0b' }} />
              主催者コントロール
            </Typography>
            <Button
              fullWidth
              variant="contained"
              color="success"
              size="large"
              onClick={handleShowResults}
              disabled={answeredCount === 0}
              sx={{ py: 1.5 }}
            >
              {allPlayersAnswered ? '結果を表示する' : `結果を表示する (${answeredCount}/${totalPlayers}人回答済)`}
            </Button>
            {!allPlayersAnswered && answeredCount > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                全員の回答を待たずに結果を表示できます
              </Typography>
            )}
          </Paper>
        </Fade>
      )}
    </Container>

      {/* 回答確認ダイアログ */}
      <Dialog
        open={confirmDialogOpen}
        onClose={() => setConfirmDialogOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: (theme) =>
              theme.palette.mode === 'dark'
                ? 'rgba(30, 41, 59, 0.95)'
                : 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            minWidth: 300,
          }
        }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 'bold' }}>
          回答内容の確認
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              あなたの意見
            </Typography>
            <Typography variant="body1" fontWeight="600" sx={{
              p: 1.5,
              borderRadius: 2,
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%)',
            }}>
              {getDisplayAnswer()}
            </Typography>
          </Box>
          {!isLateAnswer && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                多数派の予想
              </Typography>
              <Typography variant="body1" fontWeight="600" sx={{
                p: 1.5,
                borderRadius: 2,
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(251, 191, 36, 0.1) 100%)',
              }}>
                {getDisplayPrediction()}
              </Typography>
            </Box>
          )}
          {comment.trim() && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                コメント
              </Typography>
              <Typography variant="body2" sx={{
                p: 1.5,
                borderRadius: 2,
                background: 'rgba(0, 0, 0, 0.05)',
              }}>
                {comment}
              </Typography>
            </Box>
          )}
          <Typography variant="body2" color="warning.main" sx={{ mt: 2 }}>
            ※ 送信後は変更できません
          </Typography>
          <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block', lineHeight: 1.5 }}>
            ※会社に関わる情報や、氏名・住所・電話番号・メールアドレスなどの個人情報は記載しないでください
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setConfirmDialogOpen(false)}
            variant="outlined"
          >
            戻る
          </Button>
          <AnimatedButton
            onClick={handleConfirmSubmit}
            variant="contained"
            startIcon={<SendIcon />}
          >
            送信する
          </AnimatedButton>
        </DialogActions>
      </Dialog>
    </>
  )
}
