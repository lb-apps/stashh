import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // config.ts validates the environment at import time; give it a complete, inert one.
    env: {
      NODE_ENV: "test",
      LOG_LEVEL: "fatal",
      OPENROUTER_API_KEY: "test",
      GOOGLE_PLACES_API_KEY: "test",
      SUPABASE_URL: "http://127.0.0.1:54321",
    },
  },
});
