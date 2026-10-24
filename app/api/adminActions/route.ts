import { NextResponse } from 'next/server'
import {getStore} from '../../lib/server/store.ts'

export async function PATCH(req: Request) {
    const store = getStore();
    try {
        const body = await req.json();

        const queueId = body.queueId;
        const name = body.name;
        const desc = body.description;
        const expected = body.expectedDurationMinutes;
        const priority = body.priorityLevel;
        const isOpen = body.isOpen;
        const maxCapacity = body.maxCapacity;

        const currQueue = store.queues.find((queue) => queue.queueId === queueId);
        if (!currQueue) {
            return NextResponse.json({error: "invalid queue id"}, {status: 404});
        }

        if (name) {
            currQueue.name = name;
        }
        if (desc) {
            currQueue.description = desc;
        }
        if (expected !== undefined) {
            currQueue.expectedDurationMinutes = expected;
        }
        if (priority) {
            currQueue.priorityLevel = priority;
        }
        if (isOpen !== undefined) {
            currQueue.isOpen = isOpen;
        }
        if (maxCapacity) {
            currQueue.maxCapacity = maxCapacity;
        }
        
        return NextResponse.json(currQueue, { status: 200 });
    } catch {
        return NextResponse.json({error: "Invalid details"}, {status: 400})
    }
}