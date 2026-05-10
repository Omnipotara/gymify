import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
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

const inputCls =
  'rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground ' +
  'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-card border border-border p-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="font-heading text-4xl font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: getPlatformStats,
    refetchInterval: 30_000,
  });

  if (isLoading) return <p className="text-center text-muted-foreground py-12 text-sm">Loading…</p>;
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

// ── Gyms tab ──────────────────────────────────────────────────────────────────

function CreateGymForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => createGym(name.trim()),
    onSuccess: () => { setName(''); setError(''); onCreated(); },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Failed to create gym'),
  });

  return (
    <div className="space-y-1">
      <div className="flex gap-2 items-start">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Gym name"
          className={inputCls + ' flex-1'}
          onKeyDown={(e) => e.key === 'Enter' && name.trim() && mutation.mutate()}
        />
        <button
          onClick={() => mutation.mutate()}
          disabled={!name.trim() || mutation.isPending}
          className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium
            text-primary-foreground hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          {mutation.isPending ? 'Creating…' : 'New Gym'}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
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
    <div className="px-4 pb-4 pt-3 bg-muted/50 border-t border-border space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Admins</p>
      {isLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {admins && admins.length === 0 && (
        <p className="text-xs text-muted-foreground">No admins assigned yet.</p>
      )}
      {admins && admins.map((admin: GymAdmin) => (
        <div key={admin.id} className="flex items-center justify-between">
          <div className="min-w-0 flex-1">
            <span className="text-xs font-medium text-foreground">{admin.full_name ?? admin.email}</span>
            {admin.full_name && (
              <span className="text-xs text-muted-foreground ml-1.5">({admin.email})</span>
            )}
          </div>
          <button
            onClick={() => removeMutation.mutate(admin.id)}
            disabled={removeMutation.isPending}
            className="text-xs text-destructive hover:underline ml-3 disabled:opacity-50 shrink-0"
          >
            Remove
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <input
          type="email"
          value={addEmail}
          onChange={(e) => { setAddEmail(e.target.value); setAddError(''); }}
          placeholder="user@email.com"
          className={inputCls + ' flex-1 py-1 text-xs'}
          onKeyDown={(e) => e.key === 'Enter' && addEmail.trim() && addMutation.mutate()}
        />
        <button
          onClick={() => addMutation.mutate()}
          disabled={!addEmail.trim() || addMutation.isPending}
          className="rounded-lg bg-primary px-3 py-1 text-xs font-medium text-primary-foreground
            hover:bg-primary/90 disabled:opacity-50 whitespace-nowrap"
        >
          {addMutation.isPending ? '…' : 'Add'}
        </button>
      </div>
      {addError && <p className="text-xs text-destructive">{addError}</p>}
    </div>
  );
}

function GymRow({ gym }: { gym: AdminGym }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
    <div className={`border-b-2 last:border-b-0 ${expanded ? 'border-primary/40' : 'border-border'}`}>
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <button onClick={() => setExpanded(!expanded)} className="min-w-0 flex-1 text-left">
          <p className="text-sm font-medium text-foreground truncate">{gym.name}</p>
          <p className="text-xs text-muted-foreground">
            {gym.slug} · {gym.member_count} member{gym.member_count !== 1 ? 's' : ''}
          </p>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {gym.created_at.slice(0, 10)}
          </span>
          <button
            onClick={() => navigate(`/gyms/${gym.id}/admin`)}
            className="text-xs text-primary hover:underline whitespace-nowrap flex items-center gap-1"
            title="Open gym admin panel"
          >
            <ExternalLink className="w-3 h-3" />
            <span className="hidden sm:inline">Open</span>
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {confirming ? (
            <span className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">Delete?</span>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="text-xs text-destructive hover:underline disabled:opacity-50"
              >
                {deleteMutation.isPending ? '…' : 'Yes'}
              </button>
              <button onClick={() => setConfirming(false)} className="text-xs text-muted-foreground hover:underline">
                No
              </button>
            </span>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="text-xs text-destructive hover:underline"
            >
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

  const filtered = (data?.items ?? []).filter(
    (g) => !search.trim() || g.name.toLowerCase().includes(search.toLowerCase()),
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
          className={inputCls + ' flex-1'}
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {data ? `${filtered.length} of ${data.items.length}` : ''}
        </span>
      </div>
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        {isLoading && <p className="text-center text-muted-foreground py-8 text-sm">Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">
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

  return (
    <div className="flex items-center justify-between py-1 gap-3">
      <span className="text-xs text-foreground truncate">{entry.gym_name}</span>
      <button
        onClick={() => mutation.mutate(optimisticRole === 'admin' ? 'member' : 'admin')}
        disabled={mutation.isPending}
        className={`text-xs px-2.5 py-0.5 rounded-full font-medium transition-colors disabled:opacity-50 shrink-0 ${
          optimisticRole === 'admin'
            ? 'bg-primary/10 text-primary hover:bg-primary/20'
            : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
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
    <div className={`border-b-2 last:border-b-0 ${expanded ? 'border-primary/40' : 'border-border'}`}>
      <div
        onClick={() => setExpanded(!expanded)}
        className="flex items-start justify-between px-4 py-3 gap-3 cursor-pointer
          hover:bg-secondary/50 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground truncate">
              {user.full_name ?? user.email}
            </p>
            {user.is_super_admin && (
              <span className="text-[10px] font-semibold uppercase tracking-wide
                text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                super admin
              </span>
            )}
          </div>
          {user.full_name && (
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          )}
          <p className="text-xs text-muted-foreground">
            {user.gyms.length} gym{user.gyms.length !== 1 ? 's' : ''} · joined {user.created_at.slice(0, 10)}
          </p>
        </div>
        <span className="shrink-0 mt-0.5 text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </div>

      {expanded && (
        <div className="px-4 pb-3 pt-2 border-t border-border bg-muted/50">
          {user.gyms.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">Not a member of any gym.</p>
          ) : (
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                Gym memberships
              </p>
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
    if (u.is_super_admin) return false;
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
          className={inputCls + ' flex-1'}
        />
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {data ? `${filtered.length} of ${data.items.length}` : ''}
        </span>
      </div>
      <div className="rounded-2xl bg-card border border-border overflow-hidden">
        {isLoading && <p className="text-center text-muted-foreground py-8 text-sm">Loading…</p>}
        {!isLoading && filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-8 text-sm">
            {search ? `No users match "${search}"` : 'No users yet.'}
          </p>
        )}
        {filtered.map((user) => <UserRow key={user.id} user={user} />)}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
        <h1 className="font-heading text-3xl font-bold text-foreground">Platform Admin</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Manage all gyms and users across Gymify.</p>
      </div>

      <div className="flex gap-0 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
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
