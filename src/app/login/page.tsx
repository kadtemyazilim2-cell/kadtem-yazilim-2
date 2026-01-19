'use client';

import { useActionState, useState } from 'react';
import { authenticate } from '@/actions/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { useFormStatus } from 'react-dom';

export default function LoginPage() {
    const [errorMessage, dispatch] = useActionState(authenticate, undefined);
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('123');

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
                    <form action={dispatch} className="space-y-4">
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
                            />
                        </div>

                        {errorMessage && (
                            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-md flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                <p>{errorMessage}</p>
                            </div>
                        )}

                        <div className="text-xs text-slate-500 mt-2">
                            <p className="font-semibold mb-1">Test Kullanıcıları (Şifre: 123):</p>
                            <p className="text-muted-foreground xs">Veritabanı bağlantısı sonrası çalışacaktır.</p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li className="cursor-pointer hover:text-blue-600" onClick={() => { setUsername('admin'); setPassword('123') }}>admin (Admin)</li>
                            </ul>
                        </div>

                        <LoginButton />
                    </form>
                </CardContent>
                <CardFooter className="text-center text-xs text-slate-400 justify-center">
                    &copy; 2026 YapıTakip Sistemleri
                </CardFooter>
            </Card>
        </div>
    );
}

function LoginButton() {
    const { pending } = useFormStatus();

    return (
        <Button aria-disabled={pending} type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
            {pending ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
        </Button>
    );
}
