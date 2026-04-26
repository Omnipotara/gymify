import 'dotenv/config';
import argon2 from 'argon2';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import { pool } from './client';
import { signQrPayload } from '../lib/qr';

function tsAt(daysAgo: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      'TRUNCATE check_ins, memberships, user_gyms, gyms, users RESTART IDENTITY CASCADE',
    );

    // Super-admin
    const superHash = await argon2.hash('superadmin123');
    const { rows: [superAdmin] } = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, is_super_admin)
       VALUES ($1, $2, 'Super Admin', true) RETURNING id`,
      ['superadmin@gymify.dev', superHash],
    );

    // Demo gym
    const joinSecret = crypto.randomBytes(32).toString('hex');
    const checkinSecret = crypto.randomBytes(32).toString('hex');
    const { rows: [gym] } = await client.query<{ id: string }>(
      `INSERT INTO gyms (name, slug, join_qr_secret, checkin_qr_secret, created_by)
       VALUES ('Demo Gym', 'demo-gym', $1, $2, $3) RETURNING id`,
      [joinSecret, checkinSecret, superAdmin.id],
    );

    // Admin user
    const adminHash = await argon2.hash('admin123');
    const { rows: [admin] } = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, 'Gym Admin') RETURNING id`,
      ['admin@gymify.dev', adminHash],
    );
    await client.query(
      `INSERT INTO user_gyms (user_id, gym_id, role) VALUES ($1, $2, 'admin')`,
      [admin.id, gym.id],
    );

    // ── Members ───────────────────────────────────────────────────────────────

    const memberHash = await argon2.hash('member123');

    // Alice Smith — active member, morning person, ~3 visits/week
    const { rows: [alice] } = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id`,
      ['alice@gymify.dev', memberHash, 'Alice Smith'],
    );
    await client.query(`INSERT INTO user_gyms (user_id, gym_id, role) VALUES ($1, $2, 'member')`, [alice.id, gym.id]);
    await client.query(
      `INSERT INTO memberships (user_id, gym_id, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [alice.id, gym.id, dateOffset(-30), dateOffset(60), admin.id],
    );

    // Bob Jones — irregular member, evening person, ~1 visit/week
    const { rows: [bob] } = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id`,
      ['bob@gymify.dev', memberHash, 'Bob Jones'],
    );
    await client.query(`INSERT INTO user_gyms (user_id, gym_id, role) VALUES ($1, $2, 'member')`, [bob.id, gym.id]);
    await client.query(
      `INSERT INTO memberships (user_id, gym_id, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [bob.id, gym.id, dateOffset(-20), dateOffset(40), admin.id],
    );

    // Charlie Brown — inactive member (active membership, no visit in 22 days)
    const { rows: [charlie] } = await client.query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id`,
      ['charlie@gymify.dev', memberHash, 'Charlie Brown'],
    );
    await client.query(`INSERT INTO user_gyms (user_id, gym_id, role) VALUES ($1, $2, 'member')`, [charlie.id, gym.id]);
    await client.query(
      `INSERT INTO memberships (user_id, gym_id, start_date, end_date, created_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [charlie.id, gym.id, dateOffset(-45), dateOffset(20), admin.id],
    );

    // ── Check-ins ─────────────────────────────────────────────────────────────

    // Alice: consistent mornings, Mon/Wed/Fri rhythm — 12 visits over 30 days
    // Last 7 days: 3 visits → ACTIVE (2+ per week)
    const aliceCheckIns: [number, number, number][] = [
      [1, 8, 0], [3, 7, 30], [5, 8, 15],      // this week (3 visits — active ✓)
      [8, 9, 0], [10, 7, 45], [12, 8, 0],      // last week
      [15, 9, 30], [17, 7, 30], [19, 8, 15],   // 2 weeks ago
      [22, 8, 0], [24, 7, 45], [26, 8, 30],    // 3 weeks ago
    ];

    // Bob: irregular evenings — 7 visits over 30 days
    // Last 7 days: 1 visit → not "active" but not inactive either
    const bobCheckIns: [number, number, number][] = [
      [2, 18, 0],                               // this week (1 visit only)
      [7, 17, 30], [9, 18, 15],                 // last week
      [14, 10, 0],                              // 2 weeks ago (Sunday morning)
      [16, 18, 0],                              // 2 weeks ago
      [21, 17, 45],                             // 3 weeks ago
      [27, 18, 30],                             // 4 weeks ago
    ];

    // Charlie: dropped off — last visit 22 days ago → INACTIVE (needs attention ✓)
    const charlieCheckIns: [number, number, number][] = [
      [22, 11, 0],
      [25, 10, 30],
      [29, 11, 15],
    ];

    for (const [daysAgo, hour, minute] of aliceCheckIns) {
      await client.query(
        `INSERT INTO check_ins (user_id, gym_id, checked_in_at) VALUES ($1, $2, $3)`,
        [alice.id, gym.id, tsAt(daysAgo, hour, minute)],
      );
    }
    for (const [daysAgo, hour, minute] of bobCheckIns) {
      await client.query(
        `INSERT INTO check_ins (user_id, gym_id, checked_in_at) VALUES ($1, $2, $3)`,
        [bob.id, gym.id, tsAt(daysAgo, hour, minute)],
      );
    }
    for (const [daysAgo, hour, minute] of charlieCheckIns) {
      await client.query(
        `INSERT INTO check_ins (user_id, gym_id, checked_in_at) VALUES ($1, $2, $3)`,
        [charlie.id, gym.id, tsAt(daysAgo, hour, minute)],
      );
    }

    await client.query('COMMIT');

    // ── QR codes ──────────────────────────────────────────────────────────────

    const joinPayload = signQrPayload('join', gym.id, joinSecret);
    const checkinPayload = signQrPayload('checkin', gym.id, checkinSecret);

    const outDir = path.join(process.cwd(), 'seed-output');
    fs.mkdirSync(outDir, { recursive: true });
    await QRCode.toFile(path.join(outDir, 'join-qr.png'), JSON.stringify(joinPayload), { width: 300 });
    await QRCode.toFile(path.join(outDir, 'checkin-qr.png'), JSON.stringify(checkinPayload), { width: 300 });

    console.log('\n✅  Seed complete\n');
    console.log('━━━ Credentials ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Super admin  superadmin@gymify.dev  /  superadmin123');
    console.log('Admin        admin@gymify.dev       /  admin123');
    console.log('Members      alice / bob / charlie @gymify.dev  /  member123');
    console.log('\n━━━ Expected analytics ━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Active this week (2+ visits):  Alice Smith');
    console.log('Needs attention (14+ days):    Charlie Brown');
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
