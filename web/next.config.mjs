const isDev = process.env.NODE_ENV !== "production"
const connectSrc = isDev
  ? "connect-src 'self' https: http://localhost:4000 http://127.0.0.1:4000 ws: wss:;"
  : "connect-src 'self' https:;"
const csp =
  `default-src 'self'; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; worker-src 'self' blob:; manifest-src 'self'; ${connectSrc} frame-ancestors 'none'`

const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.postimg.cc"
      }
    ]
  },
  async rewrites() {
    return []
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" }
        ]
      }
    ]
  }
}

export default nextConfig
