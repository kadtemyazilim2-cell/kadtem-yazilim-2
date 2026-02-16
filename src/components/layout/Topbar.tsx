'use client';

import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Sidebar } from './Sidebar';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export function Topbar() {
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Simple title mapping
    const getTitle = () => {
        if (pathname.includes('/correspondence')) return 'Yazışmalar';
        if (pathname.includes('/vehicles')) return 'Araçlar';
        if (pathname.includes('/fuel')) return 'Yakıt Takip';
        if (pathname.includes('/cash-book')) return 'Kasa Defteri';
        if (pathname.includes('/personnel')) return 'Personel';
        if (pathname.includes('/attendance')) return 'Puantaj';
        if (pathname.includes('/vehicle-attendance')) return 'Araç Puantaj';
        if (pathname.includes('/new-tab')) return 'Personel Puantaj';
        if (pathname.includes('/site-log')) return 'Şantiye Defteri';
        return 'Dashboard';
    };

    return (
        <header className="h-16 border-b bg-white flex items-center px-4 justify-between lg:justify-end sticky top-0 z-30">
            <div className="flex items-center gap-4 lg:hidden">
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                    <SheetTrigger asChild>
                        <Button variant="ghost" size="icon">
                            <Menu className="w-6 h-6" />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="p-0 border-r-0 w-72">
                        <VisuallyHidden><SheetTitle>Menü</SheetTitle></VisuallyHidden>
                        <Sidebar onNavItemClick={() => setMobileMenuOpen(false)} />
                    </SheetContent>
                </Sheet>
                <span className="font-semibold text-lg">{getTitle()}</span>
            </div>

            <div className="hidden lg:block mr-auto pl-4 font-semibold text-xl text-slate-800">
                {getTitle()}
            </div>

            <div className="flex items-center gap-4">
                {/* Notifications or other topbar items can go here */}
            </div>
        </header>
    );
}
