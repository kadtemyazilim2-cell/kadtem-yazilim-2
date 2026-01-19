'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GlobalPersonnelList } from '@/components/modules/personnel/GlobalPersonnelList';
import { PersonnelForm } from '@/components/modules/personnel/PersonnelForm';
import { PersonnelList } from '@/components/modules/personnel/PersonnelList'; // Keeping for 'Puantaj' tab

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

            <Tabs defaultValue="all-personnel" className="w-full">
                <TabsList className="grid w-full max-w-[400px] grid-cols-2">
                    <TabsTrigger value="attendance">Puantaj</TabsTrigger>
                    <TabsTrigger value="all-personnel">Tüm Personeller</TabsTrigger>
                </TabsList>

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
