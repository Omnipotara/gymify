import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    globalSetup: ['./src/test/global-setup.ts'],
    // Run all integration test files serially in one worker to share DB state cleanly
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 15_000,
    env: {
      QR_ENCRYPTION_KEY: 'a4f82c3d9e1b7056c8d4f2a3e9b1c7d5f8a2e4c6d9b3f7a1e5c8d2f4b6a9e3c7',
      JWT_SECRET: 'test_jwt_secret_at_least_32_chars_long_x',
      DATABASE_URL: 'postgres://gymify_test:gymify_test@localhost:5433/gymify_test',
      ALLOWED_ORIGIN: 'http://localhost:5173',
      NODE_ENV: 'test',
    },
  },
});
