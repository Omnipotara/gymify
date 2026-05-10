import { Client } from 'pg';

const email = process.argv[2];

if (!email) {
  console.error('Usage: node dist/db/promote-super-admin.js <email>');
  process.exit(1);
}

async function main() {
  const connectionString = process.env.DATABASE_PUBLIC_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_PUBLIC_URL or DATABASE_URL env var is required');
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const result = await client.query<{ email: string }>(
    'UPDATE users SET is_super_admin = true WHERE email = $1 RETURNING email',
    [email],
  );

  await client.end();

  if (!result.rowCount) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  console.log(`Promoted ${result.rows[0].email} to super admin`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
