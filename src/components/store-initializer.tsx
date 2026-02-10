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
    siteLogEntries,
    cashTransactions,
    yiUfeRates,
    vehicleAttendance,
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
    cashTransactions?: any[], // [OPTIONAL] Fetched in page
    yiUfeRates: any[], // [NEW]
    vehicleAttendance: any[], // [NEW]
    personnelAttendance: any[], // [NEW]
    currentUser?: any
}) {
    const initialized = useRef(false);

    // Better approach:
    // Build updates object dynamically to avoid overwriting with undefined/empty
    const updates: any = {};
    if (companies) updates.companies = companies;
    if (sites) updates.sites = sites;
    if (vehicles) updates.vehicles = vehicles;
    if (personnel) updates.personnel = personnel;
    if (users) updates.users = users;
    if (correspondences) updates.correspondences = correspondences;
    if (institutions) updates.institutions = institutions;
    if (fuelTanks) updates.fuelTanks = fuelTanks;
    if (fuelLogs) updates.fuelLogs = fuelLogs;
    if (fuelTransfers) updates.fuelTransfers = fuelTransfers;
    if (siteLogEntries) updates.siteLogEntries = siteLogEntries;
    if (cashTransactions) updates.cashTransactions = cashTransactions;
    if (yiUfeRates) updates.yiUfeRates = yiUfeRates;
    if (vehicleAttendance) updates.vehicleAttendance = vehicleAttendance;
    if (personnelAttendance) updates.personnelAttendance = personnelAttendance;

    if (!initialized.current) {
        useAppStore.setState(updates);
        initialized.current = true;
    }

    // Sync Data Store reactively
    useEffect(() => {
        const reactiveUpdates: any = {};
        if (companies) reactiveUpdates.companies = companies;
        if (sites) reactiveUpdates.sites = sites;
        if (vehicles) reactiveUpdates.vehicles = vehicles;
        if (personnel) reactiveUpdates.personnel = personnel;
        if (users) reactiveUpdates.users = users;
        if (correspondences) reactiveUpdates.correspondences = correspondences;
        if (institutions) reactiveUpdates.institutions = institutions;
        if (fuelTanks) reactiveUpdates.fuelTanks = fuelTanks;
        if (fuelLogs) reactiveUpdates.fuelLogs = fuelLogs;
        if (fuelTransfers) reactiveUpdates.fuelTransfers = fuelTransfers;
        if (siteLogEntries) reactiveUpdates.siteLogEntries = siteLogEntries;
        if (cashTransactions) reactiveUpdates.cashTransactions = cashTransactions;
        if (yiUfeRates) reactiveUpdates.yiUfeRates = yiUfeRates;
        if (vehicleAttendance) reactiveUpdates.vehicleAttendance = vehicleAttendance;
        if (personnelAttendance) reactiveUpdates.personnelAttendance = personnelAttendance;

        if (Object.keys(reactiveUpdates).length > 0) {
            useAppStore.setState(reactiveUpdates);
        }
    }, [companies, sites, vehicles, personnel, users, correspondences, institutions, fuelTanks, fuelLogs, fuelTransfers, siteLogEntries, cashTransactions, yiUfeRates, vehicleAttendance, personnelAttendance]);

    // Sync Auth State separately
    useEffect(() => {
        if (currentUser) {
            if (currentUser.id === 'admin-id') {
                console.warn("Detected stale admin session. Forcing logout...");
                import('next-auth/react').then(mod => mod.signOut());
                return;
            }

            const freshUser = users?.find((u: any) => u.id === currentUser.id) || currentUser;

            // [FIX] Ensure assignedSiteIds exists if we picked freshUser from DB which has assignedSites relation
            if (freshUser && !freshUser.assignedSiteIds && freshUser.assignedSites) {
                freshUser.assignedSiteIds = freshUser.assignedSites.map((s: any) => s.id);
            }

            useAuth.setState({
                user: freshUser,
                isAuthenticated: true
            });
        }
        // NOTE: We do NOT set user to null here automatically to prevent flashing if currentUser is temporarily undefined during revalidation 
        // unless we are sure. But re-enabling manual logout logic if needed.
        else if (currentUser === null) {
            useAuth.setState({ user: null, isAuthenticated: false });
        }
    }, [currentUser, users]);

    return null;
}
