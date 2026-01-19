'use client';

import { useRef } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';

export function StoreInitializer({
    companies,
    sites,
    vehicles,
    personnel,
    currentUser
}: {
    companies: any[],
    sites: any[],
    vehicles: any[],
    personnel: any[],
    currentUser?: any
}) {
    const initialized = useRef(false);
    if (!initialized.current) {
        useAppStore.setState({
            companies,
            sites,
            vehicles,
            personnel,
        });

        if (currentUser) {
            useAuth.setState({
                user: currentUser,
                isAuthenticated: true
            });
        }

        initialized.current = true;
    }
    return null;
}
