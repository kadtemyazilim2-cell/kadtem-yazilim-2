import { getUsers } from '@/actions/user';
import { getCompanies } from '@/actions/company';
import { getSites } from '@/actions/site';
import { getVehicles } from '@/actions/vehicle';
import { getPersonnel } from '@/actions/personnel';
import { StoreInitializer } from '@/components/store-initializer';
import { serializeData } from '@/lib/serializer';
import { AppLayout } from '@/components/layout/AppLayout';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await auth();

    if (!session || !session.user) {
        redirect('/login');
    }

    const [companiesRes, sitesRes, vehiclesRes, personnelRes, usersRes] = await Promise.all([
        getCompanies(),
        getSites(),
        getVehicles(),
        getPersonnel(),
        getUsers()
    ]);

    const companies = serializeData(companiesRes.data || []);
    const sites = serializeData(sitesRes.data || []);
    const vehicles = serializeData(vehiclesRes.data || []);
    const personnel = serializeData(personnelRes.data || []);
    const users = serializeData(usersRes.data || []);

    // We should also pass the current user to the store if possible, 
    // but the store User type might differ from NextAuth User type. 
    // consistently mapping them is key.

    return (
        <>
            <StoreInitializer
                companies={companies}
                sites={sites}
                vehicles={vehicles}
                personnel={personnel}
                users={users}
                currentUser={session?.user}
            />
            <AppLayout>{children}</AppLayout>
        </>
    );
}
