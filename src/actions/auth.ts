'use server';

import { signIn, signOut } from '@/auth';
import { AuthError } from 'next-auth';

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', formData);
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Geçersiz kullanıcı adı veya şifre.';
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
