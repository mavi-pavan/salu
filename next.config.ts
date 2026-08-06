import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // O app inteiro é privado e lê do banco em toda requisição; não há nada
  // estático para cachear entre usuários.
  experimental: {
    serverActions: {
      bodySizeLimit: "1mb",
    },
  },
};

export default nextConfig;
