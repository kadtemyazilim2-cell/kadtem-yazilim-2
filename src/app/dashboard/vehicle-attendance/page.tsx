'use client';

import { VehicleAttendanceList } from '@/components/modules/vehicle-attendance/VehicleAttendanceList';
import { VehicleAttendanceReport } from '@/components/modules/vehicle-attendance/VehicleAttendanceReport';
import { VehicleAssignment } from '@/components/modules/vehicle-attendance/VehicleAssignment';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Truck, FileBarChart, ArrowRightLeft } from 'lucide-react';
import { useAuth } from '@/lib/store/use-auth';

export default function VehicleAttendancePage() {
    const { user, hasPermission } = useAuth(); // [FIX] Destructure hasPermission
    const perms = user?.permissions || {};
    const isAdmin = user?.role === 'ADMIN';

    const canViewList = isAdmin || hasPermission('vehicle-attendance.list', 'VIEW') || hasPermission('vehicle-attendance.list', 'EDIT');
    const canViewAssignment = isAdmin || hasPermission('vehicle-attendance.assignment', 'VIEW') || hasPermission('vehicle-attendance.assignment', 'EDIT');
    const canViewReport = isAdmin || hasPermission('vehicle-attendance.report', 'VIEW') || hasPermission('vehicle-attendance.report', 'EDIT');

    // Determine default tab
    let defaultTab = "list";
    if (!canViewList) {
        if (canViewAssignment) defaultTab = "assignment";
        else if (canViewReport) defaultTab = "report";
        else defaultTab = ""; // No access
    }

    if (!canViewList && !canViewAssignment && !canViewReport) {
        return <div className="p-6 text-center text-muted-foreground">Bu modüle erişim yetkiniz yok.</div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Araç Puantaj</h2>
                <p className="text-muted-foreground">
                    Şantiyelerdeki araçların günlük çalışma durumlarını giriniz ve raporlayınız.
                </p>
            </div>

            <Tabs defaultValue={defaultTab} className="w-full">
                <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
                    {canViewList && (
                        <TabsTrigger value="list" className="gap-2">
                            <Truck className="w-4 h-4" />
                            Puantaj Girişi
                        </TabsTrigger>
                    )}
                    {canViewAssignment && (
                        <TabsTrigger value="assignment" className="gap-2">
                            <ArrowRightLeft className="w-4 h-4" />
                            Araç Atama
                        </TabsTrigger>
                    )}
                    {canViewReport && (
                        <TabsTrigger value="report" className="gap-2">
                            <FileBarChart className="w-4 h-4" />
                            Özet Rapor
                        </TabsTrigger>
                    )}
                </TabsList>

                {canViewList && (
                    <TabsContent value="list" className="mt-6">
                        <VehicleAttendanceList />
                    </TabsContent>
                )}

                {canViewAssignment && (
                    <TabsContent value="assignment" className="mt-6">
                        <VehicleAssignment />
                    </TabsContent>
                )}

                {canViewReport && (
                    <TabsContent value="report" className="mt-6">
                        <VehicleAttendanceReport />
                    </TabsContent>
                )}
            </Tabs>
        </div>
    );
}
