/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.alicdn.com' },
      { protocol: 'https', hostname: '*.alicdn.com' },
      { protocol: 'https', hostname: 'pk-live-01.slatic.net' },
      { protocol: 'https', hostname: 'sg-live-01.slatic.net' },
      { protocol: 'https', hostname: 'slatic.net' },
      { protocol: 'https', hostname: '*.slatic.net' },
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
};

export default nextConfig;
