import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { authConfig } from "./auth.config";

async function getUser(username: string) {
    try {
        console.log("Prisma: Finding user...", username);
        const user = await prisma.user.findUnique({
            where: { username },
        });
        console.log("Prisma: User found (or null).");
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
                console.log("Authorize called with credentials:", credentials?.username);
                const parsedCredentials = z
                    .object({ username: z.string().min(3), password: z.string().min(3) })
                    .safeParse(credentials);

                if (parsedCredentials.success) {
                    const { username, password } = parsedCredentials.data;
                    console.log("Credentials parsed, fetching user...");
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
