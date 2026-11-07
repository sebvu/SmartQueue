import { NextResponse } from 'next/server'
import type { QueueEntry } from '@/app/lib/server/types';
import { getPosition } from '@/app/lib/server/queueLogic';
import { findActiveEntry, findQueue, insertEntry, setEntryStatus } from '@/app/lib/server/repo';
import { generateId } from '@/app/lib/server/store';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const queue = findQueue(body.queueId);

        if (!queue || !queue.isActive || !queue.isOpen) {
            return NextResponse.json(
                { error: "Queue not found or not open" },
                { status: 404 }
            );
        }

        const existingEntry = findActiveEntry(body.userId, body.queueId, ["WAITING", "SERVING"]);

        if (existingEntry) {
            return NextResponse.json(
                { error: "Already joined this queue" },
                { status: 409 }
            );
        }

        const newEntry: QueueEntry = {
            entryId: generateId(),
            userId: body.userId,
            queueId: body.queueId,
            joinedAt: new Date().toISOString(),
            endedAt: null,
            status: 'WAITING',
            roleIds: body.roleIds ?? []
        };
        insertEntry(newEntry);
        return NextResponse.json(newEntry, { status: 201 });
    } catch {
        return NextResponse.json({ error: "didn't join queue oops" }, { status: 500 });
    }
}

// finding queue position
export async function GET(req: Request) {
    try {
        const body = await req.json();

        const entry = findActiveEntry(body.userId, body.queueId, ["WAITING", "SERVING"]);
        if (!entry) {
            return NextResponse.json( { error: "No entry found" }, { status: 404 });
        }

        const pos = getPosition(entry)

        return NextResponse.json(pos, { status: 200 })
    } catch {
        return NextResponse.json( { error: "Not found" }, { status: 500 })
    }
}

// leaving a queue
export async function PATCH(req: Request) {
    try {
        const body = await req.json();

        const entry = findActiveEntry(body.userId, body.queueId, ["WAITING", "SERVING"]);
        if (!entry) {
            return NextResponse.json( { error: "No entry found" }, { status: 404 });
        }

        const left = setEntryStatus(entry.entryId, "CANCELLED", new Date().toISOString());

        return NextResponse.json(left, { status: 200 });
    } catch {
        return NextResponse.json( { error: "Failed to leave queue" }, { status: 500 });
    }
}
