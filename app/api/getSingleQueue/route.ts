import { NextResponse } from "next/server";
import { getStore } from "@/app/lib/server/store";

export async function GET(req: Request) {
    try {
        const body = await req.json();

        const queueId = body.queueId;
        if (!queueId || typeof queueId !== "string") {
            return NextResponse.json({error: "queue Id must be a string"}, {status: 400});
        }

        const store = getStore();
        const currQueue = store.queues.find((queue) => queue.queueId === queueId);
        
        if (!currQueue) {
            return NextResponse.json({error: "Queue at queue id does not exist"}, {status: 400});
        }

        return NextResponse.json(currQueue, {status: 200});
    } catch {
        return NextResponse.json({error: "Queue not retrieved"}, {status: 500})
    }
}