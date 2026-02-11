'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store/use-store';
import { CorrespondenceList } from '@/components/modules/correspondence/CorrespondenceList';
import { useAuth } from '@/lib/store/use-auth';

interface CorrespondencePageClientProps {
    initialCorrespondences: any[];
    initialInstitutions: any[];
    currentUser: any;
}

export default function CorrespondencePageClient({
    initialCorrespondences,
    initialInstitutions,
    currentUser
}: CorrespondencePageClientProps) {

    useEffect(() => {
        // Hydrate Store
        useAppStore.setState({
            correspondences: initialCorrespondences || [],
            institutions: initialInstitutions || []
        });
    }, [initialCorrespondences, initialInstitutions]);

    const { hasPermission } = useAuth();
    // Logic from original page
    const canView = hasPermission('correspondence', 'VIEW') ||
        hasPermission('correspondence.incoming', 'VIEW') ||
        hasPermission('correspondence.outgoing', 'VIEW') ||
        hasPermission('correspondence.bank', 'VIEW') ||
        hasPermission('correspondence.contacts', 'VIEW');

    if (!canView) {
        return <div className="p-6 text-center text-muted-foreground">Bu modüle erişim yetkiniz yok.</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Yazışmalar</h2>
                <p className="text-muted-foreground">
                    Gelen ve giden tüm resmi evraklarınızı buradan yönetebilirsiniz.
                </p>
            </div>
            <CorrespondenceList />
        </div>
    );
}
