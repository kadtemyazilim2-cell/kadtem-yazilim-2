
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { z } from "zod";

async function getUser(username: string) {
    try {
        const user = await prisma.user.findUnique({
            where: { username },
        });
        return user;
    } catch (error) {
        console.error("Failed to fetch user:", error);
        throw new Error("Failed to fetch user.");
    }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
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
    callbacks: {
        async session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub;
                session.user.role = token.role as any;
                session.user.permissions = token.permissions as any;
                session.user.username = token.username as string;
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.sub = user.id;
                token.role = user.role;
                token.permissions = user.permissions;
                token.username = user.username;
            }
            return token;
        }
    },
    session: {
        strategy: "jwt"
    },
    pages: {
        signIn: "/login",
    },
});
