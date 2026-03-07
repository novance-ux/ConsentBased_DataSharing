import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { WalletConnect } from './WalletConnect'
import { useWallet } from '@txnlab/use-wallet-react'
import { useAuthStore } from '@/stores/authStore'

const navLinks = [
  { path: '/', label: 'Home' },
  { path: '/student', label: 'Student' },
  { path: '/requester', label: 'Requester' },
  { path: '/admin', label: 'Admin' },
  { path: '/audit', label: 'Audit Log' },
]

export function Layout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { activeAccount } = useWallet()
  const { isAuthenticated, user, demoMode, clearAuth } = useAuthStore()

  function handleLogout() {
    clearAuth()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-xl font-bold text-primary">
              ConsentChain
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    location.pathname === link.path
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium text-foreground">{user.name || 'User'}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {user.role}
                    {demoMode && ' (demo)'}
                  </p>
                </div>
                <button
                  onClick={handleLogout}
                  className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                {activeAccount && (
                  <span className="hidden sm:inline text-sm text-muted-foreground">
                    Connected
                  </span>
                )}
                <WalletConnect />
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
