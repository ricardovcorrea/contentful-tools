import type { Config } from "@react-router/dev/config";

export default {
  // SPA mode — all data fetching uses clientLoader and localStorage
  ssr: false,
} satisfies Config;
