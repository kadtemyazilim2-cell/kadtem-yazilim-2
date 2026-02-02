'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Mail,
    Truck,
    Fuel,
    Wallet,
    Users,
    Clock,
    BookOpen,
    Settings,
    LogOut,
    ArrowRightLeft
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/store/use-auth';
import { logout as serverLogout } from '@/actions/auth';

const NAV_ITEMS = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Yazışmalar', href: '/dashboard/correspondence', icon: Mail },
    { label: 'Araçlar', href: '/dashboard/vehicles', icon: Truck },
    { label: 'Yakıt Takip', href: '/dashboard/fuel', icon: Fuel },
    { label: 'Yakıt Hareketleri', href: '/dashboard/fuel/movement', icon: ArrowRightLeft },
    { label: 'Kasa Defteri', href: '/dashboard/cash-book', icon: Wallet },

    { label: 'Puantaj', href: '/dashboard/new-tab', icon: Users },

    { label: 'Araç Puantaj', href: '/dashboard/vehicle-attendance', icon: Clock },
    { label: 'Şantiye Defteri', href: '/dashboard/site-log', icon: BookOpen },
    { label: 'Yönetim', href: '/dashboard/admin', icon: Settings }, // [NEW] Admin Link
];

export function Sidebar({ className, onNavItemClick }: { className?: string, onNavItemClick?: () => void }) {
    const pathname = usePathname();
    const { logout, user } = useAuth();

    return (
        <div className={cn("flex flex-col h-full bg-slate-900 text-white w-64", className)}>
            <div className="p-6">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                    YapıTakip
                </h1>
                <p className="text-xs text-slate-400 mt-1">Kurumsal Şantiye Yönetimi</p>
            </div>

            <nav className="flex-1 overflow-y-auto py-4">
                <ul className="space-y-1 px-3">
                    {NAV_ITEMS.map((item) => {
                        // Permission Check
                        let permissionId = item.href.split('/').pop() || '';
                        if (item.href === '/dashboard' && permissionId === 'dashboard') permissionId = 'dashboard';

                        if (user?.role !== 'ADMIN') {
                            // Block Admin Page for non-admins
                            if (item.href === '/dashboard/admin') return null;

                            // Block modules if permission is NONE or missing (except Dashboard home)
                            if (item.href !== '/dashboard') {
                                const perms = (user?.permissions || {}) as Record<string, string[]>;
                                const userPerm = perms[permissionId];
                                if (!userPerm || userPerm.length === 0 || userPerm.includes('NONE')) return null;
                            }
                        }

                        const Icon = item.icon;
                        const isActive = pathname === item.href;

                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    onClick={onNavItemClick}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                                        isActive
                                            ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20"
                                            : "text-slate-300 hover:bg-slate-800 hover:text-white"
                                    )}
                                >
                                    <Icon className="w-5 h-5" />
                                    {item.label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            <div className="p-4 border-t border-slate-800">
                <div className="flex items-center gap-3 mb-4 px-2">
                    <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">
                        {user?.name?.[0] || 'U'}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-sm font-semibold truncate">{user?.name || 'Kullanıcı'}</p>
                        <p className="text-xs text-slate-500 truncate">{user?.role || 'Guest'}</p>
                    </div>
                </div>



                <button
                    onClick={async () => {
                        logout(); // Clear client state
                        await serverLogout(); // Clear server session & redirect
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Çıkış Yap
                </button>
            </div>
        </div>
    );
}
