import { defineConfig } from "prisma/config";

// Prisma 7: the datasource URL lives here, not in schema.prisma.
// If DATABASE_URL is not present in the process env, the default below applies.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
