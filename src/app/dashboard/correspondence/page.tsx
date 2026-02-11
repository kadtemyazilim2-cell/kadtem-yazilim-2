import { getCorrespondenceList } from '@/actions/correspondence';
import { getInstitutions } from '@/actions/institution';
import { serializeData } from '@/lib/serializer';
import CorrespondencePageClient from './CorrespondencePageClient';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

// [NOTE] Cache kaldırıldı — getCorrespondenceList auth() kullanıyor,
// unstable_cache içinde headers() erişimi desteklenmiyor.

export default async function CorrespondencePage() {
    const session = await auth();
    if (!session || !session.user) {
        redirect('/login');
    }

    const [correspondencesRes, institutionsRes] = await Promise.all([
        getCorrespondenceList(),
        getInstitutions(),
    ]);

    return (
        <CorrespondencePageClient
            initialCorrespondences={serializeData(correspondencesRes?.data || [])}
            initialInstitutions={serializeData(institutionsRes?.data || [])}
            currentUser={session.user}
        />
    );
}
