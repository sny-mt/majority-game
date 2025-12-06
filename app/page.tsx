'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Container,
  TextField,
  Button,
  Typography,
  Box,
  Paper,
  IconButton,
  Divider,
  CircularProgress,
  Card,
  CardContent,
  Fade,
  Grow,
  Slide,
  Skeleton
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import HistoryIcon from '@mui/icons-material/History'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome'
import GroupsIcon from '@mui/icons-material/Groups'
import QrCodeIcon from '@mui/icons-material/QrCode'
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents'
import PersonIcon from '@mui/icons-material/Person'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '@/lib/supabase'
import { getOrCreatePlayerId, generateRoomPlayerId } from '@/lib/utils/player'
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

interface JoinedRoom {
  id: string
  room_name: string
  created_at: string
  myNickname: string
  myScore: number
  myRank: number
  playerCount: number
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
  const [copied, setCopied] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [joinedRooms, setJoinedRooms] = useState<JoinedRoom[]>([])
  const [isLoadingJoinedRooms, setIsLoadingJoinedRooms] = useState(true)

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

          // waiting以外のルーム（進行中またはfinished）を表示
          if (roomData && roomData.status !== 'waiting') {
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

    const loadJoinedRooms = async () => {
      try {
        const playerId = getOrCreatePlayerId()
        if (!playerId) {
          setIsLoadingJoinedRooms(false)
          return
        }

        // 自分が参加したルーム情報を取得
        const { data: myPlayerData, error: playerError } = await supabase
          .from('players')
          .select('room_id, nickname, score')
          .eq('id', playerId)

        if (playerError) throw playerError

        if (!myPlayerData || myPlayerData.length === 0) {
          setIsLoadingJoinedRooms(false)
          return
        }

        // 参加したルームIDのリスト
        const myRoomIds = myPlayerData.map(p => p.room_id)
        const myRoomDataMap = new Map(myPlayerData.map(p => [p.room_id, { nickname: p.nickname, score: p.score }]))

        // 終了したルームのみ取得
        const { data: roomsData, error: roomsError } = await supabase
          .from('rooms')
          .select('*')
          .in('id', myRoomIds)
          .eq('status', 'finished')
          .order('created_at', { ascending: false })
          .limit(5)

        if (roomsError) throw roomsError

        if (!roomsData || roomsData.length === 0) {
          setIsLoadingJoinedRooms(false)
          return
        }

        // 各ルームの詳細を取得
        const roomsWithDetails = await Promise.all(
          roomsData.map(async (room) => {
            // 全プレイヤーを取得して順位計算
            const { data: allPlayers } = await supabase
              .from('players')
              .select('id, nickname, score')
              .eq('room_id', room.id)
              .order('score', { ascending: false })

            const myData = myRoomDataMap.get(room.id)

            // 自分の順位を計算
            let myRank = 0
            if (allPlayers && myData) {
              for (let i = 0; i < allPlayers.length; i++) {
                if (allPlayers[i].score === myData.score) {
                  myRank = i + 1
                  break
                }
              }
            }

            return {
              id: room.id,
              room_name: room.room_name,
              created_at: room.created_at,
              myNickname: myData?.nickname || '',
              myScore: myData?.score || 0,
              myRank,
              playerCount: allPlayers?.length || 0,
            }
          })
        )

        setJoinedRooms(roomsWithDetails)
        setIsLoadingJoinedRooms(false)
      } catch (err) {
        console.error('Error loading joined rooms:', err)
        setIsLoadingJoinedRooms(false)
      }
    }

    loadPastRooms()
    loadJoinedRooms()
  }, [])

  // QRコードをデータURLに変換（img要素で表示するため）
  useEffect(() => {
    if (!roomUrl) return

    // QRCodeCanvasが生成するcanvasを取得してデータURLに変換
    const timer = setTimeout(() => {
      const canvas = document.querySelector('#qr-canvas-home canvas') as HTMLCanvasElement
      if (canvas) {
        setQrDataUrl(canvas.toDataURL('image/png'))
      }
    }, 100)

    return () => clearTimeout(timer)
  }, [roomUrl])

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
      }
    } catch (err) {
      console.error('Error loading room questions:', err)
    }
  }

  const handleCreateRoom = async () => {
    setIsCreating(true)
    setError('')

    try {
      // デバイスIDを取得または生成（ルームの所有者識別用）
      const deviceId = getOrCreatePlayerId()

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
    } else if (activeRoom.status === 'finished') {
      router.push(`/room/${activeRoom.id}/summary`)
    }
  }

  const handleCopyUrl = async () => {
    try {
      // navigator.clipboard はHTTPS環境でのみ動作
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(roomUrl)
      } else {
        // フォールバック: 一時的なtextareaを使用
        const textArea = document.createElement('textarea')
        textArea.value = roomUrl
        textArea.style.position = 'fixed'
        textArea.style.left = '-999999px'
        textArea.style.top = '-999999px'
        document.body.appendChild(textArea)
        textArea.focus()
        textArea.select()
        document.execCommand('copy')
        textArea.remove()
      }
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
      // コピー失敗時はURLを選択状態にする
      alert('URLをコピーできませんでした。手動でコピーしてください。')
    }
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'auto',
        background: (theme) => theme.palette.mode === 'dark'
          ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)'
          : 'linear-gradient(135deg, #f5f7fa 0%, #e4e8f0 50%, #d1d8e5 100%)',
      }}
    >
      {/* Blob アニメーション背景 */}
      <Box
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      >
        {/* Blob 1 - 紫 */}
        <Box
          sx={{
            position: 'absolute',
            top: '-20%',
            left: '-10%',
            width: '50vmax',
            height: '50vmax',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.4) 0%, rgba(118, 75, 162, 0.4) 100%)',
            filter: 'blur(60px)',
            animation: 'blob1 20s ease-in-out infinite',
            '@keyframes blob1': {
              '0%, 100%': {
                transform: 'translate(0, 0) scale(1)',
              },
              '33%': {
                transform: 'translate(30px, -50px) scale(1.1)',
              },
              '66%': {
                transform: 'translate(-20px, 20px) scale(0.9)',
              },
            },
          }}
        />
        {/* Blob 2 - ピンク */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            right: '-20%',
            width: '45vmax',
            height: '45vmax',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(244, 114, 182, 0.35) 0%, rgba(251, 113, 133, 0.35) 100%)',
            filter: 'blur(60px)',
            animation: 'blob2 25s ease-in-out infinite',
            '@keyframes blob2': {
              '0%, 100%': {
                transform: 'translate(0, 0) scale(1)',
              },
              '33%': {
                transform: 'translate(-40px, 30px) scale(1.15)',
              },
              '66%': {
                transform: 'translate(20px, -40px) scale(0.85)',
              },
            },
          }}
        />
        {/* Blob 3 - 青緑 */}
        <Box
          sx={{
            position: 'absolute',
            bottom: '-10%',
            left: '30%',
            width: '40vmax',
            height: '40vmax',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(52, 211, 153, 0.3) 0%, rgba(59, 130, 246, 0.3) 100%)',
            filter: 'blur(60px)',
            animation: 'blob3 22s ease-in-out infinite',
            '@keyframes blob3': {
              '0%, 100%': {
                transform: 'translate(0, 0) scale(1)',
              },
              '33%': {
                transform: 'translate(50px, -30px) scale(0.95)',
              },
              '66%': {
                transform: 'translate(-30px, 50px) scale(1.05)',
              },
            },
          }}
        />
      </Box>

      <Container maxWidth="sm" sx={{ pb: 6, pt: 2, position: 'relative', zIndex: 1 }}>
      {/* ヘッダー */}
      <Fade in timeout={800}>
        <Box sx={{ mt: 4, mb: 4, textAlign: 'center' }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 80,
              height: 80,
              borderRadius: '24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: '0 10px 40px rgba(102, 126, 234, 0.4)',
              mb: 3,
              animation: 'float 3s ease-in-out infinite',
              '@keyframes float': {
                '0%, 100%': { transform: 'translateY(0)' },
                '50%': { transform: 'translateY(-10px)' },
              },
            }}
          >
            <GroupsIcon sx={{ fontSize: 40, color: 'white' }} />
          </Box>
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              mb: 1,
            }}
          >
            マジョリティゲーム
          </Typography>
          <Typography variant="body2" color="text.secondary">
            みんなの多数派を当てるパーティゲーム
          </Typography>
        </Box>
      </Fade>

      {/* 進行中のルームに戻る / 終了したルームの結果を見る */}
      {activeRoom && (
        <Slide direction="down" in timeout={500}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 3,
              background: activeRoom.status === 'finished'
                ? 'rgba(16, 185, 129, 0.2)'
                : 'rgba(245, 158, 11, 0.2)',
              backdropFilter: 'blur(16px)',
              border: activeRoom.status === 'finished'
                ? '2px solid rgba(16, 185, 129, 0.4)'
                : '2px solid rgba(245, 158, 11, 0.4)',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <AutoAwesomeIcon sx={{ color: activeRoom.status === 'finished' ? '#10b981' : '#f59e0b' }} />
              <Typography variant="h6" fontWeight="bold">
                {activeRoom.status === 'finished' ? 'ゲームが終了しました' : '進行中のルームがあります'}
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {activeRoom.room_name}
            </Typography>
            <Button
              fullWidth
              variant="contained"
              color={activeRoom.status === 'finished' ? 'success' : 'warning'}
              size="large"
              onClick={handleRejoinRoom}
              startIcon={<PlayArrowIcon />}
              sx={{ py: 1.5 }}
            >
              {activeRoom.status === 'finished' ? '最終結果を見る' : 'ルームに戻る'}
            </Button>
          </Paper>
        </Slide>
      )}

      {/* 過去のルーム */}
      {isLoadingPastRooms ? (
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Skeleton variant="text" width={150} height={32} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 2, mb: 1 }} />
          <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 2 }} />
        </Paper>
      ) : pastRooms.length > 0 && (
        <Fade in timeout={600}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 3,
              background: (theme) => theme.palette.mode === 'dark'
                ? 'rgba(59, 130, 246, 0.15)'
                : 'rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(16px)',
              border: (theme) => theme.palette.mode === 'dark'
                ? '1px solid rgba(59, 130, 246, 0.3)'
                : '1px solid rgba(255, 255, 255, 0.5)',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <HistoryIcon sx={{ mr: 1, color: 'primary.main' }} />
              <Typography variant="h6" fontWeight="bold">
                過去のルーム
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              タップして質問を再利用
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
              {pastRooms.map((room, index) => (
                <Grow in timeout={300 + index * 100} key={room.id}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateX(8px)',
                      },
                      '&:active': {
                        transform: 'scale(0.98)',
                      },
                    }}
                    onClick={() => loadRoomQuestions(room.id, room.room_name)}
                  >
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="body1" fontWeight="600">
                            {room.room_name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(room.created_at).toLocaleDateString('ja-JP')} · {room.question_count}問
                          </Typography>
                        </Box>
                        <PlayArrowIcon sx={{ color: 'text.secondary', opacity: 0.5 }} />
                      </Box>
                    </CardContent>
                  </Card>
                </Grow>
              ))}
            </Box>
            <Button
              fullWidth
              variant="text"
              startIcon={<HistoryIcon />}
              onClick={() => router.push('/history')}
              sx={{ color: 'text.secondary' }}
            >
              過去のルームをすべて見る
            </Button>
          </Paper>
        </Fade>
      )}

      {/* 過去に参加したルーム */}
      {isLoadingJoinedRooms ? (
        <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
          <Skeleton variant="text" width={180} height={32} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" height={70} sx={{ borderRadius: 2, mb: 1 }} />
          <Skeleton variant="rectangular" height={70} sx={{ borderRadius: 2 }} />
        </Paper>
      ) : joinedRooms.length > 0 && (
        <Fade in timeout={650}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              mb: 3,
              background: (theme) => theme.palette.mode === 'dark'
                ? 'rgba(236, 72, 153, 0.15)'
                : 'rgba(236, 72, 153, 0.08)',
              backdropFilter: 'blur(16px)',
              border: (theme) => theme.palette.mode === 'dark'
                ? '1px solid rgba(236, 72, 153, 0.3)'
                : '1px solid rgba(236, 72, 153, 0.2)',
              boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <PersonIcon sx={{ mr: 1, color: '#ec4899' }} />
              <Typography variant="h6" fontWeight="bold">
                過去に参加したルーム
              </Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              タップして結果を確認
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
              {joinedRooms.map((room, index) => (
                <Grow in timeout={300 + index * 100} key={room.id}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateX(8px)',
                      },
                      '&:active': {
                        transform: 'scale(0.98)',
                      },
                    }}
                    onClick={() => router.push(`/room/${room.id}/summary`)}
                  >
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="body1" fontWeight="600">
                          {room.room_name}
                        </Typography>
                        {room.myRank === 1 ? (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#f59e0b' }}>
                            <EmojiEventsIcon sx={{ fontSize: 18 }} />
                            <Typography variant="body2" fontWeight="bold">
                              優勝！
                            </Typography>
                          </Box>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {room.myRank}位 / {room.playerCount}人
                          </Typography>
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {room.myNickname}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">·</Typography>
                        <Typography variant="caption" sx={{ color: 'primary.main', fontWeight: 600 }}>
                          {room.myScore}pt
                        </Typography>
                        <Typography variant="caption" color="text.secondary">·</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(room.created_at).toLocaleDateString('ja-JP')}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                </Grow>
              ))}
            </Box>
            <Button
              fullWidth
              variant="text"
              startIcon={<HistoryIcon />}
              onClick={() => router.push('/history')}
              sx={{ color: '#ec4899' }}
            >
              すべての履歴を見る
            </Button>
          </Paper>
        </Fade>
      )}

      {/* メインフォーム */}
      <Fade in timeout={700}>
        <Paper
          elevation={0}
          sx={{
            p: 3,
            borderRadius: 3,
            background: (theme) => theme.palette.mode === 'dark'
              ? 'rgba(30, 30, 50, 0.7)'
              : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(20px)',
            border: (theme) => theme.palette.mode === 'dark'
              ? '1px solid rgba(255, 255, 255, 0.1)'
              : '1px solid rgba(255, 255, 255, 0.5)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
          }}
        >
          <TextField
            fullWidth
            label="あなたの名前"
            value={hostNickname}
            onChange={(e) => setHostNickname(e.target.value)}
            placeholder="例：たろう"
            sx={{ mb: 1 }}
            required
            InputProps={{
              sx: { fontSize: '1.1rem' }
            }}
          />
          <Typography variant="caption" color="error" sx={{ mb: 2, display: 'block', lineHeight: 1.5 }}>
            ※会社に関わる情報や、氏名・住所・電話番号・メールアドレスなどの個人情報は記載しないでください
          </Typography>
          <TextField
            fullWidth
            label="ルーム名（任意）"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="例：新年会ゲーム"
            sx={{ mb: 3 }}
          />

          <Divider sx={{ my: 3, borderColor: 'rgba(102, 126, 234, 0.2)' }}>
            <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
              お題を入力
            </Typography>
          </Divider>

          {questions.map((question, index) => (
            <Fade in timeout={300} key={index}>
              <Box
                sx={{
                  mb: 3,
                  p: 2,
                  borderRadius: 2,
                  background: 'rgba(102, 126, 234, 0.05)',
                  border: '1px solid rgba(102, 126, 234, 0.1)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mr: 1.5,
                    }}
                  >
                    <Typography variant="body2" sx={{ color: 'white', fontWeight: 700 }}>
                      {index + 1}
                    </Typography>
                  </Box>
                  <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    お題 {index + 1}
                  </Typography>
                  {questions.length > 1 && (
                    <IconButton
                      color="error"
                      size="small"
                      onClick={() => removeQuestion(index)}
                      sx={{
                        transition: 'all 0.2s',
                        '&:hover': {
                          transform: 'rotate(90deg)',
                        },
                      }}
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

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <TextField
                    fullWidth
                    label="選択肢 A"
                    value={question.choiceA}
                    onChange={(e) => updateQuestion(index, 'choiceA', e.target.value)}
                    placeholder="例：春"
                    size="small"
                  />
                  <TextField
                    fullWidth
                    label="選択肢 B"
                    value={question.choiceB}
                    onChange={(e) => updateQuestion(index, 'choiceB', e.target.value)}
                    placeholder="例：秋"
                    size="small"
                  />
                </Box>
              </Box>
            </Fade>
          ))}

          <Button
            fullWidth
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={addQuestion}
            sx={{
              mb: 3,
              borderStyle: 'dashed',
              '&:hover': {
                borderStyle: 'dashed',
              },
            }}
          >
            お題を追加
          </Button>

          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleCreateRoom}
            disabled={!isValid || isCreating}
            startIcon={isCreating ? <CircularProgress size={20} color="inherit" /> : <AutoAwesomeIcon />}
            sx={{
              py: 2,
              fontSize: '1.1rem',
            }}
          >
            {isCreating ? '作成中...' : 'ルームを作成'}
          </Button>

          {error && (
            <Fade in>
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  borderRadius: 2,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                }}
              >
                <Typography variant="body2" color="error">
                  {error}
                </Typography>
              </Box>
            </Fade>
          )}

          {roomUrl && (
            <Grow in>
              <Box
                sx={{
                  mt: 3,
                  p: 3,
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(52, 211, 153, 0.15) 100%)',
                  border: '2px solid rgba(16, 185, 129, 0.3)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AutoAwesomeIcon sx={{ color: '#10b981' }} />
                  <Typography variant="h6" fontWeight="bold" sx={{ color: '#059669' }}>
                    ルーム作成完了！
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  URLまたはQRコードを参加者に共有してください
                </Typography>

                {/* QRコード（長押しで保存可能） */}
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    mb: 3,
                    p: 2,
                    borderRadius: 2,
                    background: 'white',
                  }}
                >
                  {/* 非表示のCanvas（データURL生成用） */}
                  <Box id="qr-canvas-home" sx={{ display: 'none' }}>
                    <QRCodeCanvas
                      value={roomUrl}
                      size={180}
                      level="M"
                      includeMargin
                    />
                  </Box>
                  {/* 長押しで保存可能なimg要素 */}
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="QRコード"
                      style={{ width: 180, height: 180 }}
                    />
                  ) : (
                    <QRCodeCanvas
                      value={roomUrl}
                      size={180}
                      level="M"
                      includeMargin
                      style={{ display: 'block' }}
                    />
                  )}
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                    長押しで画像を保存できます
                  </Typography>
                </Box>

                {/* URL */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <QrCodeIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary">
                    参加用URL
                  </Typography>
                </Box>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    background: 'rgba(255, 255, 255, 0.8)',
                    mb: 2,
                    wordBreak: 'break-all',
                    fontSize: '0.875rem',
                    fontFamily: 'monospace',
                  }}
                >
                  {roomUrl}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<ContentCopyIcon />}
                    onClick={handleCopyUrl}
                    sx={{ flex: 1 }}
                  >
                    {copied ? 'コピーしました！' : 'URLをコピー'}
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<PlayArrowIcon />}
                    onClick={() => {
                      const roomId = roomUrl.split('/room/')[1]?.split('/')[0]
                      if (roomId) {
                        router.push(`/room/${roomId}/waiting`)
                      }
                    }}
                    sx={{ flex: 1 }}
                  >
                    待機画面へ
                  </Button>
                </Box>
              </Box>
            </Grow>
          )}
        </Paper>
      </Fade>
    </Container>
    </Box>
  )
}
