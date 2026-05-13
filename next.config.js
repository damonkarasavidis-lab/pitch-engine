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
    // Keep these packages out of the webpack bundle so they run as native Node
    // modules. pdf-parse needs this to avoid its test-file auto-require issue.
    serverComponentsExternalPackages: ['@anthropic-ai/sdk', 'pdf-parse'],
  },
}

module.exports = nextConfig
