'use client';

import { useState } from 'react';
import { authenticate } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pending) return;

        setPending(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);

            const result = await authenticate(undefined, formData);

            if (result) {
                // Server returned an error message
                setError(result);
                setPending(false);
            }
            // If no result, redirect happened server-side
        } catch (err: any) {
            // NEXT_REDIRECT throws — this is expected on success
            // Check if it's a redirect (Next.js throws NEXT_REDIRECT)
            if (err?.digest?.startsWith('NEXT_REDIRECT')) {
                // Let Next.js handle the redirect
                window.location.href = '/dashboard';
                return;
            }
            setError('Bağlantı hatası. Lütfen tekrar deneyin.');
            setPending(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
            <Card className="w-full max-w-md shadow-lg">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold text-center text-blue-800">YapıTakip</CardTitle>
                    <CardDescription className="text-center">
                        Kurumsal Şantiye Yönetim Sistemi
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Kullanıcı Adı</Label>
                            <Input
                                id="username"
                                name="username"
                                type="text"
                                placeholder="kullaniciadi"
                                required
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                disabled={pending}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Şifre</Label>
                            <Input
                                id="password"
                                name="password"
                                type="password"
                                placeholder="******"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={pending}
                            />
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                <p>{error}</p>
                            </div>
                        )}

                        <Button disabled={pending} type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                            {pending ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
                        </Button>
                    </form>
                </CardContent>
                <CardFooter className="text-center text-xs text-slate-400 justify-center">
                    &copy; 2026 YapıTakip Sistemleri
                </CardFooter>
            </Card>
        </div>
    );
}
