import { Inter } from 'next/font/google';
import { cn } from '@/lib/utils';
import '@/app/globals.css';

const inter = Inter({ subsets: ['latin'] });

export default function SiteOperatorLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="tr" suppressHydrationWarning>
            <body className={cn("min-h-screen bg-slate-50", inter.className)}>
                <div className="max-w-md mx-auto min-h-screen bg-white shadow-xl">
                    {children}
                </div>
            </body>
        </html>
    );
}
