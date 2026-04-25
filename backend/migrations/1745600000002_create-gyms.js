/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('gyms', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    name: { type: 'text', notNull: true },
    slug: { type: 'text', unique: true },
    join_qr_secret: { type: 'text', notNull: true },
    checkin_qr_secret: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    created_by: { type: 'uuid' },
  });

  pgm.addConstraint(
    'gyms',
    'gyms_created_by_fkey',
    'FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL',
  );
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('gyms', { cascade: true });
};
