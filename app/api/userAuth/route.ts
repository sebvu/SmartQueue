import { NextResponse } from 'next/server'
import { ApiError } from '@/app/lib/server/http'
import { registerUser } from '@/app/lib/server/registerService'
import { loginWithPassword } from '@/app/lib/server/tempAuthService'
import { findUserByEmail } from '@/app/lib/server/repo'

// Older sign-up and login routes. They now share the code behind /api/auth/*, so passwords
// are hashed and stored in the database like everywhere else.

export async function POST(req: Request) {
    try {
        const body = await req.json();
        if (typeof body.username !== "string" || typeof body.email !== "string" || typeof body.password !== "string") {
            return NextResponse.json( { error: "Invalid details" }, { status: 400 });
        }

        const { user } = registerUser(body.username, body.email, body.password);

        return NextResponse.json( user, { status: 201 });
    } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
            return NextResponse.json( { error: "User already exists" }, { status: 409 });
        }
        return NextResponse.json( { error: "Invalid details" }, { status: 400 });
    }
}

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);

        const email = searchParams.get("email");
        const password = searchParams.get("password");
        if (!email || !password) {
            return NextResponse.json( {error: "Email and password required"}, {status: 400})
        }

        try {
            const { user } = loginWithPassword(email, password);
            const exists = findUserByEmail(email);
            return NextResponse.json( { userData: user, exists: true, userId: exists?.userId }, { status: 200 })
        } catch {
            return NextResponse.json( { exists: false, error: "Email or password incorrect" }, { status: 401 });
        }
    } catch {
        return NextResponse.json( { error: "invalid entry data" }, { status: 400 })
    }
}
