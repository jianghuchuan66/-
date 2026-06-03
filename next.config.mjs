/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
  // 允许 WSL 网络地址访问开发服务器资源
  allowedDevOrigins: ['198.18.0.1', 'localhost'],
}

export default nextConfig
