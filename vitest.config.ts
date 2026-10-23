import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    include: ["app/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["app/lib/server/**/*.ts", "app/api/**/*.ts"],
      exclude: ["app/lib/server/mockData.ts", "app/lib/server/types.ts", "**/*.test.ts"],
    },
  },
});
