const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production';

const nextConfig = {
    turbopack: {
        root: __dirname,
    },
    output: 'standalone',
    compress: true,
    poweredByHeader: false,
    images: {
        formats: ['image/avif', 'image/webp'],
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
            },
            {
                protocol: 'https',
                hostname: 'api.dicebear.com',
            },
        ],
        minimumCacheTTL: 60 * 60 * 24 * 365, // 1 year
        deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    },
    async headers() {
        return [
            {
                source: '/sw.js',
                headers: [
                    { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
                    { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
                    { key: 'Service-Worker-Allowed', value: '/' },
                ],
            },
            {
                // Cache images for 1 year (Next.js handles versioning via query params)
                source: '/images/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
                ],
            },
            {
                // Cache public static assets
                source: '/(logo\\.png|login-bg\\.png)',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
                ],
            },
            {
                // Cache video files
                source: '/media/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=2592000' }, // 30 days
                ],
            },
            {
                // Cache fonts for 1 year
                source: '/fonts/:path*',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
                ],
            },
            {
                // Cache manifest and icons
                source: '/(manifest\\.json|icons/:path*)',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=604800' }, // 7 days
                ],
            },
            {
                // Cache and security headers for all routes (excluding /_next/static which is immutable)
                source: '/(.*)',
                headers: [
                    { key: 'X-Content-Type-Options', value: 'nosniff' },
                    { key: 'X-Frame-Options', value: 'DENY' },
                    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                    { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=(self)' },
                    {
                        key: 'Content-Security-Policy',
                        value: [
                            "default-src 'self'",
                            isProduction ? "script-src 'self'" : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                            "style-src 'self' 'unsafe-inline'",
                            "img-src 'self' data: blob: https://images.unsplash.com https://*.newsapi.org https://*.cloudfront.net",
                            "font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com",
                            "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://api.anthropic.com https://api.openai.com https://api.deepseek.com https://api-inference.huggingface.co https://router.huggingface.co https://api.groq.com",
                            "media-src 'self'",
                            "object-src 'none'",
                            "base-uri 'self'",
                            "form-action 'self'",
                            "frame-ancestors 'none'",
                            "upgrade-insecure-requests",
                        ].join('; '),
                    },
                    {
                        key: 'Strict-Transport-Security',
                        value: 'max-age=63072000; includeSubDomains; preload',
                    },
                ],
            },
        ];
    },
}

module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  hideSourceMaps: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
    automaticVercelMonitors: false,
  }
});
