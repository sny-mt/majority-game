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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import ChatBubbleIcon from '@mui/icons-material/ChatBubble'
import CloseIcon from '@mui/icons-material/Close'
import { supabase } from '@/lib/supabase'
import { getOrCreatePlayerId } from '@/lib/utils/player'
import { aggregateAnswers, type AnswerGroup } from '@/lib/utils/aggregation'
import type { Room, Question, Player, Answer } from '@/types/database'

interface QuestionSummary {
  questionId: string
  questionIndex: number
  questionText: string
  choiceA: string
  choiceB: string
  majorityAnswer: string
  totalAnswers: number
  answerGroups: AnswerGroup[]
  answers: Answer[]
}

export default function SummaryPage() {
  const params = useParams()
  const router = useRouter()
  const roomId = params.roomId as string

  const [room, setRoom] = useState<Room | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionSummaries, setQuestionSummaries] = useState<QuestionSummary[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [playerId, setPlayerId] = useState<string>('')
  const [selectedComment, setSelectedComment] = useState<{ playerName: string; comment: string } | null>(null)

  useEffect(() => {
    const initializeSummary = async () => {
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

        // 全質問を取得
        const { data: questionsData, error: questionsError } = await supabase
          .from('questions')
          .select('*')
          .eq('room_id', roomId)
          .order('order_index', { ascending: true })

        if (questionsError) throw questionsError
        setQuestions(questionsData || [])

        // プレイヤー情報を取得（スコア降順、同点の場合は参加日時昇順）
        const { data: playersData, error: playersError } = await supabase
          .from('players')
          .select('*')
          .eq('room_id', roomId)
          .order('score', { ascending: false })
          .order('joined_at', { ascending: true })

        if (playersError) throw playersError
        setPlayers(playersData || [])

        // 各質問の集計結果を取得（並列化でパフォーマンス向上）
        const summaries: QuestionSummary[] = await Promise.all(
          (questionsData || []).map(async (question, index) => {
            const { data: answersData } = await supabase
              .from('answers')
              .select('*')
              .eq('question_id', question.id)

            if (answersData && answersData.length > 0) {
              const answerGroups = aggregateAnswers(
                answersData,
                playersData || [],
                question.choice_a,
                question.choice_b
              )

              const majorityGroup = answerGroups.find(group => group.isMajority)

              return {
                questionId: question.id,
                questionIndex: question.order_index,
                questionText: question.question_text,
                choiceA: question.choice_a,
                choiceB: question.choice_b,
                majorityAnswer: majorityGroup?.answer || '不明',
                totalAnswers: answersData.length,
                answerGroups: answerGroups,
                answers: answersData
              }
            }
            return null
          })
        ).then(results => results.filter((s): s is QuestionSummary => s !== null))

        setQuestionSummaries(summaries)
        setIsLoading(false)
      } catch (error) {
        console.error('Error initializing summary:', error)
        setIsLoading(false)
      }
    }

    initializeSummary()
  }, [roomId])

  // Realtime購読: ルームステータスの変更を監視
  useEffect(() => {
    if (!room) return

    const roomChannel = supabase
      .channel(`room_summary:${roomId}`)
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

          // ステータスが'answering'に変わったら回答ページへ自動遷移
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

  const handlePlayerClick = (playerName: string, playerId: string, answers: Answer[]) => {
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

  if (!room) {
    return (
      <Container maxWidth="md">
        <Box sx={{ mt: 8 }}>
          <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h6" color="error">
              ルームが見つかりません
            </Typography>
          </Paper>
        </Box>
      </Container>
    )
  }

  // 最高得点を取得
  const topScore = players.length > 0 ? players[0].score : 0
  // 最高得点のプレイヤー全員を取得（同率1位対応）
  const winners = players.filter(p => p.score === topScore)
  const isCurrentPlayerWinner = winners.some(w => w.id === playerId)

  return (
    <Container maxWidth="md" sx={{ pb: 4 }}>
      <Box sx={{ mt: 3, mb: 3, textAlign: 'center' }}>
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontWeight: 'bold' }}>
          {room.status === 'finished' ? '🎉 ゲーム終了！' : '📊 これまでの結果'}
        </Typography>
      </Box>

      {/* 優勝者 */}
      {room.status === 'finished' && winners.length > 0 && (
        <Paper
          elevation={6}
          sx={{
            p: 4,
            mb: 3,
            bgcolor: isCurrentPlayerWinner ? 'warning.main' : 'warning.light',
            textAlign: 'center'
          }}
        >
          <EmojiEventsIcon sx={{ fontSize: 80, color: 'warning.dark', mb: 2 }} />
          <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
            {winners.length > 1 ? '同率優勝' : '優勝'}
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2, mb: 2 }}>
            {winners.map((winner, index) => (
              <Box key={winner.id}>
                <Typography variant="h3" sx={{ fontWeight: 'bold' }}>
                  {winner.nickname}
                  {winner.id === playerId && ' 🎊'}
                </Typography>
              </Box>
            ))}
          </Box>
          <Typography variant="h5">
            {topScore}ポイント
          </Typography>
          {isCurrentPlayerWinner && (
            <Typography variant="h6" sx={{ mt: 2, color: 'warning.dark' }}>
              おめでとうございます！
            </Typography>
          )}
        </Paper>
      )}

      {/* 最終順位 */}
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          🏆 {room.status === 'finished' ? '最終順位' : '現在の順位'}
        </Typography>
        {players.map((player, index) => {
          const isCurrentPlayer = player.id === playerId

          // 同点を考慮した順位計算
          let rank = 1
          for (let i = 0; i < index; i++) {
            if (players[i].score > player.score) {
              rank++
            }
          }

          // デバッグ用ログ
          if (index === 0) {
            console.log('=== 順位計算デバッグ ===')
            players.forEach((p, i) => {
              console.log(`${i}: ${p.nickname} - ${p.score}点`)
            })
          }

          const isFirstPlace = rank === 1
          const isSecondPlace = rank === 2
          const isThirdPlace = rank === 3

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
                  : isSecondPlace
                  ? 'grey.300'
                  : isThirdPlace
                  ? '#CD7F32'
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
                    minWidth: '50px',
                    color: isCurrentPlayer ? 'primary.dark' : 'inherit'
                  }}
                >
                  {isFirstPlace && '🥇 '}
                  {isSecondPlace && '🥈 '}
                  {isThirdPlace && '🥉 '}
                  {rank}位
                </Typography>
                <Typography
                  variant="h6"
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
                variant="h5"
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

      {/* 質問別の結果 */}
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          📝 質問別の結果
        </Typography>
        {questionSummaries.map((summary, index) => (
          <Accordion key={index}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', pr: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                  Q{index + 1}: {summary.questionText}
                </Typography>
                <Chip
                  label={`回答: ${summary.totalAnswers}人`}
                  size="small"
                  color="primary"
                />
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Divider sx={{ mb: 2 }} />

              {/* マジョリティ回答 */}
              {summary.answerGroups
                .filter(group => group.isMajority)
                .map((group, groupIndex) => (
                  <Box
                    key={groupIndex}
                    sx={{
                      mb: 2,
                      p: 2,
                      bgcolor: 'success.light',
                      borderRadius: 1
                    }}
                  >
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      マジョリティ回答
                    </Typography>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {group.answer}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {group.count}人 ({group.percentage.toFixed(1)}%)
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {group.players.map((playerName, idx) => {
                        const player = players.find(p => p.nickname === playerName)
                        const answer = player ? summary.answers.find(a => a.player_id === player.id) : null
                        const hasComment = answer && answer.comment

                        return (
                          <Chip
                            key={idx}
                            label={playerName}
                            icon={hasComment ? <ChatBubbleIcon /> : undefined}
                            size="small"
                            onClick={hasComment && player ? () => handlePlayerClick(playerName, player.id, summary.answers) : undefined}
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

              {/* その他の回答 */}
              {summary.answerGroups.filter(group => !group.isMajority).length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ mb: 1, mt: 2, fontWeight: 'bold' }}>
                    その他の回答
                  </Typography>
                  {summary.answerGroups
                    .filter(group => !group.isMajority)
                    .map((group, groupIndex) => (
                      <Box
                        key={groupIndex}
                        sx={{
                          mb: 1,
                          p: 2,
                          bgcolor: 'grey.100',
                          borderRadius: 1
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                            {group.answer}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {group.count}人 ({group.percentage.toFixed(1)}%)
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {group.players.map((playerName, idx) => {
                            const player = players.find(p => p.nickname === playerName)
                            const answer = player ? summary.answers.find(a => a.player_id === player.id) : null
                            const hasComment = answer && answer.comment

                            return (
                              <Chip
                                key={idx}
                                label={playerName}
                                icon={hasComment ? <ChatBubbleIcon /> : undefined}
                                size="small"
                                onClick={hasComment && player ? () => handlePlayerClick(playerName, player.id, summary.answers) : undefined}
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
                </>
              )}

              {/* プレイヤーの回答状況 */}
              <Divider sx={{ my: 2 }} />
              {(() => {
                const myAnswer = summary.answers.find(a => a.player_id === playerId)
                const canAnswer = summary.questionIndex <= (room?.current_question_index ?? 0)

                if (myAnswer) {
                  // 既に回答済み
                  return (
                    <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        ✅ あなたの回答
                      </Typography>
                      <Typography variant="body2">
                        <strong>回答:</strong> {myAnswer.answer}
                      </Typography>
                      <Typography variant="body2">
                        <strong>予想:</strong> {myAnswer.prediction}
                      </Typography>
                      {myAnswer.comment && (
                        <Typography variant="body2">
                          <strong>コメント:</strong> {myAnswer.comment}
                        </Typography>
                      )}
                      {myAnswer.is_correct_prediction && (
                        <Chip
                          label="予想的中！ +10pt"
                          color="success"
                          size="small"
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Box>
                  )
                } else if (canAnswer) {
                  // 未回答だが、既に出題された問題
                  return (
                    <Box sx={{ p: 2, bgcolor: 'info.light', borderRadius: 1 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        この問題にはまだ回答していません
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                        ※ ポイントは加算されませんが、参考記録として回答を残せます
                      </Typography>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => router.push(`/room/${roomId}/answer?question=${summary.questionIndex}`)}
                      >
                        参考記録として回答する
                      </Button>
                    </Box>
                  )
                } else {
                  // まだ出題されていない問題
                  return (
                    <Box sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        まだ出題されていない問題です
                      </Typography>
                    </Box>
                  )
                }
              })()}
            </AccordionDetails>
          </Accordion>
        ))}
      </Paper>

      {/* 戻るボタン */}
      <Box sx={{ display: 'flex', gap: 2 }}>
        {room.status !== 'finished' && (
          <Button
            fullWidth
            variant="outlined"
            size="large"
            onClick={() => router.push(`/room/${roomId}/result`)}
            sx={{ py: 1.5 }}
          >
            最新の結果に戻る
          </Button>
        )}
        <Button
          fullWidth
          variant="contained"
          size="large"
          onClick={() => router.push('/')}
          sx={{ py: 1.5 }}
        >
          ホームに戻る
        </Button>
      </Box>

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
