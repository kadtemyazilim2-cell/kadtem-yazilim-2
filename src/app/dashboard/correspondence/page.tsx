import { Suspense } from 'react';
import { getCorrespondenceList } from '@/actions/correspondence';
import { getInstitutions } from '@/actions/institution'; // Need to ensure this action exists or similar
import { serializeData } from '@/lib/serializer';
import CorrespondencePageClient from './CorrespondencePageClient';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CorrespondencePage() {
    const session = await auth();
    if (!session || !session.user) {
        redirect('/login');
    }

    // Parallel Data Fetching
    const [correspondencesRes, institutionsRes] = await Promise.all([
        getCorrespondenceList(),
        getInstitutions()
    ]);

    const correspondences = serializeData(correspondencesRes?.data || []);
    const institutions = serializeData(institutionsRes?.data || []);

    return (
        <CorrespondencePageClient
            initialCorrespondences={correspondences}
            initialInstitutions={institutions}
            currentUser={session.user}
        />
    );
}
