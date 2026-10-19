import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // App 100% dinâmico (dados por usuário, em tempo real): usamos o modelo
  // clássico de renderização dinâmica, sem Cache Components.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
