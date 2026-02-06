import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';

export function useUserSites() {
    const { sites } = useAppStore();
    const { user } = useAuth();

    if (!user) return [];

    // [FIX] Server action getSites() already scopes the data for non-admins.
    // The store only contains sites the user is allowed to see.
    // Redundant client-side filtering causes issues if assignedSiteIds in session is out of sync.
    return sites || [];
}
