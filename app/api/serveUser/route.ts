import {NextResponse} from 'next/server'
import { advanceQueue, listWaitingOrdered } from '@/app/lib/server/repo'
import { addNotification } from '@/app/lib/server/notificationService'

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

        // Notify the person being served.
        addNotification(
            serving.userId,
            serving.entryId,
            "STATUS_CHANGE",
            "It's your turn!"
        );

        // Find the person now at position 2.
        const secondWaiting = listWaitingOrdered(queueId)[1];

        if (secondWaiting) {
            addNotification(
                secondWaiting.userId,
                secondWaiting.entryId,
                "QUEUE_UPDATE",
                "You're almost up!"
            );
        }

        return NextResponse.json(serving, {status: 200});
    } catch {
        return NextResponse.json({error: "failed to advance queue"}, {status: 500})
    }
}