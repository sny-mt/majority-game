// プレイヤーIDの管理

const DEVICE_ID_KEY = 'majority_game_device_id'

/**
 * UUIDv4を生成
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

/**
 * デバイスIDを取得または生成
 * これはブラウザ/デバイスを識別するための永続的なID
 */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') {
    return '' // SSR時は空文字を返す
  }

  let deviceId = localStorage.getItem(DEVICE_ID_KEY)

  if (!deviceId) {
    deviceId = generateUUID()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }

  return deviceId
}

/**
 * ルーム固有のプレイヤーIDを生成
 * デバイスIDとルームIDを組み合わせて、ルームごとにユニークなIDを生成
 */
export function generateRoomPlayerId(roomId: string): string {
  const deviceId = getOrCreateDeviceId()
  // デバイスIDとルームIDを結合してハッシュ化
  // UUID形式を維持するため、両方を結合した文字列からUUIDを生成
  const combined = `${deviceId}-${roomId}`
  return generateDeterministicUUID(combined)
}

/**
 * 文字列から決定的なUUIDを生成
 */
function generateDeterministicUUID(input: string): string {
  // 簡易的なハッシュ関数
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }

  // ハッシュ値とランダム要素を組み合わせてUUID形式の文字列を生成
  const hashStr = Math.abs(hash).toString(16).padStart(8, '0')
  const inputHash = input.split('').reduce((acc, char, i) => {
    return acc + char.charCodeAt(0) * (i + 1)
  }, 0)
  const hashStr2 = Math.abs(inputHash).toString(16).padStart(12, '0')

  return `${hashStr.slice(0, 8)}-${hashStr.slice(0, 4)}-4${hashStr.slice(1, 4)}-${['8', '9', 'a', 'b'][Math.abs(hash) % 4]}${hashStr.slice(2, 5)}-${hashStr2.slice(0, 12)}`
}

/**
 * 後方互換性のため、旧形式のプレイヤーIDも取得
 * @deprecated 新しいコードではgetOrCreateDeviceId()とgenerateRoomPlayerId()を使用
 */
export function getOrCreatePlayerId(): string {
  return getOrCreateDeviceId()
}

/**
 * プレイヤーIDをlocalStorageに保存
 * @deprecated
 */
export function setPlayerId(playerId: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(DEVICE_ID_KEY, playerId)
}

/**
 * プレイヤーIDをクリア（デバッグ用）
 */
export function clearPlayerId(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(DEVICE_ID_KEY)
}
