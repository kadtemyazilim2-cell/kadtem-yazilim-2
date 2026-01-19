import { auth } from "@/auth"

export default auth((req) => {
    const isLoggedIn = !!req.auth
    const isOnDashboard = req.nextUrl.pathname.startsWith('/dashboard')
    const isOnLogin = req.nextUrl.pathname.startsWith('/login')

    if (isOnDashboard) {
        if (isLoggedIn) return
        return Response.redirect(new URL('/login', req.nextUrl)) // Redirect unauthenticated users to login page
    }

    if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL('/dashboard', req.nextUrl)) // Redirect authenticated users to dashboard
        return
    }

    return;
})

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
