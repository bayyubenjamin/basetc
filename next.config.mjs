/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.resolve.alias['@react-native-async-storage/async-storage'] = false;
    return config;
  },
};

export default nextConfig;
