import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { sessions } from '@/db/schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const classroomId = params.id;
    const body = await request.json();
    const { title, description, scheduledAt, isPublic, duration } = body;

    if (!title || !scheduledAt) {
      return NextResponse.json(
        { error: 'Title and scheduled time are required' },
        { status: 400 }
      );
    }

    const sessionId = nanoid();

    await db.insert(sessions).values({
      id: sessionId,
      classroomId,
      title,
      description,
      scheduledAt: new Date(scheduledAt),
      duration: duration || 90, // 默认90分钟
      status: 'scheduled',
      isPublic: isPublic !== undefined ? isPublic : true, // 默认公开
    });

    return NextResponse.json(
      { message: 'Session created successfully', sessionId },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create session error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 获取课堂的所有会话
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const classroomId = params.id;
    const userRole = (session.user as any).role;

    const allSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.classroomId, classroomId))
      .orderBy(sessions.scheduledAt);

    // Calculate dynamic status based on current time
    const now = new Date();
    const sessionsWithStatus = allSessions.map((session) => {
      let dynamicStatus = session.status;
      
      // Only calculate dynamic status if it's not manually ended
      if (session.status !== 'ended') {
        const scheduledTime = new Date(session.scheduledAt);
        
        // Calculate expected end time based on duration
        const expectedEndTime = new Date(scheduledTime.getTime() + (session.duration || 90) * 60 * 1000);
        
        // Use manual endedAt if available, otherwise use expected end time
        const actualEndTime = session.endedAt ? new Date(session.endedAt) : expectedEndTime;
        
        if (scheduledTime <= now) {
          // If session has started
          if (actualEndTime < now) {
            dynamicStatus = 'ended';
          } else {
            dynamicStatus = 'live';
          }
        } else {
          dynamicStatus = 'scheduled';
        }
      }
      
      return {
        ...session,
        status: dynamicStatus,
      };
    });

    let classroomSessions = sessionsWithStatus;
    if (userRole === 'student' || userRole === 'observer') {
      classroomSessions = sessionsWithStatus.filter((s) => s.isPublic);
    }

    return NextResponse.json(classroomSessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
