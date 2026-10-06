'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldAlert,
  Activity,
  Layers,
  Network,
  BarChart3,
  Cpu,
  Settings,
  Menu,
  X,
  Radio,
  Server,
} from 'lucide-react';
import { getSystemHealth, SystemHealthStatus, getCurrentUser, login, logout } from '../../lib/api';
import { useRealtime } from '../../hooks/useRealtime';

interface ShellProps {
  children: React.ReactNode;
}

export function Shell({ children }: ShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [health, setHealth] = useState<SystemHealthStatus>({
    api: true,
    ml: true,
    redis: true,
    database: true,
    uptimeSeconds: 0,
  });

  const [user, setUser] = useState<any>(null);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [loginEmail, setLoginEmail] = useState<string>('admin@netsentry.ai');
  const [loginPassword, setLoginPassword] = useState<string>('AdminPassword123!');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  const { status: wsStatus, lastEventAt } = useRealtime();

  useEffect(() => {
    let isMounted = true;
    async function check() {
      try {
        const h = await getSystemHealth();
        if (isMounted) setHealth(h);
      } catch {
        // preserve previous state on transient failure
      }
    }
    async function fetchUser() {
      try {
        const res = await getCurrentUser();
        if (isMounted && res?.user) setUser(res.user);
      } catch {
        // not logged in
      }
    }
    check();
    fetchUser();
    const interval = setInterval(check, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const res = await login(loginEmail, loginPassword);
      setUser(res.user);
      setShowLoginModal(false);
    } catch (err: any) {
      setLoginError(err.message || 'Geçersiz kimlik bilgileri');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setUser(null);
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const navItems = [
    { href: '/', label: 'GENEL BAKIŞ', icon: Activity },
    { href: '/threats', label: 'TEHDİTLER', icon: ShieldAlert },
    { href: '/incidents', label: 'OLAYLAR', icon: Layers },
    { href: '/network', label: 'AĞ TRAFİĞİ', icon: Network },
    { href: '/analytics', label: 'ANALİTİK', icon: BarChart3 },
    { href: '/models', label: 'MODELLER', icon: Cpu },
    { href: '/settings', label: 'AYARLAR', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#060709] text-[#ecebe6] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-[rgba(236,235,230,0.12)] bg-[#060709] shrink-0 sticky top-0 h-screen">
        {/* Wordmark */}
        <div className="p-6 border-b border-[rgba(236,235,230,0.12)]">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 bg-[#ff5b2e] rounded-xs" />
            <span className="font-bold tracking-tight text-lg font-mono">NETSENTRY AI</span>
          </div>
          <div className="text-[10px] text-[#8b8f98] font-mono mt-1 uppercase tracking-wider">
            SECURITY INTELLIGENCE OS
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded text-xs font-mono font-medium transition-colors ${
                  isActive
                    ? 'bg-[#1a1d23] text-[#ecebe6] border-l-2 border-[#ff5b2e]'
                    : 'text-[#8b8f98] hover:text-[#ecebe6] hover:bg-[#101216]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#ff5b2e]' : 'text-[#8b8f98]'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Subsystem Status */}
        <div className="p-4 border-t border-[rgba(236,235,230,0.12)] text-[10px] font-mono text-[#8b8f98] space-y-2">
          <div className="flex items-center justify-between">
            <span>SOCKET GATEWAY</span>
            <span
              className={`inline-flex items-center gap-1 ${
                wsStatus === 'LIVE'
                  ? 'text-[#2a9d8f]'
                  : wsStatus === 'RECONNECTING'
                  ? 'text-[#fcbf49]'
                  : 'text-[#e63946]'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  wsStatus === 'LIVE'
                    ? 'bg-[#2a9d8f]'
                    : wsStatus === 'RECONNECTING'
                    ? 'bg-[#fcbf49]'
                    : 'bg-[#e63946]'
                }`}
              />
              {wsStatus}
            </span>
          </div>
          <div className="text-[9px] text-[#8b8f98]/70 truncate">
            ERDEM DESIGN SYSTEM · CAPSTONE
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-64 bg-[#060709] border-r border-[rgba(236,235,230,0.12)] h-full flex flex-col p-4 z-10">
            <div className="flex items-center justify-between pb-4 border-b border-[rgba(236,235,230,0.12)] mb-4">
              <span className="font-bold text-sm font-mono text-[#ecebe6]">NETSENTRY AI</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="text-[#8b8f98] hover:text-[#ecebe6] p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded text-xs font-mono ${
                      isActive ? 'bg-[#1a1d23] text-[#ecebe6]' : 'text-[#8b8f98]'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="border-b border-[rgba(236,235,230,0.12)] bg-[#060709] sticky top-0 z-30 px-4 md:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden text-[#8b8f98] hover:text-[#ecebe6] p-1"
              aria-label="Menüyü Aç"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div>
              <div className="text-xs font-mono font-bold tracking-wider uppercase text-[#ecebe6]">
                SECURITY OPERATIONS
              </div>
              <div className="text-[10px] font-mono text-[#8b8f98]">
                Real-time Flow Ingestion & ML Threat Intelligence
              </div>
            </div>
          </div>

          {/* Subsystem Health Indicator Strip */}
          <div className="flex items-center gap-2 md:gap-3 text-[10px] font-mono">
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-[#101216] border border-[rgba(236,235,230,0.12)] rounded">
              <span className="text-[#8b8f98]">API</span>
              <span className={`w-1.5 h-1.5 rounded-full ${health.api ? 'bg-[#2a9d8f]' : 'bg-[#e63946]'}`} />
            </div>

            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-[#101216] border border-[rgba(236,235,230,0.12)] rounded">
              <span className="text-[#8b8f98]">ML</span>
              <span className={`w-1.5 h-1.5 rounded-full ${health.ml ? 'bg-[#2a9d8f]' : 'bg-[#e63946]'}`} />
            </div>

            <div className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-[#101216] border border-[rgba(236,235,230,0.12)] rounded">
              <span className="text-[#8b8f98]">REDIS</span>
              <span className={`w-1.5 h-1.5 rounded-full ${health.redis ? 'bg-[#2a9d8f]' : 'bg-[#e63946]'}`} />
            </div>

            <div className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-[#101216] border border-[rgba(236,235,230,0.12)] rounded">
              <span className="text-[#8b8f98]">DB</span>
              <span className={`w-1.5 h-1.5 rounded-full ${health.database ? 'bg-[#2a9d8f]' : 'bg-[#e63946]'}`} />
            </div>

            {/* Live Indicator */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#101216] border border-[rgba(236,235,230,0.12)] rounded">
              <span
                className={`w-2 h-2 rounded-full ${
                  wsStatus === 'LIVE' ? 'bg-[#2a9d8f]' : 'bg-[#e63946]'
                }`}
              />
              <span className="font-semibold text-[#ecebe6]">{wsStatus}</span>
              {lastEventAt && (
                <span className="hidden xl:inline text-[#8b8f98] text-[9px] pl-1 border-l border-[rgba(236,235,230,0.12)]">
                  {new Date(lastEventAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            {/* Auth Session Pill */}
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-[rgba(236,235,230,0.12)]">
                <span className="px-1.5 py-0.5 bg-[#4f8cff]/10 text-[#4f8cff] border border-[#4f8cff]/20 rounded text-[9px] font-bold">
                  {user.role}
                </span>
                <span className="hidden xl:inline text-[#8b8f98] text-[10px] truncate max-w-[120px]">
                  {user.email}
                </span>
                <button
                  onClick={handleLogout}
                  className="text-[10px] text-[#8b8f98] hover:text-[#e63946] transition-colors underline cursor-pointer ml-1"
                >
                  Çıkış
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="px-2.5 py-1 bg-[#ff5b2e] text-[#060709] font-bold rounded text-[10px] hover:bg-[#ff7247] transition-colors cursor-pointer"
              >
                GİRİŞ YAP
              </button>
            )}
          </div>
        </header>

        {/* Login Modal */}
        {showLoginModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#101216] border border-[rgba(236,235,230,0.2)] rounded-lg max-w-sm w-full p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[rgba(236,235,230,0.12)] pb-3">
                <div className="font-mono text-sm font-bold text-[#ecebe6]">SOC GİRİŞİ</div>
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="text-[#8b8f98] hover:text-[#ecebe6]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {loginError && (
                <div className="p-2.5 bg-[#e63946]/10 border border-[#e63946]/30 text-[#e63946] rounded text-xs font-mono">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-3 font-mono text-xs">
                <div>
                  <label className="block text-[#8b8f98] mb-1">E-Posta</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-[#060709] border border-[rgba(236,235,230,0.2)] rounded px-3 py-2 text-[#ecebe6] focus:outline-none focus:border-[#ff5b2e]"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[#8b8f98] mb-1">Şifre</label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-[#060709] border border-[rgba(236,235,230,0.2)] rounded px-3 py-2 text-[#ecebe6] focus:outline-none focus:border-[#ff5b2e]"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-2 bg-[#ff5b2e] text-[#060709] font-bold rounded hover:bg-[#ff7247] transition-colors cursor-pointer"
                >
                  {isLoggingIn ? 'Giriş Yapılıyor...' : 'GİRİŞ YAP'}
                </button>
              </form>

              {/* Quick Demo Credentials */}
              <div className="pt-3 border-t border-[rgba(236,235,230,0.08)] space-y-2">
                <div className="text-[10px] text-[#8b8f98] font-mono">Jüri Demosu Hızlı Rol Seçimi:</div>
                <div className="grid grid-cols-2 gap-2 font-mono text-[10px]">
                  <button
                    onClick={() => {
                      setLoginEmail('admin@netsentry.ai');
                      setLoginPassword('AdminPassword123!');
                    }}
                    className="p-1.5 bg-[#1a1d23] hover:bg-[#22262e] border border-[rgba(236,235,230,0.12)] rounded text-[#4f8cff] text-left cursor-pointer"
                  >
                    Admin Seç
                  </button>
                  <button
                    onClick={() => {
                      setLoginEmail('analyst@netsentry.ai');
                      setLoginPassword('AnalystPassword123!');
                    }}
                    className="p-1.5 bg-[#1a1d23] hover:bg-[#22262e] border border-[rgba(236,235,230,0.12)] rounded text-[#2a9d8f] text-left cursor-pointer"
                  >
                    Analist Seç
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Content Body */}
        <main className="flex-1 p-4 md:p-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
