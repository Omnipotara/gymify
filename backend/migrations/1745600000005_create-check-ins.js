/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('check_ins', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: { type: 'uuid', notNull: true },
    gym_id: { type: 'uuid', notNull: true },
    checked_in_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint(
    'check_ins',
    'check_ins_user_id_fkey',
    'FOREIGN KEY (user_id) REFERENCES users(id)',
  );
  pgm.addConstraint(
    'check_ins',
    'check_ins_gym_id_fkey',
    'FOREIGN KEY (gym_id) REFERENCES gyms(id)',
  );

  // Dashboard: all check-ins at a gym, recent first
  pgm.createIndex(
    'check_ins',
    ['gym_id', { name: 'checked_in_at', sort: 'DESC' }],
    { name: 'idx_check_ins_gym_id_checked_in_at' },
  );

  // Personal history: user's check-ins at a specific gym
  pgm.createIndex(
    'check_ins',
    ['user_id', 'gym_id', { name: 'checked_in_at', sort: 'DESC' }],
    { name: 'idx_check_ins_user_gym_checked_in_at' },
  );
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('check_ins', { cascade: true });
};
