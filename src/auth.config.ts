import type { NextAuthConfig } from "next-auth"

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days max
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
                token.rememberMe = (user as any).rememberMe || false;
            }

            // If "Beni Hatırla" is NOT checked, expire session after 1 day
            // If checked, session lasts for 30 days (maxAge above)
            if (!token.rememberMe) {
                const oneDayInSeconds = 24 * 60 * 60;
                const issuedAt = (token.iat as number) || Math.floor(Date.now() / 1000);
                const now = Math.floor(Date.now() / 1000);
                if (now - issuedAt > oneDayInSeconds) {
                    // Token expired for non-remember-me users
                    return null as any;
                }
            }

            return token;
        }
    },
    providers: [], // Providers are configured in auth.ts since they might rely on Node.js modules
} satisfies NextAuthConfig;
