import { NextResponse } from 'next/server'
import { getStore } from '@/app/lib/server/store.ts';
import { User } from '../../lib/server/types.ts'

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const store = getStore();

        const user = store.users.find((user) => user.email === body.email);
        if (user) {
            return NextResponse.json( { error: "User already exists" }, { status: 409 });
        }

        const newUser: User = {
            userId: `u${Date.now()}`,
            name: body.username,
            email: body.email.trim().toLowerCase(),
            authProvider: "GENERAL",
            passwordHash: body.password,
            createdAt: new Date().toISOString()
        };

        store.users.push(newUser);

        return NextResponse.json( newUser, { status: 201 });
    } catch {
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

        const store = getStore();
        const userExist = store.users.find((user) => user.email === email && user.passwordHash === password);

        if (!userExist) {
            return NextResponse.json( { exists: false, error: "Email or password incorrect" }, { status: 401 });
        }

        return NextResponse.json( { userData: userExist, exists: true, userId: userExist.userId }, { status: 200 })
    } catch {
        return NextResponse.json( { error: "invalid entry data" }, { status: 400 })
    }
}