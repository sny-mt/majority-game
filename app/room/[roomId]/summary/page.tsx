'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  CircularProgress,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Snackbar,
  Alert,
  Collapse
} from '@mui/material'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import ChatBubbleIcon from '@mui/icons-material/ChatBubble'
import CloseIcon from '@mui/icons-material/Close'
import FavoriteIcon from '@mui/icons-material/Favorite'
import PeopleIcon from '@mui/icons-material/People'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import CheckIcon from '@mui/icons-material/Check'
import ClearIcon from '@mui/icons-material/Clear'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import LocationOnIcon from '@mui/icons-material/LocationOn'
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

interface SimilarPlayer {
  playerId: string
  nickname: string
  matchCount: number
  totalQuestions: number
  matchPercentage: number
  matchedQuestions: string[]
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
  const [similarPlayers, setSimilarPlayers] = useState<SimilarPlayer[]>([])
  const [comparePlayer, setComparePlayer] = useState<SimilarPlayer | null>(null)
  const [selectedQuestion, setSelectedQuestion] = useState<QuestionSummary | null>(null)
  const [showTransitionSnackbar, setShowTransitionSnackbar] = useState(false)
  const [countdown, setCountdown] = useState(3)
  const [showAllRankings, setShowAllRankings] = useState(false)

  // ========== 開発用ダミーデータ（本番では削除） ==========
  const DEV_MODE = false // falseにすると無効化
  const generateDummyPlayers = (count: number, realPlayers: typeof players): typeof players => {
    if (!DEV_MODE || realPlayers.length >= count) return realPlayers
    const dummyNames = [
      'たろう', 'はなこ', 'ゆうき', 'さくら', 'けんた', 'みさき', 'りょう', 'あおい',
      'そうた', 'ひなた', 'ゆうと', 'めい', 'はると', 'りん', 'そら', 'こはる',
      'ゆい', 'あかり', 'れん', 'みお', 'かいと', 'ゆな', 'りく', 'ほのか',
      'たくみ', 'さき', 'しょう', 'ここあ', 'だいき', 'ひまり', 'ゆうま', 'あんな'
    ]
    const dummies: typeof players = []
    for (let i = realPlayers.length; i < count; i++) {
      dummies.push({
        id: `dummy-${i}`,
        room_id: roomId,
        nickname: dummyNames[i] || `テスト${i + 1}`,
        is_host: false,
        score: Math.floor(Math.random() * 100), // ランダムスコア
        joined_at: new Date().toISOString()
      })
    }
    // スコア順にソート
    return [...realPlayers, ...dummies].sort((a, b) => b.score - a.score)
  }
  // ========== ダミーデータここまで ==========

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

        // 全質問の回答を1回のクエリで取得（N+1問題解消）
        const questionIds = (questionsData || []).map(q => q.id)
        const { data: allAnswersData, error: answersError } = await supabase
          .from('answers')
          .select('*')
          .in('question_id', questionIds)

        if (answersError) throw answersError

        // 質問IDごとに回答をグループ化
        const answersMap = new Map<string, Answer[]>()
        ;(allAnswersData || []).forEach(answer => {
          const answers = answersMap.get(answer.question_id) || []
          answers.push(answer)
          answersMap.set(answer.question_id, answers)
        })

        // 各質問の集計結果を作成
        const summaries: QuestionSummary[] = (questionsData || [])
          .map(question => {
            const answersData = answersMap.get(question.id) || []

            if (answersData.length > 0) {
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
          .filter((s): s is QuestionSummary => s !== null)

        setQuestionSummaries(summaries)

        // 回答が近かった人を計算
        const calculateSimilarPlayers = () => {
          const otherPlayers = (playersData || []).filter(p => p.id !== pid)
          const myAnswersMap = new Map<string, string>()

          // 自分の回答をマップに格納
          summaries.forEach(summary => {
            const myAnswer = summary.answers.find(a => a.player_id === pid)
            if (myAnswer) {
              myAnswersMap.set(summary.questionId, myAnswer.answer)
            }
          })

          // 各プレイヤーとの一致度を計算
          const similarityResults: SimilarPlayer[] = otherPlayers.map(player => {
            const matchedQuestions: string[] = []
            let matchCount = 0

            summaries.forEach(summary => {
              const myAnswer = myAnswersMap.get(summary.questionId)
              const playerAnswer = summary.answers.find(a => a.player_id === player.id)

              if (myAnswer && playerAnswer && myAnswer === playerAnswer.answer) {
                matchCount++
                matchedQuestions.push(summary.questionText)
              }
            })

            const totalQuestions = summaries.filter(s =>
              myAnswersMap.has(s.questionId) && s.answers.some(a => a.player_id === player.id)
            ).length

            return {
              playerId: player.id,
              nickname: player.nickname,
              matchCount,
              totalQuestions,
              matchPercentage: totalQuestions > 0 ? (matchCount / totalQuestions) * 100 : 0,
              matchedQuestions
            }
          })

          // 一致数が多い順にソート（1件以上一致のみ）
          return similarityResults
            .filter(p => p.matchCount > 0)
            .sort((a, b) => b.matchCount - a.matchCount || b.matchPercentage - a.matchPercentage)
        }

        setSimilarPlayers(calculateSimilarPlayers())
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

          // ステータスが'answering'に変わったらカウントダウン開始
          if (updatedRoom.status === 'answering') {
            setShowTransitionSnackbar(true)
            setCountdown(3)
          }
        }
      )
      .subscribe()

    return () => {
      roomChannel.unsubscribe()
    }
  }, [room, roomId, router])

  // カウントダウン処理
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

  const handlePlayerClick = (playerName: string, playerId: string, answers: Answer[]) => {
    const answer = answers.find(a => a.player_id === playerId)
    if (answer && answer.comment) {
      setSelectedComment({ playerName, comment: answer.comment })
    }
  }

  const handleCloseComment = () => {
    setSelectedComment(null)
  }

  const handleCompareClick = (similar: SimilarPlayer) => {
    setComparePlayer(similar)
  }

  const handleCloseCompare = () => {
    setComparePlayer(null)
  }

  // 回答を表示用にフォーマット（A/Bの場合は選択肢名を表示）
  const formatAnswer = useCallback((answer: string | undefined, choiceA: string, choiceB: string) => {
    if (!answer) return '未回答'
    if (answer === 'A') return `A: ${choiceA}`
    if (answer === 'B') return `B: ${choiceB}`
    return answer
  }, [])

  // 比較用のデータをメモ化（comparePlayer変更時のみ再計算）
  const comparisonData = useMemo(() => {
    if (!comparePlayer) return []

    return questionSummaries.map(summary => {
      const myAnswer = summary.answers.find(a => a.player_id === playerId)
      const theirAnswer = summary.answers.find(a => a.player_id === comparePlayer.playerId)
      const isMatch = myAnswer && theirAnswer && myAnswer.answer === theirAnswer.answer

      return {
        questionText: summary.questionText,
        questionIndex: summary.questionIndex,
        myAnswer: formatAnswer(myAnswer?.answer, summary.choiceA, summary.choiceB),
        theirAnswer: formatAnswer(theirAnswer?.answer, summary.choiceA, summary.choiceB),
        myComment: myAnswer?.comment || null,
        theirComment: theirAnswer?.comment || null,
        isMatch
      }
    })
  }, [comparePlayer, questionSummaries, playerId, formatAnswer])

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

        {(() => {
          // ダミーデータを含めた表示用プレイヤーリスト
          const displayPlayers = generateDummyPlayers(25, players)

          // 順位計算を事前に行う
          const playersWithRank = displayPlayers.map((player, index) => {
            let rank = 1
            for (let i = 0; i < index; i++) {
              if (displayPlayers[i].score > player.score) {
                rank++
              }
            }
            return { ...player, rank, index }
          })

          // 自分の順位を見つける
          const myRanking = playersWithRank.find(p => p.id === playerId)
          const myRank = myRanking?.rank || 0

          // トップ3を取得（同率を含む）
          const top3 = playersWithRank.filter(p => p.rank <= 3)

          // 自分がトップ3外の場合、自分を別途表示
          const showMyRankSeparately = myRank > 3 && myRanking

          // 残りのプレイヤー（トップ3と自分を除く）
          const remainingPlayers = playersWithRank.filter(p =>
            p.rank > 3 && p.id !== playerId
          )

          const renderPlayerRow = (player: typeof playersWithRank[0], isHighlighted = false) => {
            const isCurrentPlayer = player.id === playerId
            const isFirstPlace = player.rank === 1
            const isSecondPlace = player.rank === 2
            const isThirdPlace = player.rank === 3

            return (
              <Box
                key={player.id}
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 1.5,
                  mb: 0.5,
                  bgcolor: isCurrentPlayer
                    ? 'primary.light'
                    : isFirstPlace
                    ? 'rgba(251, 191, 36, 0.2)'
                    : isSecondPlace
                    ? 'rgba(156, 163, 175, 0.2)'
                    : isThirdPlace
                    ? 'rgba(180, 83, 9, 0.15)'
                    : 'rgba(0, 0, 0, 0.02)',
                  borderRadius: 2,
                  border: isCurrentPlayer ? '2px solid' : '1px solid',
                  borderColor: isCurrentPlayer
                    ? 'primary.main'
                    : isFirstPlace
                    ? 'rgba(251, 191, 36, 0.5)'
                    : 'rgba(0, 0, 0, 0.05)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: 'bold',
                      minWidth: '45px',
                      fontSize: isFirstPlace || isSecondPlace || isThirdPlace ? '1rem' : '0.9rem',
                    }}
                  >
                    {isFirstPlace && '🥇'}
                    {isSecondPlace && '🥈'}
                    {isThirdPlace && '🥉'}
                    {!isFirstPlace && !isSecondPlace && !isThirdPlace && `${player.rank}位`}
                  </Typography>
                  <Typography
                    variant="body1"
                    sx={{
                      fontWeight: isCurrentPlayer || isFirstPlace ? 700 : 400,
                      fontSize: isFirstPlace ? '1rem' : '0.9rem',
                    }}
                  >
                    {player.nickname}
                    {isCurrentPlayer && ' (あなた)'}
                  </Typography>
                </Box>
                <Typography
                  variant="body1"
                  sx={{
                    fontWeight: 700,
                    color: isCurrentPlayer ? 'primary.dark' : 'primary.main',
                    fontSize: isFirstPlace ? '1.1rem' : '0.95rem',
                  }}
                >
                  {player.score}pt
                </Typography>
              </Box>
            )
          }

          return (
            <>
              {/* トップ3 */}
              {top3.map(player => renderPlayerRow(player))}

              {/* 自分の順位（トップ3外の場合） */}
              {showMyRankSeparately && (
                <>
                  <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    my: 1.5,
                    px: 1,
                  }}>
                    <LocationOnIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                    <Typography variant="body2" color="text.secondary">
                      あなたの順位
                    </Typography>
                    <Divider sx={{ flex: 1 }} />
                  </Box>
                  {renderPlayerRow(myRanking, true)}
                </>
              )}

              {/* 残りのプレイヤー（折りたたみ） */}
              {remainingPlayers.length > 0 && (
                <>
                  <Collapse in={showAllRankings}>
                    <Divider sx={{ my: 1.5 }} />
                    {remainingPlayers.map(player => renderPlayerRow(player))}
                  </Collapse>
                  <Button
                    fullWidth
                    variant="text"
                    size="small"
                    onClick={() => setShowAllRankings(!showAllRankings)}
                    startIcon={showAllRankings ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    sx={{ mt: 1, color: 'text.secondary' }}
                  >
                    {showAllRankings
                      ? '折りたたむ'
                      : `他${remainingPlayers.length}人の順位を表示`}
                  </Button>
                </>
              )}
            </>
          )
        })()}
      </Paper>

      {/* 回答が近かった人（2人以上参加の場合のみ表示） */}
      {players.length >= 2 && (
        <Paper
          elevation={3}
          sx={{
            p: 3,
            mb: 3,
            background: 'linear-gradient(135deg, rgba(244, 114, 182, 0.1) 0%, rgba(251, 113, 133, 0.1) 100%)',
            border: '1px solid rgba(244, 114, 182, 0.2)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <FavoriteIcon sx={{ color: '#ec4899' }} />
            <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
              あなたと回答が近かった人
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            同じ回答をした回数が多い人ほど、価値観が近いかも？
          </Typography>
          {similarPlayers.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              残念！全員と回答が異なりました
            </Typography>
          )}
          {similarPlayers.slice(0, 5).map((similar, index) => {
            // 同率1位もベストマッチにする（最高一致数と同じ人はベストマッチ）
            const topMatchCount = similarPlayers.length > 0 ? similarPlayers[0].matchCount : 0
            const isTopMatch = similar.matchCount === topMatchCount
            return (
              <Box
                key={similar.playerId}
                onClick={() => handleCompareClick(similar)}
                sx={(theme) => ({
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 2,
                  mb: 1,
                  borderRadius: 2,
                  cursor: 'pointer',
                  background: isTopMatch
                    ? 'linear-gradient(135deg, rgba(244, 114, 182, 0.2) 0%, rgba(251, 113, 133, 0.2) 100%)'
                    : theme.palette.mode === 'dark'
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(255, 255, 255, 0.5)',
                  border: isTopMatch
                    ? '2px solid rgba(244, 114, 182, 0.4)'
                    : theme.palette.mode === 'dark'
                    ? '1px solid rgba(255, 255, 255, 0.1)'
                    : '1px solid rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.2s',
                  '&:hover': {
                    transform: 'translateX(4px)',
                    boxShadow: '0 4px 12px rgba(244, 114, 182, 0.2)',
                  },
                })}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      background: isTopMatch
                        ? 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)'
                        : 'rgba(244, 114, 182, 0.2)',
                      color: isTopMatch ? 'white' : '#ec4899',
                    }}
                  >
                    {isTopMatch ? <FavoriteIcon /> : <PeopleIcon fontSize="small" />}
                  </Box>
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant="body1"
                        component="span"
                        sx={{
                          fontWeight: isTopMatch ? 700 : 500,
                        }}
                      >
                        {similar.nickname}
                      </Typography>
                      {isTopMatch && (
                        <Chip
                          label="ベストマッチ"
                          size="small"
                          sx={{
                            background: 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)',
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '0.7rem',
                          }}
                        />
                      )}
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {similar.matchedQuestions.slice(0, 2).map((q, i) => (
                        <span key={i}>Q{questionSummaries.findIndex(s => s.questionText === q) + 1}{i < Math.min(similar.matchedQuestions.length, 2) - 1 ? ', ' : ''}</span>
                      ))}
                      {similar.matchedQuestions.length > 2 && ` 他${similar.matchedQuestions.length - 2}問`}
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ textAlign: 'right' }}>
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 700,
                      color: '#ec4899',
                    }}
                  >
                    {similar.matchCount}/{similar.totalQuestions}問一致
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {similar.matchPercentage.toFixed(0)}%
                  </Typography>
                </Box>
              </Box>
            )
          })}
        </Paper>
      )}

      {/* 質問別の結果 */}
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 2 }}>
          📝 質問別の結果
        </Typography>
        <List sx={{ py: 0 }}>
          {questionSummaries.map((summary, index) => {
            const majorityGroups = summary.answerGroups.filter(g => g.isMajority)
            const minorityGroups = summary.answerGroups.filter(g => !g.isMajority)
            const myAnswer = summary.answers.find(a => a.player_id === playerId)

            return (
              <ListItem
                key={index}
                disablePadding
                sx={{
                  mb: 1.5,
                  borderRadius: 2,
                  overflow: 'hidden',
                  border: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <ListItemButton
                  onClick={() => setSelectedQuestion(summary)}
                  sx={{
                    py: 1.5,
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    '&:hover': {
                      background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.08) 100%)',
                    },
                  }}
                >
                  {/* ヘッダー部分 */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                      <Chip
                        label={`Q${index + 1}`}
                        size="small"
                        sx={{
                          fontWeight: 700,
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          minWidth: 40,
                        }}
                      />
                      <Typography variant="body1" sx={{ fontWeight: 600 }}>
                        {summary.questionText}
                      </Typography>
                    </Box>
                    <ChevronRightIcon sx={{ color: 'text.secondary', ml: 1 }} />
                  </Box>

                  {/* 回答サマリー */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, pl: 0.5 }}>
                    {/* あなたの回答 */}
                    <Box>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                        あなた
                      </Typography>
                      {myAnswer ? (
                        <Chip
                          label={
                            myAnswer.answer === 'A' ? `${summary.choiceA}（A）` :
                            myAnswer.answer === 'B' ? `${summary.choiceB}（B）` :
                            myAnswer.answer
                          }
                          size="small"
                          sx={{
                            height: 'auto',
                            py: 0.25,
                            fontSize: '0.75rem',
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(37, 99, 235, 0.15) 100%)',
                            color: '#2563eb',
                            fontWeight: 600,
                            '& .MuiChip-label': {
                              whiteSpace: 'normal',
                            },
                          }}
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          未回答
                        </Typography>
                      )}
                    </Box>

                    {/* 多数派・その他を横並びに */}
                    <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                      {/* 多数派 */}
                      <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                          多数派
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {majorityGroups.length > 0 ? (
                            majorityGroups.map((group, idx) => (
                              <Chip
                                key={idx}
                                label={
                                  group.answer === 'A' ? `${summary.choiceA}（A） ${group.count}人` :
                                  group.answer === 'B' ? `${summary.choiceB}（B） ${group.count}人` :
                                  `${group.answer} ${group.count}人`
                                }
                                size="small"
                                sx={{
                                  height: 'auto',
                                  py: 0.25,
                                  fontSize: '0.75rem',
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  color: '#059669',
                                  fontWeight: 600,
                                  '& .MuiChip-label': {
                                    whiteSpace: 'normal',
                                  },
                                }}
                              />
                            ))
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              -
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      {/* その他 */}
                      {minorityGroups.length > 0 && (
                        <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>
                          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.5 }}>
                            その他
                          </Typography>
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {minorityGroups.map((group, idx) => (
                              <Chip
                                key={idx}
                                label={
                                  group.answer === 'A' ? `${summary.choiceA}（A） ${group.count}人` :
                                  group.answer === 'B' ? `${summary.choiceB}（B） ${group.count}人` :
                                  `${group.answer} ${group.count}人`
                                }
                                size="small"
                                sx={{
                                  height: 'auto',
                                  py: 0.25,
                                  fontSize: '0.75rem',
                                  background: 'rgba(107, 114, 128, 0.1)',
                                  color: '#6b7280',
                                  fontWeight: 500,
                                  '& .MuiChip-label': {
                                    whiteSpace: 'normal',
                                  },
                                }}
                              />
                            ))}
                          </Box>
                        </Box>
                      )}
                    </Box>
                  </Box>
                </ListItemButton>
              </ListItem>
            )
          })}
        </List>
      </Paper>

      {/* 質問詳細ボトムシート */}
      <Drawer
        anchor="bottom"
        open={!!selectedQuestion}
        onClose={() => setSelectedQuestion(null)}
        PaperProps={{
          sx: {
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '85vh',
          }
        }}
      >
        {selectedQuestion && (
          <>
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
            <Box sx={{ px: 2, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Box sx={{ flex: 1, pr: 2 }}>
                <Chip
                  label={`Q${questionSummaries.findIndex(q => q.questionId === selectedQuestion.questionId) + 1}`}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    mb: 1,
                  }}
                />
                <Typography variant="h6" fontWeight="bold">
                  {selectedQuestion.questionText}
                </Typography>
              </Box>
              <IconButton onClick={() => setSelectedQuestion(null)} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
            <Divider />
            <Box sx={{ px: 2, py: 2, overflow: 'auto' }}>
              {/* マジョリティ回答 */}
              {selectedQuestion.answerGroups
                .filter(group => group.isMajority)
                .map((group, groupIndex) => (
                  <Box
                    key={groupIndex}
                    sx={{
                      mb: 2,
                      p: 2,
                      background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(52, 211, 153, 0.15) 100%)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: 2
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
                        const answer = player ? selectedQuestion.answers.find(a => a.player_id === player.id) : null
                        const hasComment = answer && answer.comment

                        return (
                          <Chip
                            key={idx}
                            label={playerName}
                            icon={hasComment ? <ChatBubbleIcon /> : undefined}
                            size="small"
                            onClick={hasComment && player ? () => handlePlayerClick(playerName, player.id, selectedQuestion.answers) : undefined}
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
              {selectedQuestion.answerGroups.filter(group => !group.isMajority).length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ mb: 1, mt: 2, fontWeight: 'bold' }}>
                    その他の回答
                  </Typography>
                  {selectedQuestion.answerGroups
                    .filter(group => !group.isMajority)
                    .map((group, groupIndex) => (
                      <Box
                        key={groupIndex}
                        sx={(theme) => ({
                          mb: 1,
                          p: 2,
                          bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'grey.100',
                          borderRadius: 2
                        })}
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
                            const answer = player ? selectedQuestion.answers.find(a => a.player_id === player.id) : null
                            const hasComment = answer && answer.comment

                            return (
                              <Chip
                                key={idx}
                                label={playerName}
                                icon={hasComment ? <ChatBubbleIcon /> : undefined}
                                size="small"
                                onClick={hasComment && player ? () => handlePlayerClick(playerName, player.id, selectedQuestion.answers) : undefined}
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
                const myAnswer = selectedQuestion.answers.find(a => a.player_id === playerId)
                const canAnswer = selectedQuestion.questionIndex <= (room?.current_question_index ?? 0)

                if (myAnswer) {
                  const formatAnswerDisplay = (answer: string) => {
                    if (answer === 'A') return `${selectedQuestion.choiceA}（A）`
                    if (answer === 'B') return `${selectedQuestion.choiceB}（B）`
                    return answer
                  }
                  return (
                    <Box sx={{ p: 2, background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)', borderRadius: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        ✅ あなたの回答
                      </Typography>
                      <Typography variant="body2">
                        <strong>回答:</strong> {formatAnswerDisplay(myAnswer.answer)}
                      </Typography>
                      <Typography variant="body2">
                        <strong>予想:</strong> {myAnswer.prediction ? formatAnswerDisplay(myAnswer.prediction) : '-'}
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
                  return (
                    <Box sx={{ p: 2, background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.1) 100%)', borderRadius: 2 }}>
                      <Typography variant="body2" sx={{ mb: 1 }}>
                        この問題にはまだ回答していません
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
                        ※ ポイントは加算されませんが、参考記録として回答を残せます
                      </Typography>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => {
                          setSelectedQuestion(null)
                          router.push(`/room/${roomId}/answer?question=${selectedQuestion.questionIndex}`)
                        }}
                      >
                        参考記録として回答する
                      </Button>
                    </Box>
                  )
                } else {
                  return (
                    <Box sx={(theme) => ({ p: 2, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'grey.100', borderRadius: 2 })}>
                      <Typography variant="body2" color="text.secondary">
                        まだ出題されていない問題です
                      </Typography>
                    </Box>
                  )
                }
              })()}
            </Box>
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              <Button
                fullWidth
                variant="contained"
                onClick={() => setSelectedQuestion(null)}
              >
                閉じる
              </Button>
            </Box>
          </>
        )}
      </Drawer>

      {/* 戻るボタン */}
      <Box sx={{ display: 'flex', gap: 2 }}>
        {room.status !== 'finished' && (
          <Button
            fullWidth
            variant="outlined"
            size="large"
            onClick={() => {
              // 主催者が結果表示する前（answering状態）は回答ページへ
              if (room.status === 'answering') {
                router.push(`/room/${roomId}/answer`)
              } else {
                router.push(`/room/${roomId}/result`)
              }
            }}
            sx={{ py: 1.5 }}
          >
            {room.status === 'answering' ? '回答ページに戻る' : '最新の結果に戻る'}
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

      {/* 回答比較モーダル */}
      <Dialog
        open={!!comparePlayer}
        onClose={handleCloseCompare}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
          }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CompareArrowsIcon sx={{ color: '#ec4899' }} />
              <Typography variant="h6">
                {comparePlayer?.nickname}との回答比較
              </Typography>
            </Box>
            <IconButton onClick={handleCloseCompare} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, p: 2, borderRadius: 2, background: 'linear-gradient(135deg, rgba(244, 114, 182, 0.1) 0%, rgba(251, 113, 133, 0.1) 100%)' }}>
            <Typography variant="body1" sx={{ fontWeight: 600, color: '#ec4899', textAlign: 'center' }}>
              {comparePlayer?.matchCount}/{comparePlayer?.totalQuestions}問一致 ({comparePlayer?.matchPercentage.toFixed(0)}%)
            </Typography>
          </Box>

          {comparisonData.map((item, index) => (
            <Box
              key={index}
              sx={{
                mb: 2,
                p: 2,
                borderRadius: 2,
                background: item.isMatch
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(52, 211, 153, 0.1) 100%)'
                  : 'rgba(0, 0, 0, 0.02)',
                border: item.isMatch
                  ? '1px solid rgba(16, 185, 129, 0.3)'
                  : '1px solid rgba(0, 0, 0, 0.05)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                {item.isMatch ? (
                  <CheckIcon sx={{ color: '#10b981', fontSize: 20 }} />
                ) : (
                  <ClearIcon sx={{ color: '#94a3b8', fontSize: 20 }} />
                )}
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Q{item.questionIndex + 1}: {item.questionText}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    あなた
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      p: 1,
                      borderRadius: 1,
                      background: 'rgba(102, 126, 234, 0.1)',
                    }}
                  >
                    {item.myAnswer}
                  </Typography>
                  {item.myComment && (
                    <Box
                      sx={{
                        mt: 1,
                        p: 1,
                        borderRadius: 1,
                        background: 'rgba(102, 126, 234, 0.05)',
                        borderLeft: '3px solid rgba(102, 126, 234, 0.5)',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <ChatBubbleIcon sx={{ fontSize: 12 }} />
                        コメント
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
                        {item.myComment}
                      </Typography>
                    </Box>
                  )}
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    {comparePlayer?.nickname}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: 500,
                      p: 1,
                      borderRadius: 1,
                      background: 'rgba(244, 114, 182, 0.1)',
                    }}
                  >
                    {item.theirAnswer}
                  </Typography>
                  {item.theirComment && (
                    <Box
                      sx={{
                        mt: 1,
                        p: 1,
                        borderRadius: 1,
                        background: 'rgba(244, 114, 182, 0.05)',
                        borderLeft: '3px solid rgba(244, 114, 182, 0.5)',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                        <ChatBubbleIcon sx={{ fontSize: 12 }} />
                        コメント
                      </Typography>
                      <Typography variant="body2" sx={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
                        {item.theirComment}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          ))}
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
