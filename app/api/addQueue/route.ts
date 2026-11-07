import { NextResponse } from 'next/server'
import { insertQueue } from '@/app/lib/server/repo';
import { generateId } from '@/app/lib/server/store';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const newQueue = {
            queueId: typeof body.queueId === 'string' && body.queueId ? body.queueId : generateId(),
            serviceId: generateId(),
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

        // The database checks every field (required, length, type, allowed values).
        try {
            insertQueue(newQueue);
        } catch {
            return NextResponse.json({ error: "Invalid queue details" }, { status: 400 });
        }

        return NextResponse.json(newQueue, { status: 201 });
    } catch {
        return NextResponse.json( { error: "failed bozoz" }, { status: 500 });
    }
}