/**
 * セキュリティ: ユーザー入力の検証とサニタイズ
 *
 * XSS攻撃やインジェクション攻撃を防ぐため、
 * 全てのユーザー入力を検証・サニタイズする
 */

/**
 * 危険な文字をエスケープしてXSS攻撃を防ぐ
 */
export function sanitizeInput(input: string, maxLength: number = 100): string {
  if (!input) return ''

  return input
    // 危険なHTMLタグ文字を削除
    .replace(/[<>]/g, '')
    // 制御文字を削除
    .replace(/[\x00-\x1F\x7F]/g, '')
    // 最大長を制限
    .substring(0, maxLength)
    // 前後の空白を削除
    .trim()
}

/**
 * ニックネームのバリデーション
 */
export function validateNickname(nickname: string): { valid: boolean; error?: string } {
  if (!nickname || nickname.trim().length === 0) {
    return { valid: false, error: 'ニックネームを入力してください' }
  }

  const sanitized = sanitizeInput(nickname, 50)

  if (sanitized.length === 0) {
    return { valid: false, error: '有効な文字を入力してください' }
  }

  if (sanitized.length < 1) {
    return { valid: false, error: 'ニックネームは1文字以上必要です' }
  }

  if (sanitized.length > 50) {
    return { valid: false, error: 'ニックネームは50文字以内にしてください' }
  }

  // 絵文字や特殊文字のチェック（オプション）
  // 日本語、英数字（全角・半角）、一部の記号のみ許可
  const validPattern = /^[ぁ-んァ-ヴー一-龯a-zA-Zａ-ｚＡ-Ｚ0-9０-９_\s\-＿　]+$/
  if (!validPattern.test(sanitized)) {
    return { valid: false, error: '使用できない文字が含まれています' }
  }

  return { valid: true }
}

/**
 * 質問テキストのバリデーション
 */
export function validateQuestionText(text: string): { valid: boolean; error?: string } {
  if (!text || text.trim().length === 0) {
    return { valid: false, error: '質問を入力してください' }
  }

  const sanitized = sanitizeInput(text, 500)

  if (sanitized.length === 0) {
    return { valid: false, error: '有効な質問を入力してください' }
  }

  if (sanitized.length < 5) {
    return { valid: false, error: '質問は5文字以上必要です' }
  }

  if (sanitized.length > 500) {
    return { valid: false, error: '質問は500文字以内にしてください' }
  }

  return { valid: true }
}

/**
 * 選択肢のバリデーション
 */
export function validateChoice(choice: string): { valid: boolean; error?: string } {
  if (!choice || choice.trim().length === 0) {
    return { valid: false, error: '選択肢を入力してください' }
  }

  const sanitized = sanitizeInput(choice, 100)

  if (sanitized.length === 0) {
    return { valid: false, error: '有効な選択肢を入力してください' }
  }

  if (sanitized.length > 100) {
    return { valid: false, error: '選択肢は100文字以内にしてください' }
  }

  return { valid: true }
}

/**
 * コメントのバリデーション
 */
export function validateComment(comment: string): { valid: boolean; error?: string } {
  // コメントはオプションなので、空でもOK
  if (!comment || comment.trim().length === 0) {
    return { valid: true }
  }

  const sanitized = sanitizeInput(comment, 500)

  if (sanitized.length > 500) {
    return { valid: false, error: 'コメントは500文字以内にしてください' }
  }

  return { valid: true }
}

/**
 * ルーム名のバリデーション
 */
export function validateRoomName(roomName: string): { valid: boolean; error?: string } {
  if (!roomName || roomName.trim().length === 0) {
    return { valid: false, error: 'ルーム名を入力してください' }
  }

  const sanitized = sanitizeInput(roomName, 100)

  if (sanitized.length === 0) {
    return { valid: false, error: '有効なルーム名を入力してください' }
  }

  if (sanitized.length < 1) {
    return { valid: false, error: 'ルーム名は1文字以上必要です' }
  }

  if (sanitized.length > 100) {
    return { valid: false, error: 'ルーム名は100文字以内にしてください' }
  }

  return { valid: true }
}

/**
 * UUID形式のバリデーション
 */
export function validateUUID(uuid: string): boolean {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidPattern.test(uuid)
}

/**
 * 数値範囲のバリデーション
 */
export function validateNumberRange(value: number, min: number, max: number): boolean {
  return !isNaN(value) && value >= min && value <= max
}
