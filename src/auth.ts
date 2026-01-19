import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { authConfig } from "./auth.config";

async function getUser(username: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { username },
        });
        return user;
    } catch (error) {
        // [DEBUG] Log error for Vercel logs
        console.error("DB Error in getUser:", error);
        // Throw simple string that NextAuth can display or ignore
        throw new Error("Veritabanına bağlanılamadı. Ayarları kontrol edin.");
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ username: z.string().min(3), password: z.string().min(3) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { username, password } = parsedCredentials.data;
                    const user = await getUser(username);

                    if (!user) return null;

                    // In real app use bcrypt.compare/argon2
                    // For now, simple string comparison as per initial mock auth
                    if (user.password === password) {
                        return user;
                    }
                }
                return null; // Invalid credentials
            },
        }),
    ],
});
