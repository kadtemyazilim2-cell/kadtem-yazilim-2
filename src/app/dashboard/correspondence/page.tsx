import { getCorrespondenceList } from '@/actions/correspondence';
import { getInstitutions } from '@/actions/institution';
import { serializeData } from '@/lib/serializer';
import CorrespondencePageClient from './CorrespondencePageClient';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { unstable_cache } from 'next/cache';

// [PERF] Her veri kaynağı ayrı cache'te
const getCachedCorrespondences = unstable_cache(
    async () => serializeData((await getCorrespondenceList())?.data || []),
    ['correspondence-list'],
    { revalidate: 30, tags: ['correspondence'] }
);

const getCachedInstitutions = unstable_cache(
    async () => serializeData((await getInstitutions())?.data || []),
    ['institutions-list'],
    { revalidate: 30, tags: ['institutions'] }
);

export default async function CorrespondencePage() {
    const session = await auth();
    if (!session || !session.user) {
        redirect('/login');
    }

    const [correspondences, institutions] = await Promise.all([
        getCachedCorrespondences(),
        getCachedInstitutions(),
    ]);

    return (
        <CorrespondencePageClient
            initialCorrespondences={correspondences}
            initialInstitutions={institutions}
            currentUser={session.user}
        />
    );
}
