'use server';

import { signIn, signOut } from '@/auth';
import { AuthError } from 'next-auth';
import { cookies } from 'next/headers';

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        console.log("Authentication started for user:", formData.get('username'));
        const rememberMe = formData.get('rememberMe') === 'true';
        await signIn('credentials', {
            username: formData.get('username'),
            password: formData.get('password'),
            rememberMe: rememberMe ? 'true' : 'false',
            redirectTo: '/dashboard'
        });
        console.log("Authentication successful, redirecting...");
    } catch (error) {
        // signIn throws NEXT_REDIRECT on success — intercept to adjust cookie
        if (error && typeof error === 'object' && 'digest' in error) {
            const digest = (error as any).digest;
            if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) {
                const rememberMe = formData.get('rememberMe') === 'true';

                if (!rememberMe) {
                    // Convert session cookie to a session cookie (no maxAge)
                    // so it's deleted when browser closes
                    const cookieStore = await cookies();
                    const sessionCookieName = process.env.NODE_ENV === 'production'
                        ? '__Secure-authjs.session-token'
                        : 'authjs.session-token';

                    const existingCookie = cookieStore.get(sessionCookieName);
                    if (existingCookie) {
                        // Re-set the cookie WITHOUT maxAge → browser session cookie
                        cookieStore.set(sessionCookieName, existingCookie.value, {
                            httpOnly: true,
                            secure: process.env.NODE_ENV === 'production',
                            sameSite: 'lax',
                            path: '/',
                            // No maxAge or expires → session cookie, deleted on browser close
                        });
                    }
                }

                // Re-throw so Next.js handles the redirect
                throw error;
            }
        }

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

