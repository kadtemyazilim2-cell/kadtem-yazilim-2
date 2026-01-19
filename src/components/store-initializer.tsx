'use client';

import { useRef, useEffect } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';

export function StoreInitializer({
    companies,
    sites,
    vehicles,
    personnel,
    users,
    currentUser
}: {
    companies: any[],
    sites: any[],
    vehicles: any[],
    personnel: any[],
    users: any[],
    currentUser?: any
}) {
    const initialized = useRef(false);

    // Better approach:
    if (!initialized.current) {
        useAppStore.setState({
            companies,
            sites,
            vehicles,
            personnel,
            users,
        });
        initialized.current = true;
    }

    // Sync Data Store reactively when server data changes (e.g. after revalidatePath)
    useEffect(() => {
        useAppStore.setState({
            companies,
            sites,
            vehicles,
            personnel,
            users,
        });
    }, [companies, sites, vehicles, personnel, users]);

    // Sync Auth State separately and reactively
    useEffect(() => {
        if (currentUser) {
            useAuth.setState({
                user: currentUser,
                isAuthenticated: true
            });
        } else {
            // [CRITICAL FIX] If server says no user, enforce it on client!
            // This prevents "Zombie Session" where middleware thinks yes, but app has no data.
            useAuth.setState({
                user: null,
                isAuthenticated: false
            });
        }
    }, [currentUser]);

    return null;
}
