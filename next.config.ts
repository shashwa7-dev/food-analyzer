import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Pages already visited are kept in the browser for a minute, so going back and forth between
    // tabs is instant instead of a server round trip each time. Any write refreshes them: api()
    // announces it (lib/api-client.ts) and components/nav/data-refresher.tsx calls router.refresh().
    staleTimes: { dynamic: 60, static: 300 },
  },
};

export default nextConfig;
