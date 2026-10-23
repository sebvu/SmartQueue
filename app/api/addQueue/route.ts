import { NextResponse } from 'next/server'
import { mockQueues } from '../../lib/server/mockData.ts'

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const newQueue = {
            queueId: body.queueId,
            orgId: body.orgId,
            name: body.name,
            description: body.description,
            expectedDurationMinutes: body.expectedDurationMinutes,
            priorityLevel: body.priorityLevel,
            isActive: true,
            isOpen: true,
            maxCapacity: body.maxCapacity,
            createdAt: new Date().toISOString(),
        };

        mockQueues.push(newQueue);

        return NextResponse.json(newQueue, { status: 201 });
    } catch {
        return NextResponse.json( { error: "failed bozoz" }, { status: 500 });
    }
}