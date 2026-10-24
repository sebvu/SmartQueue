import {NextResponse} from 'next/server'
import { getStore } from '../../lib/server/store.ts'
import { getWaitingOrder } from '@/app/lib/server/queueLogic';

export async function PATCH(req: Request) {
    try {
        const body = await req.json();
        
        const queueId = body.queueId;
        if (!queueId || typeof queueId !== "string") {
            return NextResponse.json({error: "Requires queue Id"}, {status: 400});
        }

        const line = getWaitingOrder(queueId);

        
        const store = getStore();
        const currServing = store.queueEntries.find((entry) => entry.status === "SERVING" && entry.queueId === queueId);

        if (currServing !== undefined) {
            currServing.status = "COMPLETED";
            currServing.endedAt = new Date().toISOString();
        }
        const nextToServe = line[0];
        if (!nextToServe) {
            return NextResponse.json({error: "No user to be served"}, {status: 400});
        }

        nextToServe.status = "SERVING";
        return NextResponse.json(nextToServe, {status: 200});
    } catch {
        return NextResponse.json({error: "failed to advance queue"}, {status: 500})
    }
}