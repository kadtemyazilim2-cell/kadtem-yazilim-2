'use client';

import { ReactNode, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '@/lib/store/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useYiUfeAutoUpdate } from '@/hooks/use-yi-ufe-auto-update';
import { StoreHydration } from './StoreHydration';
import { Loader2 } from 'lucide-react';

export function AppLayout({ children }: { children: ReactNode }) {
    const { isAuthenticated, user, refreshSession } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    // Global Auto-Update Triggers
    useYiUfeAutoUpdate();

    useEffect(() => {
        setMounted(true);
        if (isAuthenticated) {
            refreshSession();
        }
    }, [isAuthenticated]);

    useEffect(() => {
        if (mounted) {
            if (!isAuthenticated) {
                if (pathname !== '/login') router.push('/login');
                return;
            }

            // If authenticated but user data is invalid, force logout
            if (isAuthenticated && (!user || !user.role)) {
                window.location.href = '/api/auth/signout';
            }
        }
    }, [mounted, isAuthenticated, pathname, router, user]);

    if (!mounted) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-slate-50">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <span className="text-sm text-slate-500 font-medium">Yükleniyor...</span>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <main className="min-h-screen bg-slate-50">{children}</main>;
    }

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <StoreHydration />
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-64 border-r border-slate-200 shrink-0">
                <Sidebar className="w-full" />
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden">
                <Topbar />

                <main className="flex-1 overflow-y-auto overflow-x-hidden p-2 sm:p-4 lg:p-6 pb-20 lg:pb-6">
                    <div className="mx-auto w-full max-w-full min-w-0">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}

