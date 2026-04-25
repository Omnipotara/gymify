/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('memberships', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('gen_random_uuid()'),
    },
    user_id: { type: 'uuid', notNull: true },
    gym_id: { type: 'uuid', notNull: true },
    start_date: { type: 'date', notNull: true },
    end_date: { type: 'date', notNull: true },
    created_by: { type: 'uuid' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint(
    'memberships',
    'memberships_user_id_fkey',
    'FOREIGN KEY (user_id) REFERENCES users(id)',
  );
  pgm.addConstraint(
    'memberships',
    'memberships_gym_id_fkey',
    'FOREIGN KEY (gym_id) REFERENCES gyms(id)',
  );
  pgm.addConstraint(
    'memberships',
    'memberships_created_by_fkey',
    'FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL',
  );

  // "find current membership for user at gym"
  pgm.createIndex(
    'memberships',
    ['user_id', 'gym_id', { name: 'end_date', sort: 'DESC' }],
    { name: 'idx_memberships_user_gym_end_date' },
  );
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('memberships', { cascade: true });
};
