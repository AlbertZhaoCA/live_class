import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { canvasData } from '@/db/schema';
import { nanoid } from 'nanoid';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const { whiteboardId, sessionId, canvasData: data, pageNumber } = await req.json();

    if (!whiteboardId || !sessionId || !data) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const canvasId = nanoid();

    await db.insert(canvasData).values({
      id: canvasId,
      whiteboardId,
      sessionId,
      userId: user.id,
      data: data,
      pageNumber: pageNumber || 1,
    });

    return NextResponse.json({ 
      success: true,
      canvasId,
      message: 'Whiteboard data saved successfully' 
    });
  } catch (error) {
    console.error('Error saving whiteboard data:', error);
    return NextResponse.json({ error: 'Failed to save whiteboard data' }, { status: 500 });
  }
}
