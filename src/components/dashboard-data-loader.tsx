import { getUsers } from '@/actions/user';
import { getCompanies } from '@/actions/company';
import { getSites } from '@/actions/site';
import { getVehicles } from '@/actions/vehicle';
import { getPersonnel } from '@/actions/personnel';
import { getCorrespondenceList } from '@/actions/correspondence';
import { getInstitutions } from '@/actions/institution';
import { getFuelTanks } from '@/actions/fuel';
import { StoreInitializer } from '@/components/store-initializer';
import { serializeData } from '@/lib/serializer';

export async function DashboardDataLoader({ currentUser }: { currentUser: any }) {
    let companies = [], sites = [], vehicles = [], personnel = [], users = [], correspondences = [], institutions = [], fuelTanks = [];

    try {
        const [companiesRes, sitesRes, vehiclesRes, personnelRes, usersRes, correspondencesRes, institutionsRes, fuelTanksRes] = await Promise.all([
            getCompanies(),
            getSites(),
            getVehicles(),
            getPersonnel(),
            getUsers(),
            getCorrespondenceList(),
            getInstitutions(),
            getFuelTanks()
        ]);

        companies = serializeData(companiesRes?.data || []);
        sites = serializeData(sitesRes?.data || []);
        vehicles = serializeData(vehiclesRes?.data || []);
        personnel = serializeData(personnelRes?.data || []);
        users = serializeData(usersRes?.data || []);
        correspondences = serializeData(correspondencesRes?.data || []);
        institutions = serializeData(institutionsRes?.data || []);
        fuelTanks = serializeData(fuelTanksRes?.data || []);
    } catch (error) {
        console.error("Dashboard Data Fetch Error:", error);
    }

    return (
        <StoreInitializer
            companies={companies}
            sites={sites}
            vehicles={vehicles}
            personnel={personnel}
            users={users}
            correspondences={correspondences}
            institutions={institutions}
            fuelTanks={fuelTanks}
            currentUser={currentUser}
        />
    );
}
