import type { NextConfig } from "next";

// Identifica cada build: na Vercel usa o commit; localmente, o horário do build.
// O app compara esta versão com a do servidor para avisar quando há atualização.
const BUILD_ID = (process.env.VERCEL_GIT_COMMIT_SHA || `local-${Date.now().toString(36)}`).slice(0, 12);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
};

export default nextConfig;
