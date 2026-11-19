/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // As telas do DDS-ON ficam em /dds-on desde a separação por produto: links antigos continuam funcionando.
  async redirects() {
    return [{ source: '/companies/:id', destination: '/dds-on/companies/:id', permanent: false }];
  },
};

export default nextConfig;
