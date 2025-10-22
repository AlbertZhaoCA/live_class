import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { whiteboards } from '@/db/schema';
import { eq } from 'drizzle-orm';

// PATCH: 关闭白板
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;

    // Only teachers and administrators can close whiteboards
    if (user.role !== 'teacher' && user.role !== 'administrator') {
      return NextResponse.json({ error: 'Forbidden: Teacher access required' }, { status: 403 });
    }

    const whiteboardId = params.id;

    await db
      .update(whiteboards)
      .set({ 
        isActive: false,
        closedAt: new Date(),
      })
      .where(eq(whiteboards.id, whiteboardId));

    return NextResponse.json({ 
      success: true,
      message: 'Whiteboard closed successfully' 
    });
  } catch (error) {
    console.error('Error closing whiteboard:', error);
    return NextResponse.json({ error: 'Failed to close whiteboard' }, { status: 500 });
  }
}
