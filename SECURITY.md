# セキュリティガイド

このドキュメントでは、Majority Gameアプリケーションのセキュリティに関する重要な情報と推奨事項をまとめています。

## 🔒 実装済みのセキュリティ対策

### 1. 環境変数の保護
- `.env.local` ファイルは `.gitignore` に含まれており、バージョン管理から除外されています
- Supabase APIキーは環境変数として管理されています

### 2. 入力検証とサニタイズ
以下の入力に対して、検証とサニタイズが実装されています：

- **ニックネーム**: 1-50文字、特殊文字制限
- **ルーム名**: 1-100文字
- **質問テキスト**: 5-500文字
- **選択肢**: 1-100文字
- **コメント**: 0-500文字

実装場所: `lib/utils/validation.ts`

### 3. XSS（クロスサイトスクリプティング）対策
- 全てのユーザー入力は `sanitizeInput()` 関数でサニタイズ
- 危険な HTML タグ文字 (`<>`) を削除
- 制御文字を削除

### 4. データベース制約
Supabaseマイグレーション (`supabase/migrations/001_add_rls_policies.sql`) で以下を実装：

- 文字列長の制約
- NOT NULL 制約
- データ型の厳格な定義

## ⚠️ 現在の制限事項と今後の対策

### 重大な制限事項

#### 1. Row Level Security (RLS) の暫定実装
**現状**: 基本的な RLS ポリシーのみ実装

**リスク**:
- プレイヤーIDがクライアント側で生成されるため、信頼性が低い
- スコアの改ざんが理論上可能
- 他のプレイヤーへのなりすましが可能

**推奨対策** (本番環境への移行前に必須):

```typescript
// Supabase Auth の実装
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  }
)

// 匿名認証（最小限の対策）
const { data, error } = await supabase.auth.signInAnonymously()
```

RLSポリシーの更新:
```sql
-- プレイヤーは自分のデータのみアクセス可能
CREATE POLICY "Players can only access their own data"
  ON players
  FOR ALL
  USING (auth.uid()::text = id);

-- スコア更新はサービスロールのみ
CREATE POLICY "Only service role can update scores"
  ON players
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

#### 2. スコア計算がクライアント側
**現状**: `app/room/[roomId]/result/page.tsx` でスコア計算

**リスク**: ユーザーがブラウザコンソールから直接スコアを変更可能

**推奨対策**:

```typescript
// API Route の作成: app/api/room/[roomId]/calculate-scores/route.ts
import { createServerClient } from '@supabase/ssr'

export async function POST(request: Request, { params }: any) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // サービスロールキーを使用
    // ... cookies設定
  )

  // サーバー側でスコア計算
  // RLSをバイパスして確実に更新
}
```

#### 3. プレイヤーID管理
**現状**: LocalStorageに保存、クライアント側で生成

**リスク**:
- LocalStorageの改ざんが可能
- 他のプレイヤーになりすまし可能

**推奨対策**:
1. Supabase Auth の実装（上記参照）
2. セッションベースの認証
3. JWTトークンの検証

### 中程度の制限事項

#### 4. CSRF保護
**現状**: Next.jsのデフォルト保護のみ

**推奨対策** (API Routeを実装する場合):
```typescript
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  const csrfToken = request.headers.get('x-csrf-token')
  const cookieStore = await cookies()
  const storedToken = cookieStore.get('csrf-token')?.value

  if (!csrfToken || !storedToken || csrfToken !== storedToken) {
    return Response.json({ error: 'CSRF validation failed' }, { status: 403 })
  }

  // リクエスト処理
}
```

#### 5. Rate Limiting
**現状**: 未実装

**推奨対策**: Supabase Edge Functionsでレート制限を実装

## 🚀 本番環境デプロイ前のチェックリスト

### 必須項目（P0）

- [ ] **Supabase Authの実装**
  - 匿名認証またはメール認証を実装
  - `auth.uid()` を使用したRLSポリシーに更新

- [ ] **Supabase APIキーのローテーション**
  - 開発中に公開された可能性がある場合は、Supabaseダッシュボードで新しいキーを生成
  - `.env.local` を更新

- [ ] **RLS マイグレーションの実行**
  ```bash
  # Supabase CLIを使用
  supabase migration up

  # または、Supabaseダッシュボードで手動実行
  # Settings > Database > SQL Editor
  ```

- [ ] **スコア計算のサーバー側実装**
  - API Routeの作成
  - SERVICE_ROLE_KEYの環境変数設定

### 推奨項目（P1）

- [ ] **セキュリティヘッダーの追加**
  ```typescript
  // next.config.js
  module.exports = {
    async headers() {
      return [
        {
          source: '/(.*)',
          headers: [
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
            {
              key: 'Content-Security-Policy',
              value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval';"
            }
          ]
        }
      ]
    }
  }
  ```

- [ ] **ロギングと監査**
  - 不正なアクセス試行のログ記録
  - Supabase のログ機能を有効化

- [ ] **HTTPS の強制**
  - Vercel/Netlify等のホスティングサービスでHTTPS設定

### オプション項目（P2）

- [ ] Rate Limiting の実装
- [ ] データベース暗号化の有効化
- [ ] セキュリティ監査ツールの実行 (`npm audit`)
- [ ] 依存関係の定期更新

## 🔐 環境変数の管理

### 開発環境
`.env.local` ファイルに以下を設定:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 本番環境
以下の追加環境変数が必要:
```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # サーバー側のみ
```

⚠️ **警告**: `SUPABASE_SERVICE_ROLE_KEY` は絶対にクライアント側に公開しないでください。

## 📋 セキュリティテストチェックリスト

デプロイ前に以下をテスト:

- [ ] ブラウザコンソールから他プレイヤーのスコアを変更できないことを確認
- [ ] LocalStorageを改ざんしても別プレイヤーになりすまし不可を確認
- [ ] `<script>alert('XSS')</script>` をニックネームに入力しても実行されないことを確認
- [ ] 直接Supabase APIを呼び出してもRLSによって拒否されることを確認
- [ ] 超長いテキスト入力がデータベース制約で拒否されることを確認

## 🐛 脆弱性の報告

セキュリティ上の問題を発見した場合は、以下の手順で報告してください:

1. **公開しない**: GitHub Issuesやパブリックフォーラムには投稿しないでください
2. **直接連絡**: プロジェクトメンテナーに直接メールで連絡してください
3. **詳細を提供**: 再現手順と影響範囲を含めてください

## 📚 参考資料

- [Supabase Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Next.js Security Best Practices](https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [React Security Best Practices](https://react.dev/learn/writing-markup-with-jsx#the-rules-of-jsx)

## 🔄 更新履歴

- **2025-01-XX**: 初版作成
  - 入力検証とサニタイズ機能を追加
  - 基本的なRLSポリシーを実装
  - セキュリティガイドラインを文書化
