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
  LinearProgress,
  Slide,
  Zoom
} from '@mui/material'
import ChatBubbleIcon from '@mui/icons-material/ChatBubble'
import CloseIcon from '@mui/icons-material/Close'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import GroupsIcon from '@mui/icons-material/Groups'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import CelebrationIcon from '@mui/icons-material/Celebration'
import StarIcon from '@mui/icons-material/Star'
import TrendingUpIcon from '@mui/icons-material/TrendingUp'
import TrendingDownIcon from '@mui/icons-material/TrendingDown'
import RemoveIcon from '@mui/icons-material/Remove'
import { supabase } from '@/lib/supabase'
import { getOrCreatePlayerId } from '@/lib/utils/player'
import { aggregateAnswers, type AnswerGroup } from '@/lib/utils/aggregation'
import type { Room, Question, Player, Answer } from '@/types/database'
import { useShakeEffect } from '@/components/PopEffect'

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
  const [currentPlayerFreeTextBonus, setCurrentPlayerFreeTextBonus] = useState(0)
  const [selectedComment, setSelectedComment] = useState<{ playerName: string; comment: string } | null>(null)
  const [playerId, setPlayerId] = useState<string>('')
  const [showTransitionSnackbar, setShowTransitionSnackbar] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const [animatedPercentages, setAnimatedPercentages] = useState<Map<string, number>>(new Map())
  const [showResults, setShowResults] = useState(false)
  const [previousRanks, setPreviousRanks] = useState<Map<string, number>>(new Map())
  const [rankChanges, setRankChanges] = useState<Map<string, number>>(new Map())
  const [showRankAnimation, setShowRankAnimation] = useState(false)
  const [showMajorityReveal, setShowMajorityReveal] = useState(false)
  const [majorityCountAnimation, setMajorityCountAnimation] = useState(0)
  const { shake, shakeStyle, isShaking } = useShakeEffect()
  const [currentPlayerIncorrect, setCurrentPlayerIncorrect] = useState(false)
  const [myAnswer, setMyAnswer] = useState<string>('')
  const [myPrediction, setMyPrediction] = useState<string>('')

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

        // スコア更新前の順位を保存（順位変動表示用）
        const prevRanks = new Map<string, number>()
        let currentRank = 1
        let prevScore = -1
        let sameRankCount = 0
        playersData.forEach((player, index) => {
          if (player.score !== prevScore) {
            currentRank = index + 1
            sameRankCount = 1
          } else {
            sameRankCount++
          }
          prevRanks.set(player.id, currentRank)
          prevScore = player.score
        })
        setPreviousRanks(prevRanks)

        const answerGroups = aggregateAnswers(
          answersData,
          playersData,
          questionData.choice_a,
          questionData.choice_b
        )

        // 同率の場合も含め、全てのマジョリティグループを取得
        const majorityGroups = answerGroups.filter(group => group.isMajority)
        const majorityAnswers = majorityGroups.map(group => group.answer)

        // マジョリティとなった元の回答値を取得（A, B, または自由記述）
        const majorityRawAnswers: string[] = []
        answersData.forEach(ans => {
          const displayAnswer = ans.answer === 'A'
            ? `${questionData.choice_a} (A)`
            : ans.answer === 'B'
            ? `${questionData.choice_b} (B)`
            : ans.answer
          if (majorityAnswers.includes(displayAnswer)) {
            if (!majorityRawAnswers.includes(ans.answer)) {
              majorityRawAnswers.push(ans.answer)
            }
          }
        })

        // 自由記述の完全一致グループを計算（A/B以外の回答）
        const freeTextAnswerCounts = new Map<string, number>()
        answersData.forEach(ans => {
          if (ans.answer !== 'A' && ans.answer !== 'B') {
            const count = freeTextAnswerCounts.get(ans.answer) || 0
            freeTextAnswerCounts.set(ans.answer, count + 1)
          }
        })

        let currentPlayerGotItRight = false

        if (majorityAnswers.length > 0) {
          // 1. まずメモリ上で全ての計算を完了（DB更新は後で一括）
          const answersToUpdate: { id: string; isCorrect: boolean; points: number }[] = []

          answersData.forEach((answer) => {
            // 既に計算済みの場合はスキップ
            if (answer.is_correct_prediction !== false || answer.points_earned !== 0) {
              if (answer.player_id === pid && answer.is_correct_prediction) {
                currentPlayerGotItRight = true
              }
              return
            }

            const prediction = answer.prediction || ''
            let isCorrect = false

            // 予想がマジョリティ回答と一致するかチェック
            if (majorityRawAnswers.includes(prediction)) {
              isCorrect = true
            } else if (prediction === 'A' && majorityRawAnswers.includes('A')) {
              isCorrect = true
            } else if (prediction === 'B' && majorityRawAnswers.includes('B')) {
              isCorrect = true
            } else if (prediction === questionData.choice_a && majorityRawAnswers.includes('A')) {
              isCorrect = true
            } else if (prediction === questionData.choice_b && majorityRawAnswers.includes('B')) {
              isCorrect = true
            } else {
              for (const majorityAnswer of majorityAnswers) {
                if (prediction === majorityAnswer) {
                  isCorrect = true
                  break
                } else if (prediction.length > 1 && majorityAnswer.includes(prediction)) {
                  isCorrect = true
                  break
                }
              }
            }

            // ポイント計算
            let points = isCorrect ? 10 : 0
            const answerText = answer.answer
            if (answerText !== 'A' && answerText !== 'B') {
              const matchCount = freeTextAnswerCounts.get(answerText) || 0
              if (matchCount >= 2) {
                points += matchCount * 5
              }
            }

            // 更新対象リストに追加
            answersToUpdate.push({ id: answer.id, isCorrect, points })

            // メモリ上でも更新
            answer.is_correct_prediction = isCorrect
            answer.points_earned = points

            if (answer.player_id === pid) {
              if (isCorrect) {
                currentPlayerGotItRight = true
              }
            }
          })

          // 2. 回答のDB更新（並列実行）
          if (answersToUpdate.length > 0) {
            await Promise.all(
              answersToUpdate.map(({ id, isCorrect, points }) =>
                supabase
                  .from('answers')
                  .update({ is_correct_prediction: isCorrect, points_earned: points })
                  .eq('id', id)
              )
            )
          }

          // 3. スコア計算（メモリ上で計算してから一括更新）
          const { data: roomQuestionsData } = await supabase
            .from('questions')
            .select('id')
            .eq('room_id', roomId)

          if (roomQuestionsData) {
            const questionIds = roomQuestionsData.map(q => q.id)

            const { data: allAnswersData } = await supabase
              .from('answers')
              .select('player_id, points_earned')
              .in('question_id', questionIds)

            if (allAnswersData) {
              // プレイヤーごとのスコアをメモリ上で集計
              const playerScores = new Map<string, number>()
              for (const answer of allAnswersData) {
                const currentScore = playerScores.get(answer.player_id) || 0
                playerScores.set(answer.player_id, currentScore + (answer.points_earned || 0))
              }

              // プレイヤースコアの一括更新（並列実行）
              await Promise.all(
                Array.from(playerScores.entries()).map(([playerId, totalScore]) =>
                  supabase
                    .from('players')
                    .update({ score: totalScore })
                    .eq('id', playerId)
                    .eq('room_id', roomId)
                )
              )
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

          // 順位変動を計算
          const changes = new Map<string, number>()
          let newCurrentRank = 1
          let newPrevScore = -1
          updatedPlayersData.forEach((player, index) => {
            if (player.score !== newPrevScore) {
              newCurrentRank = index + 1
            }
            const oldRank = prevRanks.get(player.id) || newCurrentRank
            const rankChange = oldRank - newCurrentRank // プラスなら上昇、マイナスなら下降
            changes.set(player.id, rankChange)
            newPrevScore = player.score
          })
          setRankChanges(changes)

          // 順位アニメーションを遅延表示
          setTimeout(() => {
            setShowRankAnimation(true)
          }, 1500)
        }

        setAnswers(answersData)
        setCurrentPlayerCorrect(currentPlayerGotItRight)

        // 自分の回答と予想を保存
        const myAnswerData = answersData.find(a => a.player_id === pid)
        if (myAnswerData) {
          // シンクロボーナスを計算（既に計算済みの場合も表示するため、常にチェック）
          const myAnswerText = myAnswerData.answer
          if (myAnswerText !== 'A' && myAnswerText !== 'B') {
            const matchCount = freeTextAnswerCounts.get(myAnswerText) || 0
            if (matchCount >= 2) {
              setCurrentPlayerFreeTextBonus(matchCount * 5)
            }
          }

          // 回答をわかりやすい形式に変換
          let answerDisplay = myAnswerData.answer
          if (answerDisplay === 'A') {
            answerDisplay = `${questionData.choice_a}（A）`
          } else if (answerDisplay === 'B') {
            answerDisplay = `${questionData.choice_b}（B）`
          }
          setMyAnswer(answerDisplay)

          // 予想をわかりやすい形式に変換
          if (myAnswerData.prediction) {
            let predictionDisplay = myAnswerData.prediction
            if (predictionDisplay === 'A') {
              predictionDisplay = `${questionData.choice_a}（A）`
            } else if (predictionDisplay === 'B') {
              predictionDisplay = `${questionData.choice_b}（B）`
            }
            setMyPrediction(predictionDisplay)
          }

          // 不正解チェック（予想したが外れた場合）
          if (myAnswerData.prediction && !currentPlayerGotItRight) {
            setCurrentPlayerIncorrect(true)
          }
        }

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

  // 正解時の派手な紙吹雪
  useEffect(() => {
    if (currentPlayerCorrect && !isLoading && typeof window !== 'undefined') {
      import('canvas-confetti').then((confettiModule) => {
        const confetti = confettiModule.default

        // 初回の大爆発
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          colors: ['#667eea', '#764ba2', '#f59e0b', '#10b981', '#ec4899'],
        })

        // 左右から花火
        confetti({
          particleCount: 80,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#667eea', '#764ba2'],
        })
        confetti({
          particleCount: 80,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#f59e0b', '#fbbf24'],
        })

        // 継続的な紙吹雪
        const duration = 4000
        const animationEnd = Date.now() + duration
        const defaults = { startVelocity: 35, spread: 360, ticks: 80, zIndex: 9999, colors: ['#667eea', '#764ba2', '#f59e0b', '#10b981', '#ec4899', '#fbbf24'] }

        function randomInRange(min: number, max: number) {
          return Math.random() * (max - min) + min
        }

        const interval: NodeJS.Timeout = setInterval(function() {
          const timeLeft = animationEnd - Date.now()

          if (timeLeft <= 0) {
            return clearInterval(interval)
          }

          const particleCount = 60 * (timeLeft / duration)

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
        }, 200)

        // スター型の紙吹雪を追加
        setTimeout(() => {
          confetti({
            particleCount: 30,
            spread: 60,
            origin: { y: 0.5, x: 0.5 },
            shapes: ['star'],
            colors: ['#fbbf24', '#f59e0b'],
            scalar: 1.5,
          })
        }, 500)

        return () => clearInterval(interval)
      })
    }
  }, [currentPlayerCorrect, isLoading])

  // 不正解時の画面揺れ
  useEffect(() => {
    if (currentPlayerIncorrect && !isLoading) {
      // 少し遅延させて揺らす
      setTimeout(() => {
        shake()
      }, 800)
    }
  }, [currentPlayerIncorrect, isLoading, shake])

  // バーグラフのアニメーション
  useEffect(() => {
    if (!result || isLoading) return

    // 段階的に結果を表示
    const showTimer = setTimeout(() => {
      setShowResults(true)
    }, 300)

    // パーセンテージのアニメーション
    const animatePercentages = () => {
      result.answerGroups.forEach((group, index) => {
        const startTime = Date.now()
        const duration = 1000 + index * 200 // 各グループで少しずつ遅延
        const targetPercentage = group.percentage

        const animate = () => {
          const elapsed = Date.now() - startTime
          const progress = Math.min(elapsed / duration, 1)
          // イージング関数 (easeOutExpo)
          const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress)
          const currentValue = targetPercentage * eased

          setAnimatedPercentages(prev => {
            const newMap = new Map(prev)
            newMap.set(group.answer, currentValue)
            return newMap
          })

          if (progress < 1) {
            requestAnimationFrame(animate)
          }
        }

        setTimeout(() => {
          requestAnimationFrame(animate)
        }, 500 + index * 150)
      })
    }

    animatePercentages()

    return () => clearTimeout(showTimer)
  }, [result, isLoading])

  // マジョリティ発表のアニメーション
  useEffect(() => {
    if (!result || isLoading) return

    // マジョリティを遅延表示
    const revealTimer = setTimeout(() => {
      setShowMajorityReveal(true)

      // マジョリティの人数カウントアップアニメーション
      const majorityGroup = result.answerGroups.find(g => g.isMajority)
      if (majorityGroup) {
        const targetCount = majorityGroup.count
        const duration = 800
        const startTime = Date.now()

        const animateCount = () => {
          const elapsed = Date.now() - startTime
          const progress = Math.min(elapsed / duration, 1)
          // イージング
          const eased = 1 - Math.pow(1 - progress, 3)
          const currentCount = Math.round(targetCount * eased)

          setMajorityCountAnimation(currentCount)

          if (progress < 1) {
            requestAnimationFrame(animateCount)
          }
        }

        requestAnimationFrame(animateCount)
      }
    }, 600)

    return () => clearTimeout(revealTimer)
  }, [result, isLoading])

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
    <Container maxWidth="md" sx={{ pb: 4, pt: 2, ...shakeStyle }}>
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

      {/* 自分の回答と予想 */}
      {(myAnswer || myPrediction) && (
        <Fade in timeout={600}>
          <Paper
            elevation={2}
            sx={{
              p: 2,
              mb: 3,
              borderRadius: 3,
              background: (theme) =>
                theme.palette.mode === 'dark'
                  ? 'rgba(102, 126, 234, 0.1)'
                  : 'rgba(102, 126, 234, 0.05)',
              border: '1px solid rgba(102, 126, 234, 0.2)',
            }}
          >
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5, fontWeight: 600 }}>
              あなたの回答
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              {myAnswer && (
                <Box sx={{ flex: 1, minWidth: 120 }}>
                  <Typography variant="caption" color="text.secondary">
                    意見
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {myAnswer}
                  </Typography>
                </Box>
              )}
              {myPrediction && (
                <Box sx={{ flex: 1, minWidth: 120 }}>
                  <Typography variant="caption" color="text.secondary">
                    多数派予想
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 600,
                      color: currentPlayerCorrect ? '#10b981' : currentPlayerIncorrect ? '#ef4444' : 'inherit',
                    }}
                  >
                    {myPrediction}
                    {currentPlayerCorrect && ' ✓'}
                    {currentPlayerIncorrect && ' ✗'}
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        </Fade>
      )}

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

      {/* 自由記述ボーナスメッセージ */}
      {currentPlayerFreeTextBonus > 0 && (
        <Grow in timeout={900}>
          <Paper
            elevation={6}
            sx={{
              p: 3,
              mb: 3,
              background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
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
            <StarIcon sx={{ fontSize: 48, mb: 1 }} />
            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 1 }}>
              シンクロボーナス！
            </Typography>
            <Typography variant="h6">
              自由記述が一致！ +{currentPlayerFreeTextBonus}ポイント獲得！
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
              ({currentPlayerFreeTextBonus / 5}人と同じ回答)
            </Typography>
          </Paper>
        </Grow>
      )}

      {/* マジョリティ回答 */}
      {result.answerGroups
        .filter(group => group.isMajority)
        .map((group, index) => (
          <Zoom in={showMajorityReveal} timeout={800} key={index}>
            <Paper
              elevation={6}
              sx={{
                p: 4,
                mb: 3,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                textAlign: 'center',
                borderRadius: 4,
                position: 'relative',
                overflow: 'hidden',
                animation: showMajorityReveal ? 'majorityPulse 2s ease-in-out' : 'none',
                '@keyframes majorityPulse': {
                  '0%': { boxShadow: '0 0 0 0 rgba(102, 126, 234, 0.7)' },
                  '50%': { boxShadow: '0 0 30px 10px rgba(102, 126, 234, 0.4)' },
                  '100%': { boxShadow: '0 10px 40px rgba(102, 126, 234, 0.3)' },
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'radial-gradient(circle at 20% 80%, rgba(255,255,255,0.15) 0%, transparent 50%)',
                },
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: '-50%',
                  left: '-50%',
                  right: '-50%',
                  bottom: '-50%',
                  background: 'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.1) 50%, transparent 60%)',
                  animation: 'shine 3s infinite',
                  '@keyframes shine': {
                    '0%': { transform: 'translateX(-100%) rotate(45deg)' },
                    '100%': { transform: 'translateX(100%) rotate(45deg)' },
                  },
                },
              }}
            >
              <Box sx={{ position: 'relative', zIndex: 1 }}>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 70,
                    height: 70,
                    borderRadius: '50%',
                    background: 'rgba(255, 255, 255, 0.2)',
                    mb: 2,
                    animation: 'iconBounce 1s ease-out',
                    '@keyframes iconBounce': {
                      '0%': { transform: 'scale(0) rotate(-180deg)' },
                      '60%': { transform: 'scale(1.2) rotate(10deg)' },
                      '100%': { transform: 'scale(1) rotate(0deg)' },
                    },
                  }}
                >
                  <GroupsIcon sx={{ fontSize: 36 }} />
                </Box>
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    opacity: 0.9,
                    mb: 1,
                  }}
                >
                  マジョリティ回答
                </Typography>
                <Typography
                  variant="h2"
                  sx={{
                    fontWeight: 'bold',
                    my: 2,
                    textShadow: '0 4px 20px rgba(0,0,0,0.3)',
                    animation: 'answerReveal 0.8s ease-out',
                    '@keyframes answerReveal': {
                      '0%': { opacity: 0, transform: 'scale(0.5) translateY(20px)' },
                      '100%': { opacity: 1, transform: 'scale(1) translateY(0)' },
                    },
                  }}
                >
                  {group.answer}
                </Typography>
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 3,
                    py: 1,
                    borderRadius: 3,
                    background: 'rgba(255, 255, 255, 0.15)',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <Typography variant="h5" sx={{ fontWeight: 700 }}>
                    {majorityCountAnimation}人
                  </Typography>
                  <Typography variant="h6" sx={{ opacity: 0.8 }}>
                    ({group.percentage.toFixed(1)}%)
                  </Typography>
                </Box>
                <Box sx={{ mt: 3, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                  {group.players.map((playerName, idx) => {
                    const player = players.find(p => p.nickname === playerName)
                    const answer = player ? answers.find(a => a.player_id === player.id) : null
                    const hasComment = answer && answer.comment

                    return (
                      <Grow in={showMajorityReveal} timeout={800 + idx * 100} key={idx}>
                        <Chip
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
                            backdropFilter: 'blur(5px)',
                            '&:hover': hasComment ? {
                              background: 'rgba(255, 255, 255, 0.35)',
                              transform: 'scale(1.08)',
                            } : {},
                            '& .MuiChip-icon': {
                              color: 'white',
                            },
                          }}
                        />
                      </Grow>
                    )
                  })}
                </Box>
              </Box>
            </Paper>
          </Zoom>
        ))}

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
            const rankChange = rankChanges.get(player.id) || 0

            let rank = 1
            for (let i = 0; i < index; i++) {
              if (players[i].score > player.score) {
                rank++
              }
            }

            const isFirstPlace = rank === 1

            return (
              <Grow in timeout={600 + index * 100} key={player.id}>
                <Box
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
                    transition: 'all 0.3s ease-out',
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
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                      {/* 順位変動アイコン */}
                      {showRankAnimation && rankChange !== 0 && (
                        <Zoom in timeout={300}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                              px: 1,
                              py: 0.25,
                              borderRadius: 1,
                              background: rankChange > 0
                                ? 'rgba(16, 185, 129, 0.15)'
                                : 'rgba(239, 68, 68, 0.15)',
                              animation: 'bounceIn 0.5s ease-out',
                              '@keyframes bounceIn': {
                                '0%': { transform: 'scale(0)', opacity: 0 },
                                '50%': { transform: 'scale(1.2)' },
                                '100%': { transform: 'scale(1)', opacity: 1 },
                              },
                            }}
                          >
                            {rankChange > 0 ? (
                              <TrendingUpIcon sx={{ fontSize: 16, color: '#10b981' }} />
                            ) : (
                              <TrendingDownIcon sx={{ fontSize: 16, color: '#ef4444' }} />
                            )}
                            <Typography
                              variant="caption"
                              sx={{
                                fontWeight: 700,
                                color: rankChange > 0 ? '#10b981' : '#ef4444',
                              }}
                            >
                              {Math.abs(rankChange)}
                            </Typography>
                          </Box>
                        </Zoom>
                      )}
                      {showRankAnimation && rankChange === 0 && room && room.current_question_index > 0 && (
                        <Zoom in timeout={300}>
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              px: 0.75,
                              py: 0.25,
                              borderRadius: 1,
                              background: 'rgba(156, 163, 175, 0.15)',
                            }}
                          >
                            <RemoveIcon sx={{ fontSize: 14, color: '#9ca3af' }} />
                          </Box>
                        </Zoom>
                      )}
                    </Box>
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
              </Grow>
            )
          })}
        </Paper>
      </Fade>

      {/* 予想的中プレイヤー */}
      {answers.filter(a => a.is_correct_prediction).length > 0 && (
        <Fade in timeout={950}>
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

      {/* その他の回答 */}
      {result.answerGroups.filter(group => !group.isMajority).length > 0 && (
        <Fade in={showResults} timeout={1000}>
          <Paper elevation={3} sx={{ p: 3, mb: 3, borderRadius: 3 }}>
            <Typography variant="h6" gutterBottom fontWeight="bold">
              その他の回答
            </Typography>
            {result.answerGroups
              .filter(group => !group.isMajority)
              .map((group, index) => (
                <Slide in={showResults} direction="right" timeout={500 + index * 150} key={index}>
                  <Box
                    sx={(theme) => ({
                      mb: 2,
                      p: 2,
                      borderRadius: 2,
                      background: theme.palette.mode === 'dark'
                        ? 'rgba(102, 126, 234, 0.15)'
                        : 'rgba(102, 126, 234, 0.05)',
                      border: theme.palette.mode === 'dark'
                        ? '1px solid rgba(102, 126, 234, 0.3)'
                        : '1px solid rgba(102, 126, 234, 0.1)',
                    })}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body1" sx={{ fontWeight: 600 }} color="text.primary">
                        {group.answer}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          fontWeight: 600,
                          fontSize: '0.95rem',
                        }}
                      >
                        {group.count}人 ({(animatedPercentages.get(group.answer) ?? 0).toFixed(1)}%)
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={animatedPercentages.get(group.answer) ?? 0}
                      sx={(theme) => ({
                        height: 8,
                        borderRadius: 4,
                        bgcolor: theme.palette.mode === 'dark'
                          ? 'rgba(102, 126, 234, 0.2)'
                          : 'rgba(102, 126, 234, 0.1)',
                        mb: 1.5,
                        transition: 'none',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          background: theme.palette.mode === 'dark'
                            ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                            : 'linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)',
                          transition: 'none',
                        },
                      })}
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
                </Slide>
              ))}
          </Paper>
        </Fade>
      )}

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
                  最終結果を見る
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
