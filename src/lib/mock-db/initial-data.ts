import { Company, Site, User, Vehicle, Correspondence, Personnel } from "../types";

export const COMPANIES: Company[] = [];

export const SITES: Site[] = [];

export const USERS: User[] = [
    {
        id: 'u1',
        name: 'Sistem Yöneticisi',
        username: 'admin',
        password: '123',
        email: 'admin@system.com',
        role: 'ADMIN',
        assignedCompanyIds: [],
        assignedSiteIds: [],
        permissions: {}
    }
];

export const VEHICLES: Vehicle[] = [];

export const CORRESPONDENCES: Correspondence[] = [];

export const PERSONNEL: Personnel[] = [];
