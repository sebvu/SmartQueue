import { NextResponse } from 'next/server';
import { listQueues } from '@/app/lib/server/repo';

export async function GET(req: Request) {
    const queues = listQueues();
    if (!queues) {
        return NextResponse.json( {error: "queues not found"}, {status: 400})
    }

    return NextResponse.json( queues, { status: 200 });
}