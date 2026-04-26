/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = (pgm) => {
  pgm.dropConstraint('member_rewards', 'member_rewards_rule_id_fkey');
  pgm.addConstraint(
    'member_rewards',
    'member_rewards_rule_id_fkey',
    'FOREIGN KEY (rule_id) REFERENCES reward_rules(id) ON DELETE CASCADE',
  );
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = (pgm) => {
  pgm.dropConstraint('member_rewards', 'member_rewards_rule_id_fkey');
  pgm.addConstraint(
    'member_rewards',
    'member_rewards_rule_id_fkey',
    'FOREIGN KEY (rule_id) REFERENCES reward_rules(id)',
  );
};
