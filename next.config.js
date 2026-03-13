
const repoName = "AI-Model-Pricing-React-NextJS";

const nextConfig = {
  reactStrictMode: true,

  output: "export",
  trailingSlash: true,

  basePath: `/${repoName}`,
  assetPrefix: `/${repoName}/`,

  images: {
    unoptimized: true,
  },
};

export default nextConfig;