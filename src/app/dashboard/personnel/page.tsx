'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GlobalPersonnelList } from '@/components/modules/personnel/GlobalPersonnelList';
import { PersonnelForm } from '@/components/modules/personnel/PersonnelForm';
import { PersonnelList } from '@/components/modules/personnel/PersonnelList'; // Keeping for 'Puantaj' tab
import PersonnelAssignment from '@/components/modules/personnel-attendance/PersonnelAssignment';
import { SitePersonnelSummaryTable } from '@/components/modules/personnel/SitePersonnelSummaryTable';


export default function PersonnelPage() {
    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Personel Puantaj</h2>
                    <p className="text-muted-foreground">Personel yönetimi ve puantaj işlemleri.</p>
                </div>
                <PersonnelForm />
            </div>

            <Tabs defaultValue="site-summary" className="w-full">
                <TabsList className="grid w-full max-w-[800px] grid-cols-4">
                    <TabsTrigger value="site-summary">Şantiye Özeti</TabsTrigger>
                    <TabsTrigger value="attendance">Puantaj</TabsTrigger>
                    <TabsTrigger value="assignments">Atamalar</TabsTrigger>
                    <TabsTrigger value="all-personnel">Tüm Personeller</TabsTrigger>
                </TabsList>

                <TabsContent value="site-summary" className="mt-4">
                    <SitePersonnelSummaryTable />
                </TabsContent>

                <TabsContent value="assignments" className="mt-4">
                    <PersonnelAssignment />
                </TabsContent>

                <TabsContent value="attendance" className="mt-4">
                    <PersonnelList />
                </TabsContent>

                <TabsContent value="all-personnel" className="mt-4">
                    <GlobalPersonnelList />
                </TabsContent>
            </Tabs>
        </div>
    );
}
