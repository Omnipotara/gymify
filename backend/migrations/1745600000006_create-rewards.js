/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.createTable('reward_rules', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    gym_id: { type: 'uuid', notNull: true },
    type: { type: 'text', notNull: true },
    threshold: { type: 'integer', notNull: true },
    discount_percent: { type: 'integer', notNull: true },
    description: { type: 'text', notNull: true },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('reward_rules', 'reward_rules_gym_id_fkey', 'FOREIGN KEY (gym_id) REFERENCES gyms(id) ON DELETE CASCADE');
  pgm.addConstraint('reward_rules', 'reward_rules_type_check', "CHECK (type IN ('streak', 'milestone', 'comeback'))");
  pgm.addConstraint('reward_rules', 'reward_rules_threshold_check', 'CHECK (threshold >= 0)');
  pgm.addConstraint('reward_rules', 'reward_rules_discount_check', 'CHECK (discount_percent BETWEEN 1 AND 100)');
  pgm.createIndex('reward_rules', ['gym_id'], { name: 'idx_reward_rules_gym_id' });

  pgm.createTable('member_rewards', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true },
    gym_id: { type: 'uuid', notNull: true },
    rule_id: { type: 'uuid', notNull: true },
    earned_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    redeemed_at: { type: 'timestamptz' },
    redeemed_by: { type: 'uuid' },
  });

  pgm.addConstraint('member_rewards', 'member_rewards_user_id_fkey', 'FOREIGN KEY (user_id) REFERENCES users(id)');
  pgm.addConstraint('member_rewards', 'member_rewards_gym_id_fkey', 'FOREIGN KEY (gym_id) REFERENCES gyms(id)');
  pgm.addConstraint('member_rewards', 'member_rewards_rule_id_fkey', 'FOREIGN KEY (rule_id) REFERENCES reward_rules(id)');
  pgm.addConstraint('member_rewards', 'member_rewards_redeemed_by_fkey', 'FOREIGN KEY (redeemed_by) REFERENCES users(id)');

  pgm.createIndex('member_rewards', ['user_id', 'gym_id', { name: 'earned_at', sort: 'DESC' }], { name: 'idx_member_rewards_user_gym' });
  pgm.createIndex('member_rewards', ['gym_id', { name: 'earned_at', sort: 'DESC' }], { name: 'idx_member_rewards_gym' });
  pgm.createIndex('member_rewards', ['user_id', 'rule_id'], { name: 'idx_member_rewards_user_rule' });
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropTable('member_rewards', { cascade: true });
  pgm.dropTable('reward_rules', { cascade: true });
};
