import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../lib/api-client';
import {
  getPlatformStats,
  getAdminGyms,
  createGym,
  deleteGym,
  getAdminUsers,
  setGymRole,
  getGymAdmins,
  addGymAdmin,
  removeGymAdmin,
} from '../features/admin/api';
import type { AdminGym, AdminUser, AdminUserGym, GymAdmin } from '../features/admin/types';

// ── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl bg-white shadow-sm p-4 border border-gray-100">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

// ── Overview tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: getPlatformStats,
    refetchInterval: 30_000,
  });

  if (isLoading) return <p className="text-center text-gray-400 py-12">Loading…</p>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <StatCard label="Gyms" value={data.gym_count} />
      <StatCard label="Users" value={data.user_count} />
      <StatCard label="Active members" value={data.active_members} />
      <StatCard label="Check-ins today" value={data.checkins_today} />
      <StatCard label="Check-ins total" value={data.checkins_total} />
      <StatCard label="New users (7d)" value={data.new_users_this_week} />
    </div>
  );
}

// ── Gyms tab ─────────────────────────────────────────────────────────────────

function CreateGymForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => createGym(name.trim()),
    onSuccess: () => {
      setName('');
      setError('');
      onCreated();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to create gym'),
  });

  return (
    <div className="flex gap-2 items-start">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Gym name"
        className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        onKeyDown={(e) => e.key === 'Enter' && name.trim() && mutation.mutate()}
      />
      <button
        onClick={() => mutation.mutate()}
        disabled={!name.trim() || mutation.isPending}
        className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
      >
        {mutation.isPending ? 'Creating…' : '+ New Gym'}
      </button>
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}

function GymAdminPanel({ gym }: { gym: AdminGym }) {
  const queryClient = useQueryClient();
  const [addEmail, setAddEmail] = useState('');
  const [addError, setAddError] = useState('');

  const { data: admins, isLoading } = useQuery({
    queryKey: ['admin-gym-admins', gym.id],
    queryFn: () => getGymAdmins(gym.id),
  });

  const addMutation = useMutation({
    mutationFn: () => addGymAdmin(gym.id, addEmail.trim()),
    onSuccess: () => {
      setAddEmail('');
      setAddError('');
      queryClient.invalidateQueries({ queryKey: ['admin-gym-admins', gym.id] });
    },
    onError: (err) => setAddError(err instanceof ApiError ? err.message : 'Failed to add admin'),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeGymAdmin(gym.id, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-gym-admins', gym.id] }),
  });

  return (
    <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide pt-3 mb-2">Admins</p>
      {isLoading && <p className="text-xs text-gray-400 py-1">Loading…</p>}
      {admins && admins.length === 0 && (
        <p className="text-xs text-gray-400 py-1">No admins assigned yet.</p>
      )}
      {admins && admins.map((admin: GymAdmin) => (
        <div key={admin.id} className="flex items-center justify-between py-1">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-gray-800">{admin.full_name ?? admin.email}</span>
            {admin.full_name && <span className="text-xs text-gray-400 ml-1">({admin.email})</span>}
          </div>
          <button
            onClick={() => removeMutation.mutate(admin.id)}
            disabled={removeMutation.isPending}
            className="text-xs text-red-400 hover:text-red-600 hover:underline ml-3 disabled:opacity-50 shrink-0"
          >
            Remove
          </button>
        </div>
      ))}
      <div className="flex gap-2 mt-3">
        <input
          type="email"
          value={addEmail}
          onChange={(e) => { setAddEmail(e.target.value); setAddError(''); }}
          placeholder="user@email.com"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-1 text-xs focus:border-blue-500 focus:outline-none"
          onKeyDown={(e) => e.key === 'Enter' && addEmail.trim() && addMutation.mutate()}
        />
        <button
          onClick={() => addMutation.mutate()}
          disabled={!addEmail.trim() || addMutation.isPending}
          className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap"
        >
          {addMutation.isPending ? '…' : 'Add admin'}
        </button>
      </div>
      {addError && <p className="text-xs text-red-600 mt-1">{addError}</p>}
    </div>
  );
}

function GymRow({ gym }: { gym: AdminGym }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: () => deleteGym(gym.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gyms'] });
      queryClient.invalidateQueries({ queryKey: ['admin-stats'] });
    },
  });

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => setExpanded(!expanded)} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium text-gray-900 truncate">{gym.name}</p>
          <p className="text-xs text-gray-400">{gym.slug} · {gym.member_count} member{gym.member_count !== 1 ? 's' : ''}</p>
        </button>
        <div className="flex items-center gap-3 ml-4 shrink-0">
          <span className="text-xs text-gray-400">{gym.created_at.slice(0, 10)}</span>
          <button onClick={() => setExpanded(!expanded)} className="text-xs text-gray-400 hover:text-gray-600 w-4">
            {expanded ? '▲' : '▼'}
          </button>
          {confirming ? (
            <span className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Delete?</span>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="text-xs text-red-600 hover:underline disabled:opacity-50"
              >
                {deleteMutation.isPending ? '…' : 'Yes'}
              </button>
              <button onClick={() => setConfirming(false)} className="text-xs text-gray-400 hover:underline">No</button>
            </span>
          ) : (
            <button onClick={() => setConfirming(true)} className="text-xs text-red-400 hover:text-red-600 hover:underline">
              Delete
            </button>
          )}
        </div>
      </div>
      {expanded && <GymAdminPanel gym={gym} />}
    </div>
  );
}

function GymsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-gyms'],
    queryFn: getAdminGyms,
  });

  const filtered = (data?.items ?? []).filter((g) =>
    !search.trim() || g.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-3">
      <CreateGymForm onCreated={() => queryClient.invalidateQueries({ queryKey: ['admin-gyms'] })} />
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search gyms…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {data ? `${filtered.length} of ${data.items.length}` : ''}
        </span>
      </div>
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        {isLoading && <p className="text-center text-gray-400 py-8">Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-gray-400 py-8 text-sm">
            {search ? `No gyms match "${search}"` : 'No gyms yet.'}
          </p>
        )}
        {filtered.map((gym) => <GymRow key={gym.id} gym={gym} />)}
      </div>
    </div>
  );
}

// ── Users tab ─────────────────────────────────────────────────────────────────

function GymRoleRow({ entry, userId }: { entry: AdminUserGym; userId: string }) {
  const queryClient = useQueryClient();
  const [optimisticRole, setOptimisticRole] = useState<'admin' | 'member'>(entry.role);

  const mutation = useMutation({
    mutationFn: (role: 'admin' | 'member') => setGymRole(entry.gym_id, userId, role),
    onSuccess: (_, role) => {
      setOptimisticRole(role);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
  });

  const toggle = () => {
    const next = optimisticRole === 'admin' ? 'member' : 'admin';
    mutation.mutate(next);
  };

  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs text-gray-700 truncate mr-3">{entry.gym_name}</span>
      <button
        onClick={toggle}
        disabled={mutation.isPending}
        className={`text-xs px-2 py-0.5 rounded-full font-medium transition-colors disabled:opacity-50 ${
          optimisticRole === 'admin'
            ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        {optimisticRole}
      </button>
    </div>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-gray-100 last:border-0">
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-start justify-between px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.full_name ?? user.email}
            </p>
            {user.is_super_admin && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                super admin
              </span>
            )}
          </div>
          {user.full_name && <p className="text-xs text-gray-400 truncate">{user.email}</p>}
          <p className="text-xs text-gray-400">{user.gyms.length} gym{user.gyms.length !== 1 ? 's' : ''} · joined {user.created_at.slice(0, 10)}</p>
        </div>
        <span className="text-xs text-gray-400 ml-4 mt-0.5">{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-50 bg-gray-50">
          {user.gyms.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">Not a member of any gym.</p>
          ) : (
            <div className="pt-2 space-y-0.5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">Gym memberships</p>
              {user.gyms.map((entry) => (
                <GymRoleRow key={entry.gym_id} entry={entry} userId={user.id} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UsersTab() {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users'],
    queryFn: getAdminUsers,
  });

  const filtered = (data?.items ?? []).filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (u.full_name ?? '').toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Search users…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        />
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {data ? `${filtered.length} of ${data.items.length}` : ''}
        </span>
      </div>
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        {isLoading && <p className="text-center text-gray-400 py-8">Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-gray-400 py-8 text-sm">
            {search ? `No users match "${search}"` : 'No users yet.'}
          </p>
        )}
        {filtered.map((user) => <UserRow key={user.id} user={user} />)}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'gyms' | 'users';

export default function SuperAdminPage() {
  const [tab, setTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'gyms', label: 'Gyms' },
    { id: 'users', label: 'Users' },
  ];

  return (
    <main className="mx-auto max-w-3xl p-4 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">Platform Admin</h1>
        <p className="text-xs text-gray-400">Manage all gyms and users across Gymify.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab />}
      {tab === 'gyms' && <GymsTab />}
      {tab === 'users' && <UsersTab />}
    </main>
  );
}
