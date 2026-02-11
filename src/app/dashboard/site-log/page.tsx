import { SiteLogPageClient } from './SiteLogPageClient';
import { getSiteLogEntries } from '@/actions/site-log';
import { serializeData } from '@/lib/serializer';
import { unstable_cache } from 'next/cache';

// [PERF] Şantiye günlüğü verisi 30sn cache
const getCachedSiteLogData = unstable_cache(
    async () => {
        const res = await getSiteLogEntries();
        return serializeData(res.data || []);
    },
    ['site-log-page-data'],
    { revalidate: 30, tags: ['site-logs'] }
);

export default async function SiteLogPage() {
    const data = await getCachedSiteLogData();
    return <SiteLogPageClient initialData={data} />;
}
