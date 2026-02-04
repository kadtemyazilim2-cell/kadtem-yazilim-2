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
        if (mounted) {
            // If not authenticated, redirect to login
            if (!isAuthenticated) {
                if (pathname !== '/login') router.push('/login');
                return;
            }

            // If authenticated but user data is missing or broken (e.g. no role), force logout
            // This fixes the "Undefined Dashboard" issue with stale cookies
            if (isAuthenticated && (!user || !user.role)) {
                console.warn("Invalid session detected, forcing logout...");
                // We should ideally call logout() here but useAuth might not expose it directly in a way that creates a clean loop
                // Better to just redirect to a logout route or manually clear.
                // Assuming accessing the store's logout function via the hook.
                // But we can't destructure logout from useAuth() inside useEffect dependencies easily if avoiding infinite loops.
                // Let's just rely on the fact that if we push to /login, middleware might bounce back?
                // No, middleware bounces back if it sees a cookie. We need to CLEAR the cookie.
                // We can fetch '/api/auth/signout' or similar? 
                // Or just use the server action signOut?
                // Let's rely on a client-side hard reload or better, use the store's logout.

                // For now, let's redirect to a special 'error' or just '/login' combined with a client-side cleanup.
                // Actually, the StoreInitializer should have set the user if it existed. 
                // If it didn't set the user, then the session was partial.

                // Let's trigger a logout action.
                // Since I can't easily import the action here effectively without triggering it in render (bad),
                // I will use `window.location.href = '/api/auth/signout'` as a nuclear option for invalid states.
                window.location.href = '/api/auth/signout';
            }
        }
    }, [mounted, isAuthenticated, pathname, router, user]);

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
                    <div className={`mx-auto w-full ${pathname?.includes('/admin') || pathname?.includes('/fuel') || pathname?.includes('/vehicles') ? 'max-w-full' : pathname?.includes('/personnel') ? 'max-w-[1800px]' : 'max-w-7xl'}`}>
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
