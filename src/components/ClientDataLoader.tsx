'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';
import { getCompanies } from '@/actions/company';
import { getSites } from '@/actions/site';
import { getVehicles } from '@/actions/vehicle';
import { getPersonnel } from '@/actions/personnel';
import { getUsers } from '@/actions/user';
import { getYiUfeRates } from '@/actions/yiufe';

function serializeClient(data: any): any {
    return JSON.parse(JSON.stringify(data));
}

export function ClientDataLoader({ currentUser }: { currentUser?: any }) {
    const fetching = useRef(false);

    // Set auth state immediately from session prop
    useEffect(() => {
        if (currentUser) {
            if (currentUser.id === 'admin-id') {
                console.warn("Detected stale admin session. Forcing logout...");
                import('next-auth/react').then(mod => mod.signOut());
                return;
            }
            useAuth.setState({
                user: currentUser,
                isAuthenticated: true
            });
        } else if (currentUser === null) {
            useAuth.setState({ user: null, isAuthenticated: false });
        }
    }, [currentUser]);

    // Fetch reference data client-side (non-blocking)
    useEffect(() => {
        if (fetching.current) return;
        fetching.current = true;

        const loadReferenceData = async () => {
            try {
                const [companiesRes, sitesRes, vehiclesRes, personnelRes, usersRes, yiUfeRatesRes] = await Promise.all([
                    getCompanies(),
                    getSites(),
                    getVehicles(),
                    getPersonnel(),
                    getUsers(),
                    getYiUfeRates(),
                ]);

                const updates: any = {};
                if (companiesRes?.data) updates.companies = serializeClient(companiesRes.data);
                if (sitesRes?.data) updates.sites = serializeClient(sitesRes.data);
                if (vehiclesRes?.data) updates.vehicles = serializeClient(vehiclesRes.data);
                if (personnelRes?.data) updates.personnel = serializeClient(personnelRes.data);
                if (usersRes?.data) updates.users = serializeClient(usersRes.data);
                if (yiUfeRatesRes?.data) updates.yiUfeRates = serializeClient(yiUfeRatesRes.data);

                useAppStore.setState(updates);

                // Sync auth user with fresh DB data
                if (currentUser) {
                    const freshUser = usersRes?.data?.find((u: any) => u.id === currentUser.id) || currentUser;
                    if (freshUser && !freshUser.assignedSiteIds && freshUser.assignedSites) {
                        freshUser.assignedSiteIds = freshUser.assignedSites.map((s: any) => s.id);
                    }
                    useAuth.setState({
                        user: serializeClient(freshUser),
                        isAuthenticated: true
                    });
                }

                console.log('[ClientDataLoader] Reference data loaded');
            } catch (err) {
                console.error('[ClientDataLoader] Failed to load reference data:', err);
            } finally {
                fetching.current = false;
            }
        };

        loadReferenceData();
    }, [currentUser]);

    return null;
}
