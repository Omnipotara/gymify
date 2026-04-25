/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('user_gyms', {
    user_id: { type: 'uuid', notNull: true },
    gym_id: { type: 'uuid', notNull: true },
    role: { type: 'text', notNull: true },
    joined_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('user_gyms', 'user_gyms_pkey', 'PRIMARY KEY (user_id, gym_id)');
  pgm.addConstraint(
    'user_gyms',
    'user_gyms_user_id_fkey',
    'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE',
  );
  pgm.addConstraint(
    'user_gyms',
    'user_gyms_gym_id_fkey',
    'FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE',
  );
  pgm.addConstraint(
    'user_gyms',
    'user_gyms_role_check',
    "CHECK (role IN ('member', 'admin'))",
  );

  // "list all members of this gym"
  pgm.createIndex('user_gyms', 'gym_id', { name: 'idx_user_gyms_gym_id' });
  // "list all gyms this user belongs to"
  pgm.createIndex('user_gyms', 'user_id', { name: 'idx_user_gyms_user_id' });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('user_gyms', { cascade: true });
};
