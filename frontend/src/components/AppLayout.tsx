import { useState, useEffect } from 'react';
import { Outlet, NavLink, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/auth-context';
import { getMyGyms } from '../features/gyms/api';

function MenuIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function NavItem({
  to,
  children,
  end = false,
  extraActivePaths = [],
}: {
  to: string;
  children: React.ReactNode;
  end?: boolean;
  extraActivePaths?: string[];
}) {
  const { pathname } = useLocation();
  const extraActive = extraActivePaths.some((p) => pathname.startsWith(p));

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `block px-3 py-2 text-sm rounded-lg mx-2 transition-colors ${
          isActive || extraActive
            ? 'bg-blue-50 text-blue-700 font-medium'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`
      }
    >
      {children}
    </NavLink>
  );
}

export default function AppLayout() {
  const { gymId } = useParams<{ gymId?: string }>();
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on navigation
  useEffect(() => setSidebarOpen(false), [pathname]);

  const { data: gymsData } = useQuery({
    queryKey: ['my-gyms'],
    queryFn: getMyGyms,
  });

  const gym = gymsData?.gyms.find((g) => g.id === gymId);
  const isAdmin = gym?.role === 'admin';
  const isMember = gym?.role === 'member';

  const sidebarContent = (
    <>
      <div className="flex-1 overflow-y-auto py-3 space-y-0.5">
        {gym && (
          <>
            <p className="px-4 pt-1 pb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest truncate">
              {gym.name}
            </p>
            {isAdmin && (
              <>
                <NavItem
                  to={`/gyms/${gymId}/admin`}
                  end
                  extraActivePaths={[`/gyms/${gymId}/admin/members/`]}
                >
                  Members
                </NavItem>
                <NavItem to={`/gyms/${gymId}/admin/analytics`}>Analytics</NavItem>
                <NavItem to={`/gyms/${gymId}/admin/rewards`}>Rewards</NavItem>
              </>
            )}
            {isMember && (
              <NavItem to={`/gyms/${gymId}`} end>
                Check In
              </NavItem>
            )}
            <div className="mx-4 my-2 border-t border-gray-100" />
          </>
        )}

        {user?.is_super_admin && (
          <>
            <p className="px-4 pt-1 pb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
              Platform
            </p>
            <NavItem to="/super-admin">Admin Panel</NavItem>
            <div className="mx-4 my-2 border-t border-gray-100" />
          </>
        )}

        <p className="px-4 pt-1 pb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
          Account
        </p>
        <NavItem to="/gyms" end>My Gyms</NavItem>
        <NavItem to="/profile">Profile</NavItem>
      </div>

      <div className="border-t border-gray-200 px-4 py-3 space-y-1.5">
        <p className="text-xs text-gray-500 truncate">{user?.full_name ?? user?.email}</p>
        {user?.full_name && <p className="text-xs text-gray-400 truncate">{user?.email}</p>}
        <button onClick={logout} className="text-xs text-red-500 hover:text-red-700 transition-colors">
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Mobile top bar ── */}
      <div className="md:hidden sticky top-0 z-30 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-1 text-gray-600 hover:text-gray-900 transition-colors"
          aria-label="Open menu"
        >
          <MenuIcon />
        </button>
        <span className="text-base font-bold text-blue-600">Gymify</span>
        {gym && (
          <span className="text-sm text-gray-400 truncate">{gym.name}</span>
        )}
      </div>

      {/* ── Backdrop (mobile) ── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <nav
        className={`fixed inset-y-0 left-0 w-64 md:w-52 bg-white border-r border-gray-200 flex flex-col z-40
          transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        {/* Desktop logo */}
        <div className="hidden md:block px-4 py-4 border-b border-gray-100">
          <span className="text-lg font-bold text-blue-600">Gymify</span>
        </div>

        {/* Mobile sidebar header with close button */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <span className="text-base font-bold text-blue-600">Gymify</span>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>

        {sidebarContent}
      </nav>

      {/* ── Page content ── */}
      <div className="md:ml-52 min-h-screen md:pt-6">
        <Outlet />
      </div>
    </div>
  );
}
