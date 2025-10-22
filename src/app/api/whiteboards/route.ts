import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { whiteboards } from '@/db/schema';
import { nanoid } from 'nanoid';

// POST: 创建新白板会话
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;

    // Only teachers and administrators can create whiteboards
    if (user.role !== 'teacher' && user.role !== 'administrator') {
      return NextResponse.json({ error: 'Forbidden: Teacher access required' }, { status: 403 });
    }

    const { sessionId } = await req.json();

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID is required' }, { status: 400 });
    }

    const whiteboardId = nanoid();

    await db.insert(whiteboards).values({
      id: whiteboardId,
      sessionId,
      createdById: user.id,
      isActive: true,
    });

    return NextResponse.json({ 
      success: true, 
      whiteboardId,
      message: 'Whiteboard created successfully' 
    });
  } catch (error) {
    console.error('Error creating whiteboard:', error);
    return NextResponse.json({ error: 'Failed to create whiteboard' }, { status: 500 });
  }
}
