import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
            <div className="text-center space-y-6 max-w-md">
                <div className="mx-auto w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center">
                    <FileQuestion className="w-10 h-10 text-slate-400" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-6xl font-bold text-slate-300">404</h1>
                    <h2 className="text-xl font-semibold text-slate-700">Sayfa Bulunamadı</h2>
                    <p className="text-slate-500 text-sm">
                        Aradığınız sayfa mevcut değil veya taşınmış olabilir.
                    </p>
                </div>
                <Link
                    href="/dashboard"
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                >
                    Ana Sayfaya Dön
                </Link>
            </div>
        </div>
    );
}
