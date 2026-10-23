import { NextResponse } from 'next/server'
import { mockQueueEntries } from "@/app/lib/server/mockData";
import type { QueueEntry } from '@/app/lib/server/types';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const newEntry: QueueEntry = {
            entryId: `e${Date.now()}`,
            userId: body.userId,
            queueId: body.queueId,
            joinedAt: `${new Date().toISOString}`,
            endedAt: null,
            status: 'WAITING',
            roleIds: body.roleIds
        }
        mockQueueEntries.push(newEntry);
        return NextResponse.json("Joined queue", { status: 200 })
    } catch (error) {
        return NextResponse.json({ error: "didn't join queue oops" }, { status: 500 });
    }
}