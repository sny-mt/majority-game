'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Container, Typography, Box, Paper, Button, CircularProgress, Chip, Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material'
import ChatBubbleIcon from '@mui/icons-material/ChatBubble'
import CloseIcon from '@mui/icons-material/Close'
import ResultAnimation from '@/components/ResultAnimation'
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

  useEffect(() => {
    const initializeResult = async () => {
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

        // 全質問数を取得
        const { count } = await supabase
          .from('questions')
          .select('*', { count: 'exact', head: true })
          .eq('room_id', roomId)

        setTotalQuestions(count || 0)

        // 回答を取得
        const { data: answersData, error: answersError } = await supabase
          .from('answers')
          .select('*')
          .eq('question_id', questionData.id)

        if (answersError) throw answersError

        // プレイヤー情報を取得
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomId)

        if (playersError) throw playersError

        // 回答を集計
        const answerGroups = aggregateAnswers(
          answersData,
          playersData,
          questionData.choice_a,
          questionData.choice_b
        )

        // 多数派の回答を取得
        const majorityGroup = answerGroups.find(group => group.isMajority)
        const majorityAnswer = majorityGroup?.answer || ''

        // 予想が当たったプレイヤーを計算してスコアを更新
        let currentPlayerGotItRight = false
        console.log('Majority answer:', majorityAnswer)
        console.log('Current player ID:', pid)

        if (majorityAnswer) {
          // 全ての回答を一括で更新（まだ採点されていない場合のみ）
          const updatePromises = answersData.map(async (answer) => {
            // 既に採点済みの場合はスキップ
            if (answer.is_correct_prediction !== false || answer.points_earned !== 0) {
              console.log(`Answer ${answer.id} already scored, skipping`)
              // ローカルデータは更新
              if (answer.player_id === pid && answer.is_correct_prediction) {
                currentPlayerGotItRight = true
              }
              return
            }

            // 予想と多数派回答を比較（完全一致または選択肢の場合は含まれているかチェック）
            const prediction = answer.prediction || ''
            let isCorrect = false

            // 完全一致の場合
            if (prediction === majorityAnswer) {
              isCorrect = true
            }
            // 選択肢A/Bの場合：多数派回答に (A) や (B) が含まれているかチェック
            else if (prediction === 'A' && majorityAnswer.includes('(A)')) {
              isCorrect = true
            }
            else if (prediction === 'B' && majorityAnswer.includes('(B)')) {
              isCorrect = true
            }
            // 自由記述の場合：多数派回答に含まれているかチェック
            else if (prediction.length > 1 && majorityAnswer.includes(prediction)) {
              isCorrect = true
            }

            const points = isCorrect ? 10 : 0

            console.log(`Player ${answer.player_id}: prediction="${prediction}", majority="${majorityAnswer}", correct=${isCorrect}`)

            // answersテーブルを更新
            await supabase
              .from('answers')
              .update({
                is_correct_prediction: isCorrect,
                points_earned: points
              })
              .eq('id', answer.id)

            // ローカルのanswerデータを更新
            answer.is_correct_prediction = isCorrect
            answer.points_earned = points

            // 現在のプレイヤーが正解したかチェック
            if (answer.player_id === pid && isCorrect) {
              currentPlayerGotItRight = true
              console.log('🎯 Current player got it right!')
            }
          })

          // 全ての更新を待つ
          await Promise.all(updatePromises)

          // プレイヤーのスコアを全回答から再計算（このルームの質問のみ）
          const playerScores = new Map<string, number>()

          // このルームの全質問IDを取得
          const { data: roomQuestionsData } = await supabase
            .from('questions')
            .select('id')
            .eq('room_id', roomId)

          if (roomQuestionsData) {
            const questionIds = roomQuestionsData.map(q => q.id)

            // このルームの質問に対する全プレイヤーの回答を取得してスコアを計算
            const { data: allAnswersData } = await supabase
              .from('answers')
              .select('player_id, points_earned')
              .in('player_id', playersData.map(p => p.id))
              .in('question_id', questionIds)

            if (allAnswersData) {
              // 各プレイヤーの獲得ポイントを合計
              for (const answer of allAnswersData) {
                const currentScore = playerScores.get(answer.player_id) || 0
                playerScores.set(answer.player_id, currentScore + (answer.points_earned || 0))
              }

              // 各プレイヤーのスコアを更新
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

        // 更新されたプレイヤーデータを再取得して確実に最新の状態にする
        const { data: updatedPlayersData } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomId)
          .order('score', { ascending: false })

        if (updatedPlayersData) {
          setPlayers(updatedPlayersData)
        }

        setAnswers(answersData)
        setCurrentPlayerCorrect(currentPlayerGotItRight)
        console.log('Setting currentPlayerCorrect to:', currentPlayerGotItRight)

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

  // 予想的中時のお祝いアニメーション
  useEffect(() => {
    console.log('Confetti check:', { currentPlayerCorrect, isLoading })

    if (currentPlayerCorrect && !isLoading && typeof window !== 'undefined') {
      console.log('🎉 Triggering confetti!')

      // クライアントサイドでのみconfettiをインポート
      import('canvas-confetti').then((confettiModule) => {
        const confetti = confettiModule.default

        // 即座に紙吹雪を発射
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        })

        // 連続で紙吹雪を発射
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

          // 左から
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
          })
          // 右から
          confetti({
            ...defaults,
            particleCount,
            origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
          })
        }, 250)

        // クリーンアップ用にタイマーIDを保存
        return () => clearInterval(interval)
      })
    }
  }, [currentPlayerCorrect, isLoading])

  // Realtime購読
  useEffect(() => {
    if (!room) return

    // ルームステータスの変更を購読
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

          // ステータスが'answering'に戻ったら回答ページへ
          if (updatedRoom.status === 'answering') {
            router.push(`/room/${roomId}/answer`)
          }
        }
      )
      .subscribe()

    return () => {
      roomChannel.unsubscribe()
    }
  }, [room, roomId, router])

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

      console.log('Moving to next question')
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

      console.log('Game finished')
      // TODO: 全問題の結果を表示するページへ遷移
      alert('ゲームを終了しました')
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
        <Box sx={{ mt: 8, textAlign: 'center' }}>
          <CircularProgress />
          <Typography sx={{ mt: 2 }}>集計中...</Typography>
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
    <Container maxWidth="md" sx={{ pb: 4 }}>
      <Box sx={{ mt: 3, mb: 3 }}>
        <Typography variant="body2" color="text.secondary" align="center" gutterBottom>
          質問 {room.current_question_index + 1} / {totalQuestions}
        </Typography>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          集計結果
        </Typography>
        <Typography variant="h6" gutterBottom align="center" color="text.secondary">
          {result.questionText}
        </Typography>
      </Box>

      {/* 予想的中メッセージ */}
      {currentPlayerCorrect && (
        <Paper
          elevation={6}
          sx={{
            p: 3,
            mb: 3,
            bgcolor: 'success.main',
            color: 'white',
            textAlign: 'center',
            '@keyframes pulse': {
              '0%, 100%': {
                transform: 'scale(1)',
              },
              '50%': {
                transform: 'scale(1.05)',
              },
            },
            animation: 'pulse 1s ease-in-out 3'
          }}
        >
          <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
            🎉 おめでとうございます！ 🎉
          </Typography>
          <Typography variant="h6">
            予想的中！ +10ポイント獲得！
          </Typography>
        </Paper>
      )}

      {/* マジョリティ回答 */}
      {result.answerGroups
        .filter(group => group.isMajority)
        .map((group, index) => (
          <Paper
            key={index}
            elevation={4}
            sx={{
              p: 4,
              mb: 3,
              bgcolor: 'success.main',
              color: 'white',
              textAlign: 'center'
            }}
          >
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
              マジョリティ回答
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 'bold', my: 2 }}>
              {group.answer}
            </Typography>
            <Typography variant="h6">
              {group.count}人 ({group.percentage.toFixed(1)}%)
            </Typography>
            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
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
                      fontSize: '1rem',
                      py: 2,
                      cursor: hasComment ? 'pointer' : 'default',
                      '&:hover': hasComment ? {
                        bgcolor: 'rgba(255, 255, 255, 0.3)'
                      } : {}
                    }}
                  />
                )
              })}
            </Box>
          </Paper>
        ))}

      {/* その他の回答 */}
      {result.answerGroups.filter(group => !group.isMajority).length > 0 && (
        <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
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
                  bgcolor: 'grey.100',
                  borderRadius: 1
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                    {group.answer}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {group.count}人 ({group.percentage.toFixed(1)}%)
                  </Typography>
                </Box>
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
                          '&:hover': hasComment ? {
                            bgcolor: 'action.hover'
                          } : {}
                        }}
                      />
                    )
                  })}
                </Box>
              </Box>
            ))}
        </Paper>
      )}

      {/* 予想的中プレイヤー */}
      {answers.filter(a => a.is_correct_prediction).length > 0 && (
        <Paper elevation={3} sx={{ p: 3, mb: 3, bgcolor: 'info.light' }}>
          <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
            🎯 予想的中！（+10pt）
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {answers
              .filter(a => a.is_correct_prediction)
              .map(answer => {
                const player = players.find(p => p.id === answer.player_id)
                return player ? (
                  <Chip
                    key={answer.id}
                    label={player.nickname}
                    color="success"
                    sx={{ fontWeight: 'bold' }}
                  />
                ) : null
              })}
          </Box>
        </Paper>
      )}

      {/* リーダーボード */}
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ fontWeight: 'bold' }}>
          🏆 現在の順位
        </Typography>
        {players.map((player, index) => {
          const isCurrentPlayer = player.id === playerId
          const isFirstPlace = index === 0

          return (
            <Box
              key={player.id}
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                p: 2,
                mb: 1,
                bgcolor: isCurrentPlayer
                  ? 'primary.light'
                  : isFirstPlace
                  ? 'warning.light'
                  : 'grey.100',
                borderRadius: 1,
                border: 2,
                borderColor: isCurrentPlayer
                  ? 'primary.main'
                  : isFirstPlace
                  ? 'warning.main'
                  : 'transparent',
                boxShadow: isCurrentPlayer ? 3 : 0
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 'bold',
                    minWidth: '30px',
                    color: isCurrentPlayer ? 'primary.dark' : 'inherit'
                  }}
                >
                  {index + 1}位
                </Typography>
                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: isCurrentPlayer || isFirstPlace ? 'bold' : 'normal',
                    color: isCurrentPlayer ? 'primary.dark' : 'inherit'
                  }}
                >
                  {player.nickname}
                  {isCurrentPlayer && ' (あなた)'}
                </Typography>
              </Box>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 'bold',
                  color: isCurrentPlayer ? 'primary.dark' : 'primary.main'
                }}
              >
                {player.score}pt
              </Typography>
            </Box>
          )
        })}
      </Paper>

      {/* 主催者用コントロール */}
      {isHost && (
        <Paper elevation={3} sx={{ p: 3, bgcolor: 'warning.light' }}>
          <Typography variant="subtitle1" gutterBottom fontWeight="bold">
            主催者コントロール
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            {!isLastQuestion ? (
              <Button
                fullWidth
                variant="contained"
                color="primary"
                size="large"
                onClick={handleNextQuestion}
                sx={{ py: 1.5 }}
              >
                次の質問へ進む
              </Button>
            ) : (
              <Button
                fullWidth
                variant="contained"
                color="success"
                size="large"
                onClick={handleFinishGame}
                sx={{ py: 1.5 }}
              >
                ゲームを終了する
              </Button>
            )}
          </Box>
        </Paper>
      )}

      {/* コメントモーダル */}
      <Dialog
        open={!!selectedComment}
        onClose={handleCloseComment}
        maxWidth="sm"
        fullWidth
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
              bgcolor: 'grey.100',
              borderRadius: 2,
              position: 'relative',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: -10,
                left: 20,
                width: 0,
                height: 0,
                borderLeft: '10px solid transparent',
                borderRight: '10px solid transparent',
                borderBottom: '10px solid',
                borderBottomColor: 'grey.100'
              }
            }}
          >
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {selectedComment?.comment}
            </Typography>
          </Paper>
        </DialogContent>
      </Dialog>
    </Container>
  )
}
