import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getRules, createRule, updateRule, deleteRule, getAllRewards, redeemReward } from '../features/rewards/api';
import { ApiError } from '../lib/api-client';
import type { RewardType, RewardRule, CreateRewardRulePayload } from '../features/rewards/types';

const TYPE_LABELS: Record<RewardType, string> = {
  milestone: 'Milestone',
  streak: 'Streak',
  comeback: 'Comeback',
};

const TYPE_HINT: Record<RewardType, string> = {
  milestone: 'Total visits to reach',
  streak: 'Consecutive weeks (2+ visits each)',
  comeback: 'Days away before returning',
};

function thresholdLabel(type: RewardType, threshold: number): string {
  if (type === 'milestone') return `${threshold} total visits`;
  if (type === 'streak') return `${threshold} week streak`;
  return threshold === 0 ? 'disabled' : `${threshold} days away`;
}

function RuleForm({
  gymId,
  initial,
  onSave,
  onCancel,
  saveLabel,
}: {
  gymId: string;
  initial: CreateRewardRulePayload;
  onSave: (data: CreateRewardRulePayload) => void;
  onCancel: () => void;
  saveLabel: string;
}) {
  const [form, setForm] = useState<CreateRewardRulePayload>(initial);
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as RewardType })}
            className="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="milestone">Milestone</option>
            <option value="streak">Streak</option>
            <option value="comeback">Comeback</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">{TYPE_HINT[form.type]}</label>
          <input
            type="number"
            min={form.type === 'comeback' ? 0 : 1}
            value={form.threshold}
            onChange={(e) => setForm({ ...form, threshold: Number(e.target.value) })}
            className="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Discount %</label>
          <input
            type="number"
            min={1}
            max={100}
            value={form.discount_percent}
            onChange={(e) => setForm({ ...form, discount_percent: Number(e.target.value) })}
            className="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">Description shown to member</label>
          <input
            type="text"
            placeholder="e.g. 10% off next month"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="mt-0.5 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave(form)}
          disabled={!form.description.trim()}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saveLabel}
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function RuleCard({ gymId, rule }: { gymId: string; rule: RewardRule }) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<'view' | 'edit' | 'confirmDelete'>('view');
  const [error, setError] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data: CreateRewardRulePayload) => updateRule(gymId, rule.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reward-rules', gymId] });
      queryClient.invalidateQueries({ queryKey: ['all-rewards', gymId] });
      setMode('view');
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to save'),
  });

  const toggleMutation = useMutation({
    mutationFn: (is_active: boolean) => updateRule(gymId, rule.id, { is_active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reward-rules', gymId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteRule(gymId, rule.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reward-rules', gymId] });
      queryClient.invalidateQueries({ queryKey: ['all-rewards', gymId] });
    },
  });

  return (
    <div className={`rounded-xl bg-white shadow-sm overflow-hidden ${!rule.is_active && mode === 'view' ? 'opacity-50' : ''}`}>
      {mode === 'view' && (
        <div className="p-4 flex items-start justify-between gap-3">
          <div className="space-y-0.5 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{rule.description}</p>
            <p className="text-xs text-gray-500">
              {TYPE_LABELS[rule.type]} · {thresholdLabel(rule.type, rule.threshold)} · {rule.discount_percent}% off
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => toggleMutation.mutate(!rule.is_active)}
              disabled={toggleMutation.isPending}
              className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                rule.is_active
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {rule.is_active ? 'Active' : 'Inactive'}
            </button>
            <button
              onClick={() => { setMode('edit'); setError(''); }}
              className="text-xs text-blue-600 hover:underline"
            >
              Edit
            </button>
            <button
              onClick={() => setMode('confirmDelete')}
              className="text-xs text-red-500 hover:underline"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {mode === 'edit' && (
        <div className="p-4 space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Edit Rule</p>
          <RuleForm
            gymId={gymId}
            initial={{ type: rule.type, threshold: rule.threshold, discount_percent: rule.discount_percent, description: rule.description }}
            onSave={(data) => updateMutation.mutate(data)}
            onCancel={() => setMode('view')}
            saveLabel={updateMutation.isPending ? 'Saving…' : 'Save'}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      )}

      {mode === 'confirmDelete' && (
        <div className="p-4 flex items-center justify-between gap-3">
          <p className="text-sm text-gray-700">
            Delete <span className="font-medium">"{rule.description}"</span>? This removes all pending rewards earned under this rule.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
            </button>
            <button
              onClick={() => setMode('view')}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RewardsAdminPage() {
  const { gymId } = useParams<{ gymId: string }>();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [createError, setCreateError] = useState('');

  const { data: rulesData, isLoading: rulesLoading } = useQuery({
    queryKey: ['reward-rules', gymId],
    queryFn: () => getRules(gymId!),
    enabled: !!gymId,
  });

  const { data: rewardsData, isLoading: rewardsLoading } = useQuery({
    queryKey: ['all-rewards', gymId],
    queryFn: () => getAllRewards(gymId!),
    enabled: !!gymId,
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateRewardRulePayload) => createRule(gymId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reward-rules', gymId] });
      setShowCreate(false);
      setCreateError('');
    },
    onError: (err) => setCreateError(err instanceof ApiError ? err.message : 'Failed to create rule'),
  });

  const redeemMutation = useMutation({
    mutationFn: (rewardId: string) => redeemReward(gymId!, rewardId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['all-rewards', gymId] }),
  });

  const pendingRewards = rewardsData?.items.filter((r) => !r.redeemed_at) ?? [];
  const redeemedRewards = rewardsData?.items.filter((r) => r.redeemed_at) ?? [];

  return (
    <main className="mx-auto max-w-lg p-4 space-y-6">
        {/* ── Reward Rules ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-gray-500">Reward Rules</h2>
            {!showCreate && (
              <button onClick={() => { setShowCreate(true); setCreateError(''); }} className="text-sm text-blue-600 hover:underline">
                + New Rule
              </button>
            )}
          </div>

          {showCreate && (
            <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
              <p className="text-sm font-semibold text-gray-800">New Reward Rule</p>
              <RuleForm
                gymId={gymId!}
                initial={{ type: 'milestone', threshold: 10, discount_percent: 10, description: '' }}
                onSave={(data) => createMutation.mutate(data)}
                onCancel={() => setShowCreate(false)}
                saveLabel={createMutation.isPending ? 'Saving…' : 'Create Rule'}
              />
              {createError && <p className="text-xs text-red-600">{createError}</p>}
            </div>
          )}

          {rulesLoading && <p className="text-center text-gray-400 py-4">Loading…</p>}

          {rulesData?.items.length === 0 && !showCreate && (
            <p className="text-center text-gray-400 py-4 text-sm">
              No rules yet. Create one to start rewarding members.
            </p>
          )}

          {rulesData?.items.map((rule) => (
            <RuleCard key={rule.id} gymId={gymId!} rule={rule} />
          ))}
        </section>

        {/* ── Pending Rewards ── */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-gray-500">
            Pending Redemption{pendingRewards.length > 0 && ` (${pendingRewards.length})`}
          </h2>

          {rewardsLoading && <p className="text-center text-gray-400 py-4">Loading…</p>}

          {!rewardsLoading && pendingRewards.length === 0 && (
            <p className="text-center text-gray-400 py-4 text-sm">No unredeemed rewards.</p>
          )}

          {pendingRewards.map((reward) => (
            <div key={reward.id} className="rounded-xl bg-white p-4 shadow-sm flex items-start justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <p className="text-sm font-medium text-gray-900">{reward.member_name ?? reward.member_email}</p>
                {reward.member_name && <p className="text-xs text-gray-400">{reward.member_email}</p>}
                <p className="text-xs text-gray-600">{reward.rule_description} · {reward.discount_percent}% off</p>
                <p className="text-xs text-gray-400">Earned {new Date(reward.earned_at).toLocaleDateString()}</p>
              </div>
              <button
                onClick={() => redeemMutation.mutate(reward.id)}
                disabled={redeemMutation.isPending}
                className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Redeem
              </button>
            </div>
          ))}
        </section>

        {/* ── Redeemed Rewards ── */}
        {redeemedRewards.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-gray-500">Redeemed</h2>
            {redeemedRewards.map((reward) => (
              <div key={reward.id} className="rounded-xl bg-white p-4 shadow-sm opacity-60">
                <p className="text-sm text-gray-700">
                  {reward.member_name ?? reward.member_email} · {reward.rule_description}
                </p>
                <p className="text-xs text-gray-400">
                  Redeemed {new Date(reward.redeemed_at!).toLocaleDateString()}
                </p>
              </div>
            ))}
          </section>
        )}
      </main>
  );
}
