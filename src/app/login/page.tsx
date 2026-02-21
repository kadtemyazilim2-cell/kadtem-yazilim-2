'use client';

import { useState } from 'react';
import { authenticate } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import Image from 'next/image';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [pending, setPending] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (pending) return;

        setPending(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('username', username);
            formData.append('password', password);
            formData.append('rememberMe', rememberMe ? 'true' : 'false');

            const result = await authenticate(undefined, formData);

            if (result) {
                // Server returned an error message
                setError(result);
                setPending(false);
            }
            // If no result, redirect happened server-side
        } catch (err: any) {
            // NEXT_REDIRECT throws — this is expected on success
            if (err?.digest?.startsWith('NEXT_REDIRECT')) {
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
                <CardHeader className="pb-4">
                    <div className="flex justify-center w-full">
                        <Image
                            src="/images/kadtem-logo.png"
                            alt="KAD-TEM Logo"
                            width={180}
                            height={70}
                            className="object-contain"
                            priority
                        />
                    </div>
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

                        <div className="flex items-center gap-2">
                            <input
                                id="rememberMe"
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                disabled={pending}
                            />
                            <Label htmlFor="rememberMe" className="text-sm text-slate-600 cursor-pointer select-none">
                                Beni Hatırla
                            </Label>
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
