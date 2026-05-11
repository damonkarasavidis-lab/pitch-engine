/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow images from any HTTPS source (tighten this in production)
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },

  // Required for @vercel/og (OG image generation)
  experimental: {
    serverComponentsExternalPackages: ['@anthropic-ai/sdk'],
  },
}

module.exports = nextConfig
