import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, Role } from '../types';
import { USERS } from '../mock-db/initial-data';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    login: (username: string, password?: string) => Promise<boolean>;
    logout: () => void;
    hasRole: (role: Role | Role[]) => boolean;
    hasPermission: (module: string, level: 'VIEW' | 'CREATE' | 'EDIT') => boolean;
    getAccessibleSites: (allSites: import('../types').Site[]) => import('../types').Site[]; // [NEW]
}

export const useAuth = create<AuthState>()(
    persist(
        (set, get) => ({
            user: null,
            isAuthenticated: false,

            login: async (username, password) => {
                // Login Logic - Check against store state which includes new users
                // Dynamically import or access store to avoid circular dependency issues if possible, 
                // but direct access via getState() is usually safe for Zustand store actions.
                // We need to access the AppStore state here.

                // Note: We can't import useAppStore directly at the top level if it causes circular deps with useAuth.
                // But typically application state logic is separated.
                // Let's assume we can access the persisted state from localStorage if store not available,
                // OR better, since we are in client side, we can dynamically access the store.

                // For this implementation, we will use a dynamic import approach or rely on window object/helper if needed, 
                // but typically standard pattern is:
                // import { useAppStore } from './use-store'; inside the function or file.
                // However, use-store imports USERS from initial-data.

                // Let's try importing useAppStore
                const { useAppStore } = require('./use-store');
                const users = useAppStore.getState().users;

                const foundUser = users.find((u: User) => u.username === username && u.password === password);
                if (foundUser) {
                    set({ user: foundUser, isAuthenticated: true });
                    return true;
                }
                return false;
            },

            logout: () => set({ user: null, isAuthenticated: false }),

            hasRole: (role) => {
                const { user } = get();
                if (!user) return false;
                if (Array.isArray(role)) {
                    return role.includes(user.role);
                }
                return user.role === role;
            },

            hasPermission: (module, level) => {
                const { user } = get();
                if (!user) return false;
                if (user.role === 'ADMIN') return true; // Admins have all permissions

                const perms = user.permissions?.[module];
                if (!perms) return false;

                return perms.includes(level);
            },

            getAccessibleSites: (allSites) => {
                const { user } = get();
                if (!user) return [];
                if (user.role === 'ADMIN') return allSites.filter(s => s.status === 'ACTIVE');

                // If no sites assigned, might want to return empty or all? 
                // Usually restrict to none if not admin and no assignment.
                if (!user.assignedSiteIds || user.assignedSiteIds.length === 0) return [];

                return allSites.filter(site => user.assignedSiteIds.includes(site.id) && site.status === 'ACTIVE');
            },
        }),
        {
            name: 'cms-auth',
            storage: createJSONStorage(() => localStorage),
            skipHydration: true,
        }
    )
);
