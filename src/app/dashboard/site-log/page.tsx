import { SiteLogPageClient } from './SiteLogPageClient';
import { getSiteLogEntries } from '@/actions/site-log';
import { serializeData } from '@/lib/serializer';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function SiteLogPage() {
    const res = await getSiteLogEntries();
    const data = serializeData(res.data || []);

    return <SiteLogPageClient initialData={data} />;
}
