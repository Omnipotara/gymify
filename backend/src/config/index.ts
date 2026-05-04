import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  QR_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'QR_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)'),
  ALLOWED_ORIGIN: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  RESEND_API_KEY: z.string().optional(),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  console.error('Invalid environment variables:');
  console.error(result.error.flatten().fieldErrors);
  process.exit(1);
}

const env = result.data;

export const config = {
  port: parseInt(env.PORT, 10),
  databaseUrl: env.DATABASE_URL,
  jwtSecret: env.JWT_SECRET,
  qrEncryptionKey: Buffer.from(env.QR_ENCRYPTION_KEY, 'hex'),
  allowedOrigin: env.ALLOWED_ORIGIN,
  nodeEnv: env.NODE_ENV,
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  resendApiKey: env.RESEND_API_KEY,
} as const;
