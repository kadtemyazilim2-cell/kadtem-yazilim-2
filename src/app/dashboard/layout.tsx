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

    // if (!session || !session.user) {
    //     redirect('/login');
    // }

    let companies = [], sites = [], vehicles = [], personnel = [], users = [];

    try {
        const [companiesRes, sitesRes, vehiclesRes, personnelRes, usersRes] = await Promise.all([
            getCompanies(),
            getSites(),
            getVehicles(),
            getPersonnel(),
            getUsers()
        ]);

        companies = serializeData(companiesRes?.data || []);
        sites = serializeData(sitesRes?.data || []);
        vehicles = serializeData(vehiclesRes?.data || []);
        personnel = serializeData(personnelRes?.data || []);
        users = serializeData(usersRes?.data || []);
    } catch (error) {
        console.error("Dashboard Data Fetch Error:", error);
        // Continue with empty arrays to render the shell at least
    }

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
            {/* SESSION DEBUGGER */}
            <div className="bg-black text-green-400 p-2 text-xs font-mono break-all border-b border-green-900 z-[9999] relative">
                <b>SERVER SESSION DEBUG:</b> {JSON.stringify(session, null, 2)}
            </div>

            <AppLayout>{children}</AppLayout>
        </>
    );
}
