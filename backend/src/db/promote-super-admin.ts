import 'dotenv/config';
import { pool } from './client';

const email = process.argv[2];

if (!email) {
  console.error('Usage: node dist/db/promote-super-admin.js <email>');
  process.exit(1);
}

async function main() {
  const result = await pool.query<{ email: string }>(
    'UPDATE users SET is_super_admin = true WHERE email = $1 RETURNING email',
    [email],
  );

  if (!result.rowCount) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  console.log(`✓ Promoted ${result.rows[0].email} to super admin`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
