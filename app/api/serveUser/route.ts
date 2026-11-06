import {NextResponse} from 'next/server'
import { advanceQueue } from '@/app/lib/server/repo'

export async function PATCH(req: Request) {
    try {
        const body = await req.json();

        const queueId = body.queueId;
        if (!queueId || typeof queueId !== "string") {
            return NextResponse.json({error: "Requires queue Id"}, {status: 400});
        }

        // Completes the person being served and starts the next one, in one database transaction.
        const { serving } = advanceQueue(queueId);
        if (!serving) {
            return NextResponse.json({error: "No user to be served"}, {status: 400});
        }

        return NextResponse.json(serving, {status: 200});
    } catch {
        return NextResponse.json({error: "failed to advance queue"}, {status: 500})
    }
}
