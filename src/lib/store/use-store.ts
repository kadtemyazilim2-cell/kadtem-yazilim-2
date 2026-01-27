import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppState } from '@/lib/types';
import { indexedDBStorage } from '../idb-storage';

export const useAppStore = create<AppState>()(
    persist(
        (set, get) => ({
            companies: [],
            sites: [],
            users: [],
            vehicles: [],
            correspondences: [],
            cashTransactions: [],
            personnel: [],
            personnelAttendance: [],
            vehicleAttendance: [],
            siteLogEntries: [],
            fuelLogs: [],
            fuelTanks: [],
            fuelTransfers: [],
            yiUfeRates: [],
            institutions: [],
            smtpConfig: null,

            addCorrespondence: (item) => set((state) => ({ correspondences: [{ ...item, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...state.correspondences] })),
            updateCorrespondence: (id, data) => set((state) => ({
                correspondences: state.correspondences.map((c) => (c.id === id ? { ...c, ...data, updatedAt: new Date().toISOString() } : c)),
            })),
            deleteCorrespondence: (id, reason, userId) => set((state) => ({
                correspondences: state.correspondences.map((c) => (c.id === id ? {
                    ...c,
                    status: 'DELETED',
                    deletionReason: reason,
                    deletedByUserId: userId,
                    deletionDate: new Date().toISOString()
                } : c)),
            })),
            restoreCorrespondence: (id) => set((state) => ({
                correspondences: state.correspondences.map((c) => (c.id === id ? {
                    ...c,
                    status: 'ACTIVE',
                    deletionReason: undefined,
                    deletedByUserId: undefined,
                    deletionDate: undefined
                } : c)),
            })),
            addVehicle: (vehicle) => set((state) => ({ vehicles: [...state.vehicles, vehicle] })),
            updateVehicle: (id, data) => set((state) => ({
                vehicles: state.vehicles.map((v) => (v.id === id ? { ...v, ...data } : v)),
            })),
            deleteVehicle: (id) => set((state) => ({
                vehicles: state.vehicles.filter((v) => v.id !== id)
            })),
            addFuelLog: (log) => set((state) => {
                let newTanks = state.fuelTanks;
                if (log.tankId) {
                    newTanks = state.fuelTanks.map(t =>
                        t.id === log.tankId ? { ...t, currentLevel: t.currentLevel - log.liters } : t
                    );
                }
                return { fuelLogs: [log, ...state.fuelLogs], fuelTanks: newTanks };
            }),
            updateFuelLog: (id, data) => set((state) => {
                const oldLog = state.fuelLogs.find(l => l.id === id);
                if (!oldLog) return {};

                let newTanks = [...state.fuelTanks];
                const newLiters = data.liters !== undefined ? Number(data.liters) : oldLog.liters;
                const newTankId = data.tankId !== undefined ? data.tankId : oldLog.tankId;

                // If tank related changes
                if (oldLog.tankId || newTankId) {
                    // Scenario 1: Tank ID changed
                    if (oldLog.tankId !== newTankId) {
                        // Revert old tank
                        if (oldLog.tankId) {
                            newTanks = newTanks.map(t => t.id === oldLog.tankId ? { ...t, currentLevel: t.currentLevel + oldLog.liters } : t);
                        }
                        // Deduct new tank
                        if (newTankId) {
                            newTanks = newTanks.map(t => t.id === newTankId ? { ...t, currentLevel: t.currentLevel - newLiters } : t);
                        }
                    }
                    // Scenario 2: Same tank, liters changed
                    else if (oldLog.tankId && oldLog.liters !== newLiters) {
                        const diff = newLiters - oldLog.liters;
                        newTanks = newTanks.map(t => t.id === oldLog.tankId ? { ...t, currentLevel: t.currentLevel - diff } : t);
                    }
                }

                return {
                    fuelLogs: state.fuelLogs.map(l => l.id === id ? { ...l, ...data, liters: newLiters } : l),
                    fuelTanks: newTanks
                };
            }),
            deleteFuelLog: (id) => set((state) => {
                const log = state.fuelLogs.find(l => l.id === id);
                if (!log) return {};

                // Revert tank changes
                let newTanks = state.fuelTanks;
                if (log.tankId) {
                    // Add back the liters
                    newTanks = newTanks.map(t => t.id === log.tankId ? { ...t, currentLevel: t.currentLevel + log.liters } : t);
                }

                return {
                    fuelLogs: state.fuelLogs.filter((l) => l.id !== id),
                    fuelTanks: newTanks
                };
            }),
            setFuelTanks: (tanks) => set({ fuelTanks: tanks }),
            setFuelLogs: (logs) => set({ fuelLogs: logs }),
            setFuelTransfers: (transfers) => set({ fuelTransfers: transfers }),


            addCashTransaction: (transaction) => set((state) => ({ cashTransactions: [transaction, ...state.cashTransactions] })),
            deleteCashTransaction: (id) => set((state) => ({ cashTransactions: state.cashTransactions.filter(t => t.id !== id) })),
            addPersonnel: (person) => set((state) => ({ personnel: [person, ...state.personnel] })),
            updatePersonnel: (id, data) => set((state) => ({
                personnel: state.personnel.map((p) => (p.id === id ? { ...p, ...data } : p)),
            })),
            deletePersonnel: (id) => set((state) => ({
                personnel: state.personnel.filter((p) => p.id !== id)
            })),
            addPersonnelAttendance: (attendance) => set((state) => ({ personnelAttendance: [attendance, ...state.personnelAttendance] })),
            deletePersonnelAttendance: (pid, date, siteId) => set((state) => ({
                personnelAttendance: state.personnelAttendance.filter(a => {
                    const match = a.personnelId === pid && a.date === date;
                    if (match) {
                        if (siteId) return a.siteId !== siteId; // Only delete if site matches
                        return false; // Delete all if no site specified (backward compat)
                    }
                    return true;
                })
            })),
            addVehicleAttendance: (attendance) => set((state) => ({ vehicleAttendance: [attendance, ...state.vehicleAttendance] })),
            deleteVehicleAttendance: (vid, date) => set((state) => ({
                vehicleAttendance: state.vehicleAttendance.filter(a => !(a.vehicleId === vid && a.date === date))
            })),
            addSiteLogEntry: (entry) => set((state) => ({ siteLogEntries: [entry, ...state.siteLogEntries] })),
            updateSiteLogEntry: (id, data) => set((state) => ({
                siteLogEntries: state.siteLogEntries.map(e => e.id === id ? { ...e, ...data } : e)
            })),
            deleteSiteLogEntry: (id) => set((state) => ({
                siteLogEntries: state.siteLogEntries.filter(e => e.id !== id)
            })),

            addFuelTank: (tank) => set((state) => ({ fuelTanks: [...state.fuelTanks, tank] })),
            updateFuelTankLevel: (id, amount, operation) => set((state) => ({
                fuelTanks: state.fuelTanks.map(t => t.id === id ? {
                    ...t,
                    currentLevel: operation === 'ADD' ? t.currentLevel + amount : t.currentLevel - amount
                } : t)
            })),
            addFuelTransfer: (transfer) => set((state) => {
                let newTanks = [...state.fuelTanks];

                if (transfer.fromType === 'TANK') {
                    newTanks = newTanks.map(t => t.id === transfer.fromId ? { ...t, currentLevel: t.currentLevel - transfer.amount } : t);
                }

                if (transfer.toType === 'TANK') {
                    newTanks = newTanks.map(t => t.id === transfer.toId ? { ...t, currentLevel: t.currentLevel + transfer.amount } : t);
                }

                return {
                    fuelTransfers: [transfer, ...state.fuelTransfers],
                    fuelTanks: newTanks
                };
            }),
            updateFuelTransfer: (id, data) => set((state) => ({
                fuelTransfers: state.fuelTransfers.map(t => t.id === id ? { ...t, ...data } : t)
            })),
            deleteFuelTransfer: (id) => set((state) => ({
                fuelTransfers: state.fuelTransfers.filter(t => t.id !== id)
            })),
            updateSmtpConfig: (config) => set(() => ({
                smtpConfig: config
            })),
            deleteFuelTank: (id) => set((state) => ({
                fuelTanks: state.fuelTanks.filter(t => t.id !== id)
            })),

            addUser: (user) => set((state) => ({ users: [user, ...state.users] })),
            updateUser: (id, data) => set((state) => ({
                users: state.users.map((u) => (u.id === id ? { ...u, ...data } : u)),
            })),
            deleteUser: (id) => set((state) => ({
                users: state.users.filter((u) => u.id !== id),
            })),
            addCompany: (company) => set((state) => ({ companies: [company, ...state.companies] })),
            updateCompany: (id, data) => set((state) => ({
                companies: state.companies.map(c => c.id === id ? { ...c, ...data } : c)
            })),
            deleteCompany: (id) => set((state) => ({
                companies: state.companies.filter(c => c.id !== id)
            })),
            addSite: (site) => set((state) => ({ sites: [site, ...state.sites] })),
            updateSite: (id, data) => set((state) => ({
                sites: state.sites.map(s => s.id === id ? { ...s, ...data } : s)
            })),
            deleteSite: (id) => set((state) => ({
                sites: state.sites.filter(s => s.id !== id)
            })),
            assignVehiclesToSite: (vehicleIds, siteIds) => set((state) => ({
                vehicles: state.vehicles.map(v => vehicleIds.includes(v.id) ? {
                    ...v,
                    assignedSiteIds: siteIds,
                    assignedSiteId: siteIds.length > 0 ? siteIds[0] : undefined
                } : v)
            })),
            setYiUfeRates: (rates) => set({ yiUfeRates: rates }),
            addYiUfeRates: (newRates) => set((state) => {
                // Merge new rates with existing ones.
                // If ID exists, overwrite. If not, append.
                const existingMap = new Map(state.yiUfeRates.map(r => [r.id, r]));
                newRates.forEach(r => existingMap.set(r.id, r));
                return { yiUfeRates: Array.from(existingMap.values()) };
            }),
            addInstitution: (inst) => set((state) => ({ institutions: [...state.institutions, inst] })),
            updateInstitution: (id, data) => set((state) => ({
                institutions: state.institutions.map((i) => (i.id === id ? { ...i, ...data } : i)),
            })),
            deleteInstitution: (id) => set((state) => ({ institutions: state.institutions.filter((i) => i.id !== id) })),

            // Initialization
            resetData: () => {
                set({
                    companies: [],
                    sites: [],
                    users: [],
                    vehicles: [],
                    correspondences: [],
                    cashTransactions: [],
                    personnel: [],
                    personnelAttendance: [],
                    vehicleAttendance: [],
                    siteLogEntries: [],
                    fuelLogs: [],
                    fuelTanks: [],
                    fuelTransfers: [],
                    institutions: [],
                })
            }
        }),
        {
            name: 'cms-storage', // name of the item in the storage (must be unique)

            storage: createJSONStorage(() => indexedDBStorage), // Use IndexedDB instead of localStorage
            skipHydration: true, // We will hydrate manually to avoid hydration errors in Next.js
        }
    )
);
