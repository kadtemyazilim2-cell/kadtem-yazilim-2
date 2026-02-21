'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error('Application error:', error);
    }, [error]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
            <div className="text-center space-y-6 max-w-md">
                <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-slate-900">Bir Hata Oluştu</h2>
                    <p className="text-slate-500 text-sm">
                        Beklenmeyen bir hata meydana geldi. Lütfen sayfayı yenileyin veya tekrar deneyin.
                    </p>
                </div>
                <div className="flex gap-3 justify-center">
                    <Button
                        onClick={() => reset()}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Tekrar Dene
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => window.location.href = '/dashboard'}
                    >
                        Ana Sayfaya Dön
                    </Button>
                </div>
                {process.env.NODE_ENV === 'development' && (
                    <details className="text-left mt-4 p-3 bg-slate-100 rounded-lg text-xs">
                        <summary className="cursor-pointer font-medium text-slate-600">Hata Detayları</summary>
                        <pre className="mt-2 whitespace-pre-wrap text-red-600 overflow-auto max-h-40">
                            {error.message}
                        </pre>
                    </details>
                )}
            </div>
        </div>
    );
}
