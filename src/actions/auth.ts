'use server';

import { signIn, signOut } from '@/auth';
import { AuthError } from 'next-auth';

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        console.log("Authentication started for user:", formData.get('username'));
        await signIn('credentials', formData);
        console.log("Authentication successful, redirecting...");
    } catch (error) {
        console.error("Authentication error:", error);
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Geçersiz kullanıcı adı veya şifre.';
                case 'CallbackRouteError':
                    // Extract the custom error message thrown from auth.ts
                    const cause = error.cause as any;
                    return `Bağlantı Hatası: ${cause?.err?.message || error.message}`;
                default:
                    return `Hata Detayı: ${error.type} - ${error.message}`;
            }
        }
        throw error;
    }
}

export async function logout() {
    await signOut();
}
