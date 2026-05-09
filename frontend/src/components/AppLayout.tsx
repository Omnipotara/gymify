import { Outlet, NavLink, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Home,
  Users,
  BarChart3,
  Gift,
  User,
  QrCode,
  Shield,
  Dumbbell,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../lib/auth-context';
import { getMyGyms } from '../features/gyms/api';
import { ThemeToggle } from './ThemeToggle';
import { cn } from '../lib/utils';

interface TabItem {
  to: string;
  icon: React.ElementType;
  label: string;
  end?: boolean;
  extraActivePaths?: string[];
}

function SidebarNavItem({ to, icon: Icon, label, end = false, extraActivePaths = [] }: TabItem) {
  const { pathname } = useLocation();
  const extraActive = extraActivePaths.some((p) => pathname.startsWith(p));
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
          isActive || extraActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
        )
      }
    >
      <Icon className="w-4 h-4 shrink-0" />
      {label}
    </NavLink>
  );
}

function BottomTab({ to, icon: Icon, label, end = false, extraActivePaths = [] }: TabItem) {
  const { pathname } = useLocation();
  const extraActive = extraActivePaths.some((p) => pathname.startsWith(p));
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex flex-col items-center gap-1 flex-1 py-2 rounded-xl transition-colors',
          isActive || extraActive ? 'text-primary' : 'text-muted-foreground',
        )
      }
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-medium leading-none">{label}</span>
    </NavLink>
  );
}

export default function AppLayout() {
  const { gymId } = useParams<{ gymId?: string }>();
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  const { data: gymsData } = useQuery({
    queryKey: ['my-gyms'],
    queryFn: getMyGyms,
  });

  const gym = gymsData?.gyms.find((g) => g.id === gymId);
  const isAdmin = gym?.role === 'admin';
  const isMember = gym?.role === 'member';

  const contextItems: TabItem[] =
    gymId && isAdmin
      ? [
          { to: `/gyms/${gymId}/admin`, icon: Users, label: 'Members', end: true, extraActivePaths: [`/gyms/${gymId}/admin/members/`] },
          { to: `/gyms/${gymId}/admin/analytics`, icon: BarChart3, label: 'Analytics' },
          { to: `/gyms/${gymId}/admin/rewards`, icon: Gift, label: 'Rewards' },
        ]
      : gymId && isMember
      ? [{ to: `/gyms/${gymId}`, icon: QrCode, label: 'Check In', end: true }]
      : [];

  const sidebarItems: TabItem[] = gymId
    ? [
        { to: '/gyms', icon: Home, label: 'My Gyms', end: true },
        ...contextItems,
        { to: '/profile', icon: User, label: 'Profile' },
      ]
    : user?.is_super_admin
    ? [
        { to: '/super-admin', icon: Shield, label: 'Super Admin' },
        { to: '/profile', icon: User, label: 'Profile' },
      ]
    : [
        { to: '/gyms', icon: Home, label: 'My Gyms', end: true },
        { to: '/profile', icon: User, label: 'Profile' },
      ];

  const bottomTabs: TabItem[] =
    gymId && isAdmin
      ? [
          { to: `/gyms/${gymId}/admin`, icon: Users, label: 'Members', end: true, extraActivePaths: [`/gyms/${gymId}/admin/members/`] },
          { to: `/gyms/${gymId}/admin/analytics`, icon: BarChart3, label: 'Stats' },
          { to: `/gyms/${gymId}/admin/rewards`, icon: Gift, label: 'Rewards' },
          { to: '/profile', icon: User, label: 'Profile' },
        ]
      : gymId && isMember
      ? [
          { to: '/gyms', icon: Home, label: 'My Gyms', end: true },
          { to: `/gyms/${gymId}`, icon: QrCode, label: 'Check In', end: true },
          { to: '/profile', icon: User, label: 'Profile' },
        ]
      : user?.is_super_admin
      ? [
          { to: '/super-admin', icon: Shield, label: 'Admin' },
          { to: '/profile', icon: User, label: 'Profile' },
        ]
      : [
          { to: '/gyms', icon: Dumbbell, label: 'Gyms', end: true },
          { to: '/profile', icon: User, label: 'Profile' },
        ];

  const mobileTitle = (() => {
    if (pathname === '/profile') return 'Profile';
    if (pathname === '/super-admin') return 'Super Admin';
    if (pathname === '/gyms') return 'My Gyms';
    if (gymId && gym) {
      if (pathname.includes('/admin/members/')) return 'Member';
      if (pathname.endsWith('/admin/analytics')) return 'Analytics';
      if (pathname.endsWith('/admin/rewards')) return 'Rewards';
      return gym.name;
    }
    return 'Gymify';
  })();

  return (
    <div className="min-h-screen bg-background">
      {/* ── Desktop sidebar ── */}
      <nav className="hidden md:flex w-60 flex-col fixed inset-y-0 left-0 bg-card border-r border-border z-40">
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Dumbbell className="w-5 h-5 text-primary" />
            <span className="font-heading text-xl font-bold tracking-tight">Gymify</span>
          </div>
          {gym && <p className="text-xs text-muted-foreground mt-1 truncate">{gym.name}</p>}
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {sidebarItems.map((item) => (
            <SidebarNavItem key={item.to + item.label} {...item} />
          ))}
        </div>

        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{user?.full_name ?? user?.email}</p>
              {user?.full_name && (
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              )}
              <button
                onClick={logout}
                className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <LogOut className="w-3 h-3" />
                Sign out
              </button>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* ── Page content ── */}
      <div className="md:ml-60 min-h-screen pb-24 md:pb-0">
        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 bg-card/80 backdrop-blur-md border-b border-border px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-primary" />
            <span className="font-heading text-lg font-bold">{mobileTitle}</span>
          </div>
          <ThemeToggle />
        </div>

        <Outlet />
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-card/95 backdrop-blur-sm border-t border-border z-40">
        <div
          className="flex items-center px-2 pt-1"
          style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
        >
          {bottomTabs.map((tab) => (
            <BottomTab key={tab.to + tab.label} {...tab} />
          ))}
        </div>
      </nav>
    </div>
  );
}
