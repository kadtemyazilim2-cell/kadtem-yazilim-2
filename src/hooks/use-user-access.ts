import { useAppStore } from '@/lib/store/use-store';
import { useAuth } from '@/lib/store/use-auth';

export function useUserSites() {
    const { sites } = useAppStore();
    const { user } = useAuth();

    if (!user) return [];

    if (user.role === 'ADMIN') {
        return sites;
    }

    // Filter sites based on assigned IDs
    const assignedIds = user.assignedSiteIds || [];
    return (sites || []).filter((site: any) => assignedIds.includes(site.id));
}
