'use client';

import { useRef } from 'react';
import { useAppStore } from '@/lib/store/use-store';

export function StoreInitializer({
    companies,
    sites,
    vehicles,
    personnel
}: {
    companies: any[],
    sites: any[],
    vehicles: any[],
    personnel: any[]
}) {
    const initialized = useRef(false);
    if (!initialized.current) {
        useAppStore.setState({
            companies,
            sites,
            vehicles,
            personnel,
            // Add others
        });
        initialized.current = true;
    }
    return null;
}
