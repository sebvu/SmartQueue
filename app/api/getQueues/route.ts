import { NextResponse } from 'next/server';
import { getStore } from '@/app/lib/server/store';

export async function GET(req: Request) {
    const store = getStore();
    const queues = store.queues;
    if (!queues) {
        return NextResponse.json( {error: "queues not found"}, {status: 400})
    }

    return NextResponse.json( queues, { status: 200 });
}