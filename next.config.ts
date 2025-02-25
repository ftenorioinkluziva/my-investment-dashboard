/** @type {import('next').NextConfig} */
const nextConfig: import('next').NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://svc.aebroadcast.com.br/:path*',
      },
    ]
  },
}

module.exports = nextConfig