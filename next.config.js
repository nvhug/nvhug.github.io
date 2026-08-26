/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for the Docker image: emits .next/standalone with a minimal server.js
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
};

module.exports = nextConfig;
