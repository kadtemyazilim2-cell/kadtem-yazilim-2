import { DefaultSession, DefaultUser } from "next-auth"
import { JWT, DefaultJWT } from "next-auth/jwt"
import { Role } from "@prisma/client"

declare module "next-auth" {
    interface Session {
        user: {
            id: string
            role: Role
            permissions: any
            username: string
            assignedSiteIds: string[]
            editLookbackDays: number | null
        } & DefaultSession["user"]
    }

    interface User extends DefaultUser {
        role: Role
        permissions: any
        username: string
        assignedSiteIds: string[]
        editLookbackDays: number | null
    }
}

declare module "next-auth/jwt" {
    interface JWT extends DefaultJWT {
        role: Role
        permissions: any
        username: string
        assignedSiteIds: string[]
        editLookbackDays: number | null
    }
}
