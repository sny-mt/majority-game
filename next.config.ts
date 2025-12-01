import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // パフォーマンス最適化設定

  // 圧縮の有効化
  compress: true,

  // 画像最適化（将来的に画像を追加する場合）
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 60,
  },

  // Reactの厳格モード（開発時のパフォーマンス警告）
  reactStrictMode: true,

  // 実験的機能: より高速なトランスパイル
  experimental: {
    // optimizePackageImports: MUIなどの大きなライブラリを最適化
    optimizePackageImports: ['@mui/material', '@mui/icons-material'],
  },

  // Turbopack設定（空でもOK、webpack設定エラーを回避）
  turbopack: {},
};

export default nextConfig;
