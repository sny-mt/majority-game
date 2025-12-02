'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Snackbar,
  Alert,
  Fade,
  Grow,
  Skeleton,
  LinearProgress
} from '@mui/material'
import ChatBubbleIcon from '@mui/icons-material/ChatBubble'
import CloseIcon from '@mui/icons-material/Close'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import GroupsIcon from '@mui/icons-material/Groups'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CelebrationIcon from '@mui/icons-material/Celebration'
import StarIcon from '@mui/icons-material/Star'
import { supabase } from '@/lib/supabase'
import { getOrCreatePlayerId } from '@/lib/utils/player'
import { aggregateAnswers, type AnswerGroup } from '@/lib/utils/aggregation'
import type { Room, Question, Player, Answer } from '@/types/database'

interface QuestionResult {
  id: string
  questionText: string
  choiceA: string
  choiceB: string
  answerGroups: AnswerGroup[]
  totalAnswers: number
}

export default function ResultPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string

  const [room, setRoom] = useState<Room | null>(null)
  const [result, setResult] = useState<QuestionResult | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [totalQuestions, setTotalQuestions] = useState(0)
  const [players, setPlayers] = useState<Player[]>([])
  const [answers, setAnswers] = useState<Answer[]>([])
  const [currentPlayerCorrect, setCurrentPlayerCorrect] = useState(false)
  const [selectedComment, setSelectedComment] = useState<{ playerName: string; comment: string } | null>(null)
  const [playerId, setPlayerId] = useState<string>('')
  const [showTransitionSnackbar, setShowTransitionSnackbar] = useState(false)
  const [countdown, setCountdown] = useState(3)

  useEffect(() => {
    const initializeResult = async () => {
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

        const { data: questionData, error: questionError } = await supabase
          .from('questions')
          .select('*')
          .eq('room_id', roomId)
          .eq('order_index', roomData.current_question_index)
          .single()

        if (questionError) throw questionError

        const { count } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', roomId)

        setTotalQuestions(count || 0)

        const { data: answersData, error: answersError } = await supabase
          .from('answers')
          .select('*')
          .eq('question_id', questionData.id)

        if (answersError) throw answersError

        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomId)
          .order('score', { ascending: false })
          .order('joined_at', { ascending: true })

        if (playersError) throw playersError

        const answerGroups = aggregateAnswers(
          answersData,
          playersData,
          questionData.choice_a,
          questionData.choice_b
        )

        // 同率の場合も含め、全てのマジョリティグループを取得
        const majorityGroups = answerGroups.filter(group => group.isMajority)
        const majorityAnswers = majorityGroups.map(group => group.answer)

        let currentPlayerGotItRight = false

        if (majorityAnswers.length > 0) {
          const updatePromises = answersData.map(async (answer) => {
            if (answer.is_correct_prediction !== false || answer.points_earned !== 0) {
              if (answer.player_id === pid && answer.is_correct_prediction) {
                currentPlayerGotItRight = true
              }
              return
            }

            const prediction = answer.prediction || ''
            let isCorrect = false

            // 複数のマジョリティ回答のいずれかに一致すれば正解
            for (const majorityAnswer of majorityAnswers) {
              if (prediction === majorityAnswer) {
                isCorrect = true
                break
              } else if (prediction === 'A' && majorityAnswer.includes('(A)')) {
                isCorrect = true
                break
              } else if (prediction === 'B' && majorityAnswer.includes('(B)')) {
                isCorrect = true
                break
              } else if (prediction.length > 1 && majorityAnswer.includes(prediction)) {
                isCorrect = true
                break
              }
            }

            const points = isCorrect ? 10 : 0

            await supabase
              .from('answers')
              .update({
                is_correct_prediction: isCorrect,
                points_earned: points
              })
              .eq('id', answer.id)

            answer.is_correct_prediction = isCorrect
            answer.points_earned = points

            if (answer.player_id === pid && isCorrect) {
              currentPlayerGotItRight = true
            }
          })

          await Promise.all(updatePromises)

          const playerScores = new Map<string, number>()

          const { data: roomQuestionsData } = await supabase
            .from('questions')
            .select('id')
            .eq('room_id', roomId)

          if (roomQuestionsData) {
            const questionIds = roomQuestionsData.map(q => q.id)

            const { data: allAnswersData } = await supabase
              .from('answers')
              .select('player_id, points_earned')
              .in('player_id', playersData.map(p => p.id))
              .in('question_id', questionIds)

            if (allAnswersData) {
              for (const answer of allAnswersData) {
                const currentScore = playerScores.get(answer.player_id) || 0
                playerScores.set(answer.player_id, currentScore + (answer.points_earned || 0))
              }

              const scoreUpdatePromises = Array.from(playerScores.entries()).map(async ([playerId, totalScore]) => {
                await supabase
                  .from('players')
                  .update({ score: totalScore })
                  .eq('id', playerId)
                  .eq('room_id', roomId)
              })

              await Promise.all(scoreUpdatePromises)
            }
          }
        }

        const { data: updatedPlayersData } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomId)
          .order('score', { ascending: false })
          .order('joined_at', { ascending: true })

        if (updatedPlayersData) {
          setPlayers(updatedPlayersData)
        }

        setAnswers(answersData)
        setCurrentPlayerCorrect(currentPlayerGotItRight)

        setResult({
          id: questionData.id,
          questionText: questionData.question_text,
          choiceA: questionData.choice_a,
          choiceB: questionData.choice_b,
          answerGroups,
          totalAnswers: answersData.length
        })

        setIsLoading(false)
      } catch (error) {
        console.error('Error initializing result:', error)
        setIsLoading(false)
      }
    }

    initializeResult()
  }, [roomId])

  useEffect(() => {
    if (currentPlayerCorrect && !isLoading && typeof window !== 'undefined') {
      import('canvas-confetti').then((confettiModule) => {
        const confetti = confettiModule.default

        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        })

        const duration = 3000
        const animationEnd = Date.now() + duration
        const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 }

        function randomInRange(min: number, max: number) {
          return Math.random() * (max - min) + min
        }

        const interval: NodeJS.Timeout = setInterval(function() {
          const timeLeft = animationEnd - Date.now()

          if (timeLeft <= 0) {
            return clearInterval(interval)
          }

          const particleCount = 50 * (timeLeft / duration)

          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
          })
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
          })
        }, 250)

        return () => clearInterval(interval)
      })
    }
  }, [currentPlayerCorrect, isLoading])

  useEffect(() => {
    if (!room) return

    const roomChannel = supabase
      .channel(`room_result:${roomId}`)
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

          if (updatedRoom.status === 'answering') {
            if (isHost) {
              router.push(`/room/${roomId}/answer`)
            } else {
              setShowTransitionSnackbar(true)
              setCountdown(3)
            }
          }

          if (updatedRoom.status === 'finished') {
            router.push(`/room/${roomId}/summary`)
          }
        }
      )
      .subscribe()

    return () => {
      roomChannel.unsubscribe()
    }
  }, [room, roomId, router, isHost])

  useEffect(() => {
    if (!showTransitionSnackbar) return

    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1)
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      router.push(`/room/${roomId}/answer`)
    }
  }, [showTransitionSnackbar, countdown, router, roomId])

  const handleNextQuestion = async () => {
    if (!isHost || !room) return

    try {
      const nextIndex = room.current_question_index + 1

      const { error } = await supabase
        .from('rooms')
        .update({
          current_question_index: nextIndex,
          status: 'answering'
        })
        .eq('id', roomId)

      if (error) throw error

      router.push(`/room/${roomId}/answer`)
    } catch (error) {
      console.error('Error moving to next question:', error)
      alert('次の質問への移動に失敗しました')
    }
  }

  const handleFinishGame = async () => {
    if (!isHost) return

    try {
      const { error } = await supabase
        .from('rooms')
        .update({ status: 'finished' })
        .eq('id', roomId)

      if (error) throw error

      router.push(`/room/${roomId}/summary`)
    } catch (error) {
      console.error('Error finishing game:', error)
      alert('ゲーム終了に失敗しました')
    }
  }

  const handlePlayerClick = (playerName: string, playerId: string) => {
    const answer = answers.find(a => a.player_id === playerId)
    if (answer && answer.comment) {
      setSelectedComment({ playerName, comment: answer.comment })
    }
  }

  const handleCloseComment = () => {
    setSelectedComment(null)
  }

  if (isLoading) {
    return (
      <Container maxWidth="md">
        <Box sx={{ mt: 4 }}>
          <Paper elevation={3} sx={{ p: 4 }}>
            <Skeleton variant="text" width="40%" height={32} sx={{ mx: 'auto', mb: 2 }} />
            <Skeleton variant="text" width="80%" height={48} sx={{ mx: 'auto', mb: 4 }} />
            <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 3, mb: 3 }} />
            <Skeleton variant="rectangular" height={100} sx={{ borderRadius: 2, mb: 2 }} />
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
          </Paper>
        </Box>
      </Container>
    )
  }

  if (!room || !result) {
    return (
      <Container maxWidth="md">
        <Box sx={{ mt: 8 }}>
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="error">
              結果が見つかりません
            </Typography>
          </Paper>
        </Box>
      </Container>
    )
  }

  const isLastQuestion = room.current_question_index >= totalQuestions - 1

  return (
    <Container maxWidth="md" sx={{ pb: 4, pt: 2 }}>
      {/* ヘッダー */}
      <Fade in timeout={500}>
        <Box sx={{ mb: 3, textAlign: 'center' }}>
          <Chip
            label={`質問 ${room.current_question_index + 1} / ${totalQuestions}`}
            size="small"
            sx={{
              mb: 2,
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)',
              border: '1px solid rgba(102, 126, 234, 0.3)',
            }}
          />
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              mb: 1,
            }}
          >
            集計結果
          </Typography>
          <Typography variant="body1" color="text.secondary">
            {result.questionText}
          </Typography>
        </Box>
      </Fade>

      {/* 予想的中メッセージ */}
      {currentPlayerCorrect && (
        <Grow in timeout={800}>
          <Paper
            elevation={6}
            sx={{
              p: 3,
              mb: 3,
              background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
              color: 'white',
              textAlign: 'center',
              borderRadius: 3,
              animation: 'pulse 1s ease-in-out 3',
              '@keyframes pulse': {
                '0%, 100%': { transform: 'scale(1)' },
                '50%': { transform: 'scale(1.02)' },
              },
            }}
          >
            <CelebrationIcon sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
              おめでとうございます！
            </Typography>
            <Typography variant="h6">
              予想的中！ +10ポイント獲得！
            </Typography>
          </Paper>
        </Grow>
      )}

      {/* マジョリティ回答 */}
      {result.answerGroups
        .filter(group => group.isMajority)
        .map((group, index) => (
          <Grow in timeout={600} key={index}>
            <Paper
              elevation={4}
              sx={{
                p: 4,
                mb: 3,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                textAlign: 'center',
                borderRadius: 3,
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)',
                },
              }}
            >
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                <GroupsIcon sx={{ fontSize: 40, mb: 1, opacity: 0.9 }} />
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, opacity: 0.9 }}>
                  マジョリティ回答
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 'bold', my: 2 }}>
                  {group.answer}
                </Typography>
                <Typography variant="h6" sx={{ opacity: 0.9 }}>
                  {group.count}人 ({group.percentage.toFixed(1)}%)
                </Typography>
                <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                  {group.players.map((playerName, idx) => {
                    const player = players.find(p => p.nickname === playerName)
                    const answer = player ? answers.find(a => a.player_id === player.id) : null
                    const hasComment = answer && answer.comment

                    return (
                      <Chip
                        key={idx}
                        label={playerName}
                        icon={hasComment ? <ChatBubbleIcon /> : undefined}
                        onClick={hasComment && player ? () => handlePlayerClick(playerName, player.id) : undefined}
                        sx={{
                          fontSize: '0.95rem',
                          py: 2.5,
                          background: 'rgba(255, 255, 255, 0.2)',
                          color: 'white',
                          cursor: hasComment ? 'pointer' : 'default',
                          transition: 'all 0.2s',
                          '&:hover': hasComment ? {
                            background: 'rgba(255, 255, 255, 0.3)',
                            transform: 'scale(1.05)',
                          } : {},
                          '& .MuiChip-icon': {
                            color: 'white',
                          },
                        }}
                      />
                    )
                  })}
                </Box>
              </Box>
            </Paper>
          </Grow>
        ))}

      {/* その他の回答 */}
      {result.answerGroups.filter(group => !group.isMajority).length > 0 && (
        <Fade in timeout={700}>
          <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              その他の回答
            </Typography>
            {result.answerGroups
              .filter(group => !group.isMajority)
              .map((group, index) => (
                <Box
                  key={index}
                  sx={{
                    mb: 2,
                    p: 2,
                    borderRadius: 2,
                    background: 'rgba(102, 126, 234, 0.05)',
                    border: '1px solid rgba(102, 126, 234, 0.1)',
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {group.answer}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {group.count}人 ({group.percentage.toFixed(1)}%)
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={group.percentage}
                    sx={{
                      height: 6,
                      borderRadius: 3,
                      bgcolor: 'rgba(102, 126, 234, 0.1)',
                      mb: 1.5,
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 3,
                        background: 'linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)',
                      },
                    }}
                  />
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {group.players.map((playerName, idx) => {
                      const player = players.find(p => p.nickname === playerName)
                      const answer = player ? answers.find(a => a.player_id === player.id) : null
                      const hasComment = answer && answer.comment

                      return (
                        <Chip
                          key={idx}
                          label={playerName}
                          icon={hasComment ? <ChatBubbleIcon /> : undefined}
                          size="small"
                          onClick={hasComment && player ? () => handlePlayerClick(playerName, player.id) : undefined}
                          sx={{
                            cursor: hasComment ? 'pointer' : 'default',
                            transition: 'all 0.2s',
                            '&:hover': hasComment ? { transform: 'scale(1.05)' } : {},
                          }}
                        />
                      )
                    })}
                  </Box>
                </Box>
              ))}
          </Paper>
        </Fade>
      )}

      {/* 予想的中プレイヤー */}
      {answers.filter(a => a.is_correct_prediction).length > 0 && (
        <Fade in timeout={800}>
          <Paper
            elevation={3}
            sx={{
              p: 3,
              mb: 3,
              borderRadius: 3,
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(52, 211, 153, 0.1) 100%)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CheckCircleIcon sx={{ color: '#10b981' }} />
              <Typography variant="h6" fontWeight="bold">
                予想的中！（+10pt）
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {answers
                .filter(a => a.is_correct_prediction)
                .map(answer => {
                  const player = players.find(p => p.id === answer.player_id)
                  return player ? (
                    <Chip
                      key={answer.id}
                      label={player.nickname}
                      icon={<StarIcon />}
                      sx={{
                        fontWeight: 600,
                        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(52, 211, 153, 0.2) 100%)',
                        border: '1px solid rgba(16, 185, 129, 0.3)',
                        '& .MuiChip-icon': {
                          color: '#10b981',
                        },
                      }}
                    />
                  ) : null
                })}
            </Box>
          </Paper>
        </Fade>
      )}

      {/* リーダーボード */}
      <Fade in timeout={900}>
        <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <EmojiEventsIcon sx={{ color: '#f59e0b' }} />
            <Typography variant="h6" fontWeight="bold">
              現在の順位
            </Typography>
          </Box>
          {players.map((player, index) => {
            const isCurrentPlayer = player.id === playerId

            let rank = 1
            for (let i = 0; i < index; i++) {
              if (players[i].score > player.score) {
                rank++
              }
            }

            const isFirstPlace = rank === 1

            return (
              <Box
                key={player.id}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 2,
                  mb: 1,
                  borderRadius: 2,
                  background: isCurrentPlayer
                    ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)'
                    : isFirstPlace
                    ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(251, 191, 36, 0.15) 100%)'
                    : 'rgba(0, 0, 0, 0.02)',
                  border: isCurrentPlayer
                    ? '2px solid rgba(102, 126, 234, 0.4)'
                    : isFirstPlace
                    ? '2px solid rgba(245, 158, 11, 0.4)'
                    : '2px solid transparent',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateX(4px)',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      background: isFirstPlace
                        ? 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)'
                        : 'rgba(102, 126, 234, 0.1)',
                      color: isFirstPlace ? 'white' : 'text.primary',
                    }}
                  >
                    {rank}
                  </Box>
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: isCurrentPlayer || isFirstPlace ? 700 : 400,
                    }}
                  >
                    {player.nickname}
                    {isCurrentPlayer && (
                      <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                        (あなた)
                      </Typography>
                    )}
                  </Typography>
                </Box>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  {player.score}pt
                </Typography>
              </Box>
            )
          })}
        </Paper>
      </Fade>

      {/* ナビゲーション */}
      {room.current_question_index > 0 && (
        <Fade in timeout={950}>
          <Paper elevation={2} sx={{ p: 2, mb: 3, borderRadius: 2 }}>
            <Button
              variant="outlined"
              fullWidth
              onClick={() => router.push(`/room/${roomId}/summary`)}
            >
              全ての結果を見る
            </Button>
          </Paper>
        </Fade>
      )}

      {/* 主催者コントロール */}
      {isHost && (
        <Fade in timeout={1000}>
          <Paper
            elevation={3}
            sx={{
              p: 3,
              borderRadius: 3,
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(251, 191, 36, 0.15) 100%)',
              border: '2px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              主催者コントロール
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              {!isLastQuestion ? (
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={handleNextQuestion}
                  endIcon={<NavigateNextIcon />}
                  sx={{ py: 1.5 }}
                >
                  次の質問へ
                </Button>
              ) : (
                <Button
                  fullWidth
                  variant="contained"
                  color="success"
                  size="large"
                  onClick={handleFinishGame}
                  startIcon={<EmojiEventsIcon />}
                  sx={{ py: 1.5 }}
                >
                  ゲーム終了
                </Button>
              )}
            </Box>
          </Paper>
        </Fade>
      )}

      {/* コメントモーダル */}
      <Dialog
        open={!!selectedComment}
        onClose={handleCloseComment}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
          },
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <ChatBubbleIcon color="primary" />
              <Typography variant="h6">{selectedComment?.playerName}のコメント</Typography>
            </Box>
            <IconButton onClick={handleCloseComment} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)',
              borderRadius: 2,
              border: '1px solid rgba(102, 126, 234, 0.1)',
            }}
          >
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {selectedComment?.comment}
            </Typography>
          </Paper>
        </DialogContent>
      </Dialog>

      {/* 次の問題への遷移スナックバー */}
      <Snackbar
        open={showTransitionSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        sx={{ mt: 8 }}
      >
        <Alert
          severity="info"
          sx={{
            width: '100%',
            fontSize: '1.1rem',
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.95) 0%, rgba(139, 92, 246, 0.95) 100%)',
            color: 'white',
            '& .MuiAlert-icon': {
              color: 'white',
            },
          }}
        >
          {countdown}秒後に次の問題に移動します...
        </Alert>
      </Snackbar>
    </Container>
  )
}
