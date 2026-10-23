import { NextResponse } from 'next/server';
import queueData from '../mockData/queues.json'

export async function GET(req: Request) {
    const queues = queueData.queues;

    return NextResponse.json( queues, { status: 200 });
}