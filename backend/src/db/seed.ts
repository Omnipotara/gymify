import 'dotenv/config';
import argon2 from 'argon2';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { pool } from './client';
import { signQrPayload } from '../lib/qr';

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      'TRUNCATE check_ins, memberships, user_gyms, gyms, users RESTART IDENTITY CASCADE',
    );

    // Super-admin
    const superHash = await argon2.hash('superadmin123');
    const {
      rows: [superAdmin],
    } = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, is_super_admin)
       VALUES ($1, $2, 'Super Admin', true) RETURNING id`,
      ['superadmin@gymify.dev', superHash],
    );

    // Demo gym
    const joinSecret = crypto.randomBytes(32).toString('hex');
    const checkinSecret = crypto.randomBytes(32).toString('hex');
    const {
      rows: [gym],
    } = await client.query<{ id: string }>(
      `INSERT INTO gyms (name, slug, join_qr_secret, checkin_qr_secret, created_by)
       VALUES ('Demo Gym', 'demo-gym', $1, $2, $3) RETURNING id`,
      [joinSecret, checkinSecret, superAdmin.id],
    );

    // Admin user
    const adminHash = await argon2.hash('admin123');
    const {
      rows: [admin],
    } = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, 'Gym Admin') RETURNING id`,
      ['admin@gymify.dev', adminHash],
    );
    await client.query(`INSERT INTO user_gyms (user_id, gym_id, role) VALUES ($1, $2, 'admin')`, [
      admin.id,
      gym.id,
    ]);

    // Member users
    const memberHash = await argon2.hash('member123');
    const memberDefs = [
      { email: 'alice@gymify.dev', name: 'Alice Smith' },
      { email: 'bob@gymify.dev', name: 'Bob Jones' },
      { email: 'charlie@gymify.dev', name: 'Charlie Brown' },
    ];

    const memberIds: string[] = [];
    for (const m of memberDefs) {
      const {
        rows: [member],
      } = await client.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id`,
        [m.email, memberHash, m.name],
      );
      await client.query(
        `INSERT INTO user_gyms (user_id, gym_id, role) VALUES ($1, $2, 'member')`,
        [member.id, gym.id],
      );
      memberIds.push(member.id);
    }

    // Check-ins spread over the past week (9am each day)
    const checkInDefs = [
      { userId: memberIds[0], daysAgo: 1 },
      { userId: memberIds[0], daysAgo: 3 },
      { userId: memberIds[0], daysAgo: 5 },
      { userId: memberIds[1], daysAgo: 0 },
      { userId: memberIds[1], daysAgo: 2 },
      { userId: memberIds[2], daysAgo: 4 },
    ];

    for (const ci of checkInDefs) {
      const ts = new Date();
      ts.setDate(ts.getDate() - ci.daysAgo);
      ts.setHours(9, 0, 0, 0);
      await client.query(
        `INSERT INTO check_ins (user_id, gym_id, checked_in_at) VALUES ($1, $2, $3)`,
        [ci.userId, gym.id, ts.toISOString()],
      );
    }

    await client.query('COMMIT');

    // Generate QR payloads and images
    const joinPayload = signQrPayload('join', gym.id, joinSecret);
    const checkinPayload = signQrPayload('checkin', gym.id, checkinSecret);

    const outDir = path.join(process.cwd(), 'seed-output');
    fs.mkdirSync(outDir, { recursive: true });
    await QRCode.toFile(path.join(outDir, 'join-qr.png'), JSON.stringify(joinPayload), {
      width: 300,
    });
    await QRCode.toFile(
      path.join(outDir, 'checkin-qr.png'),
      JSON.stringify(checkinPayload),
      { width: 300 },
    );

    console.log('\n✅  Seed complete\n');
    console.log('━━━ Credentials ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Super admin  superadmin@gymify.dev  /  superadmin123');
    console.log('Admin        admin@gymify.dev       /  admin123');
    console.log('Members      alice / bob / charlie @gymify.dev  /  member123');
    console.log('\n━━━ Demo Gym ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Gym ID:', gym.id);
    console.log('\n━━━ QR Payloads ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Join:    ', JSON.stringify(joinPayload));
    console.log('Check-in:', JSON.stringify(checkinPayload));
    console.log('\n📁 QR images → backend/seed-output/\n');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
