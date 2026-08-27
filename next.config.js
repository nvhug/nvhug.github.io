/** @type {import('next').NextConfig} */
const nextConfig = {
  // Opt-in, because the two deployment targets need different output.
  //
  // The Docker image (Oracle Cloud) runs `node server.js`, which only exists in
  // .next/standalone, so its build sets BUILD_STANDALONE=1 — see the Dockerfile.
  //
  // Vercel must NOT get it. Building standalone makes `next build` read
  // .next/next-server.js.nft.json to learn which node_modules to copy, and Vercel
  // does its own file tracing rather than emitting that file, so the build dies with
  // ENOENT on it. Leaving this unset is what makes a plain `npm run build` reproduce
  // the Vercel build rather than the Docker one.
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  typescript: {
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
};

module.exports = nextConfig;
