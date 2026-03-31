'use client';

import { useState, useEffect, Suspense, lazy } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Truck } from 'lucide-react';
import { useAuth } from '@/lib/store/use-auth';
import { useAppStore } from '@/lib/store/use-store';

// Lazy load the heavy components
const NewPage = lazy(() => import('@/app/dashboard/new-tab/page'));
const VehicleAttendancePageClient = lazy(() =>
    import('@/app/dashboard/vehicle-attendance/VehicleAttendancePageClient').then(m => ({ default: m.VehicleAttendancePageClient }))
);

interface AttendancePageClientProps {
    vehicleAttendanceData: any[];
    sites: any[];
    vehicles: any[];
}

export function AttendancePageClient({ vehicleAttendanceData, sites, vehicles }: AttendancePageClientProps) {
    const { user, hasPermission } = useAuth();
    const isAdmin = user?.role === 'ADMIN';

    // Permission checks
    const canViewPersonnel = isAdmin || hasPermission('personnel-attendance', 'VIEW') || hasPermission('personnel-attendance', 'EDIT') ||
        Object.keys((user?.permissions || {}) as Record<string, string[]>).some(p =>
            p.startsWith('personnel-attendance.') && ((user?.permissions as any)?.[p]?.length > 0) && !((user?.permissions as any)?.[p]?.includes('NONE'))
        );

    const canViewVehicle = isAdmin || hasPermission('vehicle-attendance', 'VIEW') || hasPermission('vehicle-attendance', 'EDIT') ||
        hasPermission('vehicle-attendance.list', 'VIEW') || hasPermission('vehicle-attendance.list', 'EDIT');

    // Default tab
    const defaultTab = canViewPersonnel ? 'personnel' : canViewVehicle ? 'vehicle' : '';

    if (!canViewPersonnel && !canViewVehicle) {
        return <div className="p-6 text-center text-muted-foreground">Bu modüle erişim yetkiniz yok.</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Puantaj</h2>
            </div>

            <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
                    {canViewPersonnel && (
                        <TabsTrigger value="personnel" className="gap-2">
                            <Users className="w-4 h-4" />
                            Personel Puantaj
                        </TabsTrigger>
                    )}
                    {canViewVehicle && (
                        <TabsTrigger value="vehicle" className="gap-2">
                            <Truck className="w-4 h-4" />
                            Araç Puantaj
                        </TabsTrigger>
                    )}
                </TabsList>

                {canViewPersonnel && (
                    <TabsContent value="personnel" className="mt-6">
                        <Suspense fallback={<div className="flex items-center justify-center py-20 text-muted-foreground">Personel puantaj yükleniyor...</div>}>
                            <NewPage />
                        </Suspense>
                    </TabsContent>
                )}

                {canViewVehicle && (
                    <TabsContent value="vehicle" className="mt-6">
                        <Suspense fallback={<div className="flex items-center justify-center py-20 text-muted-foreground">Araç puantaj yükleniyor...</div>}>
                            <VehicleAttendancePageClient 
                                initialData={vehicleAttendanceData} 
                                sites={sites} 
                                vehicles={vehicles} 
                            />
                        </Suspense>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
