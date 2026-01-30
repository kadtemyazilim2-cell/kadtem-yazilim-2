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
    correspondences,
    institutions,
    fuelTanks,
    fuelLogs,
    fuelTransfers,
    siteLogEntries, // [NEW]
    cashTransactions,
    currentUser
}: {
    companies: any[],
    sites: any[],
    vehicles: any[],
    personnel: any[],
    users: any[],
    correspondences: any[],
    institutions: any[],
    fuelTanks: any[],
    fuelLogs: any[],
    fuelTransfers: any[],
    siteLogEntries: any[],
    cashTransactions: any[],
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
            correspondences,
            institutions,
            fuelTanks,
            fuelLogs,
            fuelTransfers,
            siteLogEntries,
            cashTransactions,
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
            correspondences,
            institutions,
            fuelTanks,
            fuelLogs,
            fuelTransfers,
            siteLogEntries,
            cashTransactions,
        });
    }, [companies, sites, vehicles, personnel, users, correspondences, institutions, fuelTanks, fuelLogs, fuelTransfers, siteLogEntries, cashTransactions]);

    // Sync Auth State separately and reactively
    // Sync Auth State separately and reactively
    useEffect(() => {
        if (currentUser) {
            // [SELF-HEALING] Check for stale "fake" admin session
            if (currentUser.id === 'admin-id') {
                console.warn("Detected stale admin session. Forcing logout...");
                // Dynamic import to avoid SSR issues with next-auth/react
                import('next-auth/react').then(mod => mod.signOut());
                return;
            }

            useAuth.setState({
                user: currentUser,
                isAuthenticated: true
            });
        } else {
            // [CRITICAL FIX] If server says no user, enforce it on client!
            useAuth.setState({
                user: null,
                isAuthenticated: false
            });
        }
    }, [currentUser]);

    return null;
}
