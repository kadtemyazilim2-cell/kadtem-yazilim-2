import type { NextAuthConfig } from "next-auth"

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: "jwt",
    },
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
    providers: [], // Providers are configured in auth.ts since they might rely on Node.js modules
} satisfies NextAuthConfig;
