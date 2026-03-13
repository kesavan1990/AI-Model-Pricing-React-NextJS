/** @type {import('next').NextConfig} */

// GitHub Pages project site: https://<user>.github.io/<repo>/
const repoName = 'AI-Model-Pricing-React-NextJS';
const isGitHubPages = process.env.GITHUB_PAGES === '1';

const basePath = isGitHubPages ? `/${repoName}` : '';

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [],
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(isGitHubPages
    ? {
        output: 'export',
        trailingSlash: true,
        images: { unoptimized: true },
        basePath,
        assetPrefix: `${basePath}/`,
      }
    : {}),
};

export default nextConfig;