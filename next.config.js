/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow importing from project root /src (shared logic with legacy app)
  transpilePackages: [],
};

export default nextConfig;
