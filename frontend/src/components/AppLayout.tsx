import { Outlet, NavLink, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../lib/auth-context';
import { getMyGyms } from '../features/gyms/api';

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

  const { data: gymsData } = useQuery({
    queryKey: ['my-gyms'],
    queryFn: getMyGyms,
  });

  const gym = gymsData?.gyms.find((g) => g.id === gymId);
  const isAdmin = gym?.role === 'admin';
  const isMember = gym?.role === 'member';

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <nav className="w-52 shrink-0 fixed top-0 left-0 h-screen bg-white border-r border-gray-200 flex flex-col z-10">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-100">
          <span className="text-lg font-bold text-blue-600">Gymify</span>
        </div>

        <div className="flex-1 overflow-y-auto py-3 space-y-0.5">
          {/* Gym-scoped section */}
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

          {/* Account section */}
          <p className="px-4 pt-1 pb-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
            Account
          </p>
          <NavItem to="/gyms" end>
            My Gyms
          </NavItem>
          <NavItem to="/profile">Profile</NavItem>
        </div>

        {/* Bottom: user info + sign out */}
        <div className="border-t border-gray-200 px-4 py-3 space-y-1.5">
          <p className="text-xs text-gray-500 truncate">{user?.full_name ?? user?.email}</p>
          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          <button
            onClick={logout}
            className="text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Page content */}
      <div className="ml-52 flex-1 min-h-screen bg-gray-50">
        <Outlet />
      </div>
    </div>
  );
}
