import NextAuth from "next-auth"
import { authConfig } from "./auth.config"

export default NextAuth(authConfig).auth((req) => {
    const isLoggedIn = !!req.auth
    const isOnDashboard = req.nextUrl.pathname.startsWith('/dashboard')
    const isOnLogin = req.nextUrl.pathname.startsWith('/login')

    if (isOnDashboard) {
        if (isLoggedIn) return
        return Response.redirect(new URL('/login', req.nextUrl)) // Redirect unauthenticated users to login page
    }

    if (isOnLogin) {
        // [FIX] Allow access to login page even if "logged in" by cookie, 
        // to prevent infinite loops if session is partially broken.
        // if (isLoggedIn) return Response.redirect(new URL('/dashboard', req.nextUrl))
        return
    }

    return;
})

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
