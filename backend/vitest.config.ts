import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      // Provide required env vars for tests that transitively import config.
      // These values are for testing only and carry no security significance.
      QR_ENCRYPTION_KEY: 'a4f82c3d9e1b7056c8d4f2a3e9b1c7d5f8a2e4c6d9b3f7a1e5c8d2f4b6a9e3c7',
      JWT_SECRET: 'test_jwt_secret_at_least_32_chars_long_x',
      DATABASE_URL: 'postgres://test:test@localhost/test',
      ALLOWED_ORIGIN: 'http://localhost:5173',
    },
  },
});
