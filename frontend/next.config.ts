import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O runner CLI experimental do Next encerra antes de capturar o `tsc --showConfig` no
  // Node 22.20 e impede o Jest de iniciar. A Compiler API usa o mesmo tsconfig sem esse race.
  experimental: { useTypeScriptCli: false },
};

export default nextConfig;
