'use client';

import { ReactNode, useEffect, useState } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { useAuth } from '@/lib/store/use-auth';
import { useRouter, usePathname } from 'next/navigation';
import { useYiUfeAutoUpdate } from '@/hooks/use-yi-ufe-auto-update';
import { StoreHydration } from './StoreHydration';

export function AppLayout({ children }: { children: ReactNode }) {
    const { isAuthenticated, user } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [mounted, setMounted] = useState(false);

    // Global Auto-Update Triggers
    useYiUfeAutoUpdate();

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted && !isAuthenticated && pathname !== '/login') {
            router.push('/login');
        }
    }, [mounted, isAuthenticated, pathname, router]);

    if (!mounted) {
        return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
    }

    if (!isAuthenticated) {
        return <main className="min-h-screen bg-slate-50">{children}</main>;
    }

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            <StoreHydration />
            {/* Desktop Sidebar */}
            <aside className="hidden lg:flex flex-col w-64 border-r border-slate-200">
                <Sidebar className="w-full" />
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <Topbar />

                <main className="flex-1 overflow-y-auto p-4 lg:p-6 pb-20 lg:pb-6">
                    <div className={`mx-auto w-full ${pathname?.includes('/personnel') ? 'max-w-[1800px]' : 'max-w-7xl'}`}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
