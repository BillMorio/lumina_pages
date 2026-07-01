/** @type {import('next').NextConfig} */
const nextConfig = {
  // Native / browser-automation deps must NOT be bundled by Next — they run in
  // the Node server process (API route handlers), not the edge runtime.
  experimental: {
    serverComponentsExternalPackages: [
      "playwright",
      "playwright-extra",
      "puppeteer-extra-plugin-stealth",
    ],
  },
}

export default nextConfig
