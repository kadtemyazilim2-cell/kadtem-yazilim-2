'use client';

import { Menu, LogOut, User } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { Sidebar } from './Sidebar';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/lib/store/use-auth';
import { Badge } from '@/components/ui/badge';

export function Topbar() {
    const pathname = usePathname();
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const { user, logout } = useAuth();

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
        if (pathname.includes('/limit-value')) return 'Sınır Değer';
        if (pathname.includes('/admin')) return 'Yönetim Paneli';
        return 'Dashboard';
    };

    const handleLogout = async () => {
        try {
            logout();
            window.location.href = '/login';
        } catch {
            window.location.href = '/login';
        }
    };

    return (
        <header className="h-16 border-b bg-white flex items-center px-4 justify-between lg:justify-between sticky top-0 z-30">
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

            <div className="flex items-center gap-3">
                {user && (
                    <div className="flex items-center gap-2">
                        <div className="hidden sm:flex items-center gap-2 text-sm">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-700">{user.name}</span>
                            <Badge variant={user.role === 'ADMIN' ? 'default' : 'secondary'} className="text-[10px] px-1.5 py-0">
                                {user.role === 'ADMIN' ? 'Yönetici' : 'Kullanıcı'}
                            </Badge>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-red-500"
                            onClick={handleLogout}
                            title="Çıkış Yap"
                        >
                            <LogOut className="w-4 h-4" />
                        </Button>
                    </div>
                )}
            </div>
        </header>
    );
}

