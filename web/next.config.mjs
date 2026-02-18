const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
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
  async rewrites() {
    const backendOrigin = process.env.BACKEND_ORIGIN || "https://observant-achievement-production-bb94.up.railway.app"
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`
      }
    ]
  },
}

export default nextConfig