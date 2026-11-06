import { NextResponse } from 'next/server'
import { findQueue, updateQueue, type QueueChanges } from '@/app/lib/server/repo'

export async function PATCH(req: Request) {
    try {
        const body = await req.json();

        const queueId = body.queueId;
        const name = body.name;
        const desc = body.description;
        const expected = body.expectedDurationMinutes;
        const priority = body.priorityLevel;
        const isOpen = body.isOpen;
        const maxCapacity = body.maxCapacity;

        if (!findQueue(queueId)) {
            return NextResponse.json({error: "invalid queue id"}, {status: 404});
        }

        const changes: QueueChanges = {};
        if (name) changes.name = name;
        if (desc) changes.description = desc;
        if (expected !== undefined) changes.expectedDurationMinutes = expected;
        if (priority) changes.priorityLevel = priority;
        if (isOpen !== undefined) changes.isOpen = isOpen;
        if (maxCapacity) changes.maxCapacity = maxCapacity;

        // The database rejects values that break its rules, and that becomes a 400 below.
        const updated = updateQueue(queueId, changes);
        return NextResponse.json(updated, { status: 200 });
    } catch {
        return NextResponse.json({error: "Invalid details"}, {status: 400})
    }
}