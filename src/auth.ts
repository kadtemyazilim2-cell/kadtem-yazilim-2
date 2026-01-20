import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { authConfig } from "./auth.config";

console.log("AUTH_SECRET exists:", !!process.env.AUTH_SECRET);

async function getUser(username: string) {
    try {
        console.log("Prisma: Finding user...", username);
        console.log("DB URL exists:", !!process.env.POSTGRES_PRISMA_URL);

        // Timeout after 5 seconds
        const user = await Promise.race([
            prisma.user.findUnique({
                where: { username },
            }),
            new Promise((_, reject) =>
                setTimeout(() => reject(new Error('DB Timeout (5s)')), 5000)
            )
        ]) as any;

        console.log("Prisma: User found (or null).");
        return user;
    } catch (error) {
        // [DEBUG] Log error for Vercel logs
        console.error("DB Error in getUser:", error);
        // Throw simple string that NextAuth can display or ignore
        throw new Error("Veritabanına bağlanılamadı. (Zaman Aşımı/Hata)");
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
    ...authConfig,
    providers: [
        Credentials({
            async authorize(credentials) {
                console.log("Authorize called with credentials:", credentials?.username);
                const parsedCredentials = z
                    .object({ username: z.string().min(3), password: z.string().min(3) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { username, password } = parsedCredentials.data;

                    // [DEBUG] Bypass DB for admin
                    if (username === 'admin' && password === '123') {
                        console.log("Admin bypass activated.");
                        return {
                            id: 'admin-id',
                            name: 'Admin User',
                            username: 'admin',
                            role: 'ADMIN',
                            email: 'admin@example.com',
                            status: 'ACTIVE',
                            permissions: {},
                            password: '123'
                        } as any;
                    }

                    console.log("Credentials parsed, fetching user from DB...");
                    const user = await getUser(username);
                    console.log("User fetch result:", user ? "Found" : "Not Found");

                    if (!user) return null;

                    // In real app use bcrypt.compare/argon2
                    // For now, simple string comparison as per initial mock auth
                    if (user.password === password) {
                        console.log("Password match!");
                        return user;
                    } else {
                        console.log("Password mismatch");
                    }
                } else {
                    console.log("Invalid credentials format");
                }
                return null; // Invalid credentials
            },
        }),
    ],
});
