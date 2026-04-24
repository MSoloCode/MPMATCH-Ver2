/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  typescript: {
    tsconfigPath: './tsconfig.json',
  },
  async redirects() {
    return [
      // Quick path fixes
      { source: '/signin', destination: '/sign-in', permanent: false },
      { source: '/chat', destination: '/ai-chat', permanent: false },
      // Legacy dashboard redirects
      { source: '/doctor-dashboard', destination: '/clinical/doctor', permanent: true },
      { source: '/nurse-dashboard', destination: '/clinical/nurse', permanent: true },
      { source: '/midwife-dashboard', destination: '/clinical/midwife', permanent: true },
      { source: '/admin-dashboard', destination: '/admin/dashboard', permanent: true },
    ];
  },
};

module.exports = nextConfig;
