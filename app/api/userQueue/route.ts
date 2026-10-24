import { NextResponse } from 'next/server'
import { mockQueueEntries } from "@/app/lib/server/mockData";
import type { QueueEntry } from '@/app/lib/server/types';
import { getPosition } from '@/app/lib/server/queueLogic';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const newEntry: QueueEntry = {
            entryId: `e${Date.now()}`,
            userId: body.userId,
            queueId: body.queueId,
            joinedAt: new Date().toISOString(),
            endedAt: null,
            status: 'WAITING',
            roleIds: body.roleIds
        };
        mockQueueEntries.push(newEntry);
        return NextResponse.json(newEntry, { status: 201 });
    } catch (error) {
        return NextResponse.json({ error: "didn't join queue oops" }, { status: 500 });
    }
}

export async function GET(req: Request) {
    try {
        const body = await req.json();

        const uId = body.userId;
        const qId = body.queueId;

        const entry = mockQueueEntries.filter((entry) => (qId === entry.queueId && uId === entry.userId && ["WAITING", "SERVING"].includes(entry.status)));
        if (!entry) {
            return NextResponse.json( { error: "No entry found" }, { status: 404 });
        }
        
        const pos = getPosition(entry[0])

        return NextResponse.json(pos, { status: 200 })
    } catch (error) {
        return NextResponse.json( { error: "Not found" }, { status: 500 })
    }
}