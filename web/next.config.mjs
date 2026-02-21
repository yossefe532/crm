const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
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
    const backendOrigin = process.env.BACKEND_ORIGIN || process.env.NEXT_PUBLIC_API_DIRECT_URL || "https://observant-achievement-production-bb94.up.railway.app"
    return [
      {
        source: "/api/:path*",
        destination: `${backendOrigin}/api/:path*`
      }
    ]
  },
}

export default nextConfig