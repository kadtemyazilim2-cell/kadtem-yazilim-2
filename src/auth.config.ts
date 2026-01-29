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
                session.user.role = (token as any).role;
                session.user.permissions = (token as any).permissions;
                session.user.username = (token as any).username;
                session.user.assignedSiteIds = (token as any).assignedSiteIds;
                session.user.editLookbackDays = (token as any).editLookbackDays;
            }
            return session;
        },
        async jwt({ token, user }) {
            if (user) {
                token.sub = user.id;
                token.role = (user as any).role;
                token.permissions = (user as any).permissions;
                token.username = (user as any).username;
                token.assignedSiteIds = (user as any).assignedSiteIds;
                token.editLookbackDays = (user as any).editLookbackDays;
            }
            return token;
        }
    },
    providers: [], // Providers are configured in auth.ts since they might rely on Node.js modules
} satisfies NextAuthConfig;
