/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Menambahkan alias untuk modul yang tidak ditemukan
    config.resolve.alias['@react-native-async-storage/async-storage'] = false;
    
    return config;
  },
};

export default nextConfig;
