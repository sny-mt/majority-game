'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  IconButton,
  MobileStepper,
  Button,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import KeyboardArrowLeft from '@mui/icons-material/KeyboardArrowLeft'
import KeyboardArrowRight from '@mui/icons-material/KeyboardArrowRight'

interface HowToPlayDialogProps {
  open: boolean
  onClose: () => void
}

interface TutorialStep {
  title: string
  description: string
  color: string
  image: React.ReactNode
}

// スマホ画面のモックアップSVG
const PhoneMockup = ({ children, color }: { children: React.ReactNode; color: string }) => (
  <svg width="160" height="200" viewBox="0 0 160 200" fill="none">
    {/* スマホ外枠 */}
    <rect x="10" y="5" width="140" height="190" rx="16" fill="#1a1a2e" />
    <rect x="14" y="12" width="132" height="176" rx="12" fill="white" />
    {/* ノッチ */}
    <rect x="55" y="8" width="50" height="6" rx="3" fill="#333" />
    {/* 画面コンテンツ */}
    <g transform="translate(14, 20)">
      {children}
    </g>
    {/* 下部バー */}
    <rect x="60" y="182" width="40" height="4" rx="2" fill={color} opacity="0.5" />
  </svg>
)

// Step 1: QRコード共有画面
const QRShareImage = () => (
  <PhoneMockup color="#667eea">
    {/* ヘッダー */}
    <rect x="10" y="8" width="112" height="12" rx="2" fill="#667eea" opacity="0.2" />
    {/* QRコード */}
    <rect x="31" y="35" width="70" height="70" rx="4" fill="#667eea" opacity="0.15" />
    <g transform="translate(41, 45)">
      {/* QRパターン */}
      {[0, 1, 2, 3, 4].map((row) =>
        [0, 1, 2, 3, 4].map((col) => (
          <rect
            key={`${row}-${col}`}
            x={col * 10}
            y={row * 10}
            width="8"
            height="8"
            rx="1"
            fill="#667eea"
            opacity={(row + col) % 2 === 0 ? 0.8 : 0.3}
          />
        ))
      )}
    </g>
    {/* URL表示 */}
    <rect x="15" y="115" width="102" height="14" rx="3" fill="#667eea" opacity="0.1" />
    <rect x="20" y="119" width="60" height="6" rx="1" fill="#667eea" opacity="0.4" />
    {/* コピーボタン */}
    <rect x="25" y="138" width="82" height="20" rx="10" fill="#667eea" />
    <rect x="45" y="145" width="42" height="6" rx="1" fill="white" />
  </PhoneMockup>
)

// Step 2: 問題表示画面
const QuestionImage = () => (
  <PhoneMockup color="#f59e0b">
    {/* 問題番号 */}
    <rect x="45" y="8" width="42" height="14" rx="7" fill="#f59e0b" opacity="0.2" />
    <text x="66" y="18" fontSize="8" fill="#f59e0b" textAnchor="middle" fontWeight="bold">Q1</text>
    {/* 問題文 */}
    <rect x="15" y="32" width="102" height="35" rx="6" fill="#f59e0b" opacity="0.1" />
    <rect x="22" y="40" width="88" height="5" rx="1" fill="#f59e0b" opacity="0.5" />
    <rect x="22" y="48" width="70" height="5" rx="1" fill="#f59e0b" opacity="0.5" />
    <rect x="22" y="56" width="55" height="5" rx="1" fill="#f59e0b" opacity="0.3" />
    {/* 選択肢 */}
    {[0, 1, 2, 3].map((i) => (
      <g key={i}>
        <rect x="15" y={78 + i * 22} width="102" height="18" rx="4" fill="#f59e0b" opacity={0.1} />
        <rect x="22" y={84 + i * 22} width={50 + (i % 3) * 10} height="6" rx="1" fill="#f59e0b" opacity="0.4" />
      </g>
    ))}
  </PhoneMockup>
)

// Step 3: 回答選択画面
const AnswerSelectImage = () => (
  <PhoneMockup color="#10b981">
    {/* 問題 */}
    <rect x="15" y="8" width="102" height="28" rx="6" fill="#10b981" opacity="0.1" />
    <rect x="22" y="16" width="70" height="5" rx="1" fill="#10b981" opacity="0.4" />
    {/* 選択肢（1つ選択中） */}
    {[0, 1, 2, 3].map((i) => (
      <g key={i}>
        <rect
          x="15"
          y={48 + i * 26}
          width="102"
          height="22"
          rx="6"
          fill={i === 1 ? '#10b981' : '#10b981'}
          opacity={i === 1 ? 0.3 : 0.1}
          stroke={i === 1 ? '#10b981' : 'none'}
          strokeWidth={i === 1 ? 2 : 0}
        />
        <rect x="22" y={56 + i * 26} width={45 + (i % 2) * 15} height="6" rx="1" fill="#10b981" opacity={i === 1 ? 0.8 : 0.4} />
        {i === 1 && (
          <circle cx="105" cy={59 + i * 26} r="6" fill="#10b981" />
        )}
      </g>
    ))}
    {/* 送信ボタン */}
    <rect x="25" y="160" width="82" height="22" rx="11" fill="#10b981" />
    <rect x="48" y="168" width="36" height="6" rx="1" fill="white" />
  </PhoneMockup>
)

// Step 4: 結果発表画面
const ResultImage = () => (
  <PhoneMockup color="#ef4444">
    {/* 正解表示 */}
    <rect x="30" y="8" width="72" height="20" rx="10" fill="#ef4444" opacity="0.2" />
    <text x="66" y="21" fontSize="9" fill="#ef4444" textAnchor="middle" fontWeight="bold">正解発表</text>
    {/* 選択肢と投票数 */}
    {[0, 1, 2, 3].map((i) => (
      <g key={i}>
        <rect
          x="15"
          y={40 + i * 28}
          width="102"
          height="24"
          rx="6"
          fill={i === 1 ? '#10b981' : '#ef4444'}
          opacity={i === 1 ? 0.2 : 0.1}
        />
        <rect x="22" y={46 + i * 28} width={40 + (i % 2) * 10} height="5" rx="1" fill={i === 1 ? '#10b981' : '#ef4444'} opacity="0.6" />
        {/* プログレスバー */}
        <rect x="22" y={54 + i * 28} width="88" height="4" rx="2" fill="#ddd" />
        <rect x="22" y={54 + i * 28} width={i === 1 ? 70 : 20 + i * 10} height="4" rx="2" fill={i === 1 ? '#10b981' : '#ef4444'} opacity="0.7" />
        {/* 人数 */}
        <text x="115" y={52 + i * 28} fontSize="7" fill={i === 1 ? '#10b981' : '#999'} textAnchor="end">{i === 1 ? '8人' : `${i + 1}人`}</text>
      </g>
    ))}
    {/* 結果メッセージ */}
    <rect x="35" y="158" width="62" height="16" rx="8" fill="#10b981" opacity="0.2" />
    <text x="66" y="169" fontSize="7" fill="#10b981" textAnchor="middle" fontWeight="bold">+100pt!</text>
  </PhoneMockup>
)

// Step 5: ランキング画面
const RankingImage = () => (
  <PhoneMockup color="#764ba2">
    {/* タイトル */}
    <rect x="30" y="5" width="72" height="18" rx="9" fill="#764ba2" opacity="0.2" />
    <text x="66" y="17" fontSize="8" fill="#764ba2" textAnchor="middle" fontWeight="bold">ランキング</text>
    {/* トロフィー */}
    <g transform="translate(50, 28)">
      <path d="M16 0 L20 12 L32 12 L22 20 L26 32 L16 24 L6 32 L10 20 L0 12 L12 12 Z" fill="#fbbf24" />
    </g>
    {/* ランキング */}
    {[0, 1, 2].map((i) => (
      <g key={i}>
        <rect
          x="15"
          y={68 + i * 32}
          width="102"
          height="28"
          rx="6"
          fill={i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : '#cd7f32'}
          opacity={0.15}
        />
        {/* 順位 */}
        <circle cx="30" cy={82 + i * 32} r="10" fill={i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : '#cd7f32'} />
        <text x="30" y={86 + i * 32} fontSize="10" fill="white" textAnchor="middle" fontWeight="bold">{i + 1}</text>
        {/* 名前 */}
        <rect x="48" y={76 + i * 32} width={40 - i * 5} height="6" rx="1" fill="#764ba2" opacity="0.5" />
        {/* スコア */}
        <text x="110" y={86 + i * 32} fontSize="9" fill="#764ba2" textAnchor="end" fontWeight="bold">{300 - i * 50}pt</text>
      </g>
    ))}
  </PhoneMockup>
)

const tutorialSteps: TutorialStep[] = [
  {
    title: 'みんなで参加',
    description: 'QRコードまたはURLを共有して、友達をルームに招待しましょう。',
    color: '#667eea',
    image: <QRShareImage />,
  },
  {
    title: '問題が出題される',
    description: 'ホストがゲームを開始すると、全員に同じ問題が表示されます。',
    color: '#f59e0b',
    image: <QuestionImage />,
  },
  {
    title: '回答を選ぶ',
    description: '選択肢の中から、多数派だと思う回答を選んで投票しましょう。',
    color: '#10b981',
    image: <AnswerSelectImage />,
  },
  {
    title: '多数派が勝ち！',
    description: '最も多く選ばれた回答を選んだ人にポイントが入ります。',
    color: '#ef4444',
    image: <ResultImage />,
  },
  {
    title: '全問終了後に結果発表',
    description: '全ての問題が終わったら、総合ランキングが発表されます！',
    color: '#764ba2',
    image: <RankingImage />,
  },
]

export function HowToPlayDialog({ open, onClose }: HowToPlayDialogProps) {
  const [activeStep, setActiveStep] = useState(0)
  const maxSteps = tutorialSteps.length

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1)
  }

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1)
  }

  const handleClose = () => {
    setActiveStep(0)
    onClose()
  }

  const currentStep = tutorialSteps[activeStep]

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 4,
          overflow: 'hidden',
          m: 2,
        },
      }}
    >
      {/* 閉じるボタン */}
      <IconButton
        onClick={handleClose}
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          color: 'text.secondary',
          zIndex: 1,
        }}
      >
        <CloseIcon />
      </IconButton>

      <DialogContent sx={{ p: 0 }}>
        {/* メインコンテンツ */}
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 420,
            p: 3,
            pt: 5,
            background: `linear-gradient(135deg, ${currentStep.color}15 0%, ${currentStep.color}08 100%)`,
            transition: 'background 0.3s ease',
          }}
        >
          {/* ステップ番号 */}
          <Typography
            variant="overline"
            sx={{
              color: currentStep.color,
              fontWeight: 700,
              letterSpacing: 2,
              mb: 2,
            }}
          >
            STEP {activeStep + 1} / {maxSteps}
          </Typography>

          {/* 画面イメージ */}
          <Box
            sx={{
              mb: 3,
              animation: 'slideIn 0.4s ease-out',
              '@keyframes slideIn': {
                '0%': { transform: 'translateX(20px)', opacity: 0 },
                '100%': { transform: 'translateX(0)', opacity: 1 },
              },
              filter: `drop-shadow(0 10px 30px ${currentStep.color}30)`,
            }}
          >
            {currentStep.image}
          </Box>

          {/* タイトル */}
          <Typography
            variant="h5"
            sx={{
              fontWeight: 700,
              textAlign: 'center',
              mb: 1.5,
            }}
          >
            {currentStep.title}
          </Typography>

          {/* 説明 */}
          <Typography
            variant="body2"
            sx={{
              color: 'text.secondary',
              textAlign: 'center',
              lineHeight: 1.8,
              maxWidth: 280,
              px: 2,
            }}
          >
            {currentStep.description}
          </Typography>
        </Box>

        {/* ナビゲーション */}
        <MobileStepper
          steps={maxSteps}
          position="static"
          activeStep={activeStep}
          sx={{
            background: 'transparent',
            px: 2,
            py: 2,
            '& .MuiMobileStepper-dot': {
              width: 10,
              height: 10,
              mx: 0.5,
            },
            '& .MuiMobileStepper-dotActive': {
              background: `linear-gradient(135deg, ${currentStep.color} 0%, ${currentStep.color}cc 100%)`,
            },
          }}
          nextButton={
            activeStep === maxSteps - 1 ? (
              <Button
                size="small"
                onClick={handleClose}
                sx={{
                  fontWeight: 600,
                  color: currentStep.color,
                }}
              >
                はじめる
              </Button>
            ) : (
              <Button
                size="small"
                onClick={handleNext}
                sx={{ fontWeight: 600 }}
              >
                次へ
                <KeyboardArrowRight />
              </Button>
            )
          }
          backButton={
            <Button
              size="small"
              onClick={handleBack}
              disabled={activeStep === 0}
              sx={{ fontWeight: 600 }}
            >
              <KeyboardArrowLeft />
              戻る
            </Button>
          }
        />
      </DialogContent>
    </Dialog>
  )
}
