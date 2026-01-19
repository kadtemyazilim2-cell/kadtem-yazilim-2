'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store/use-store';

export function StoreHydration() {
    useEffect(() => {
        // Hydrate the store on client mount
        useAppStore.persist.rehydrate();
    }, []);

    return null;
}
