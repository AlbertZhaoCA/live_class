import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { classroomMembers, classrooms } from '@/db/schema';
import { nanoid } from 'nanoid';
import { eq, and } from 'drizzle-orm';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const classroomId = params.id;

    const [classroom] = await db
      .select()
      .from(classrooms)
      .where(eq(classrooms.id, classroomId))
      .limit(1);

    if (!classroom) {
      return NextResponse.json(
        { error: 'Classroom not found' },
        { status: 404 }
      );
    }

    const [existingMember] = await db
      .select()
      .from(classroomMembers)
      .where(
        and(
          eq(classroomMembers.classroomId, classroomId),
          eq(classroomMembers.userId, userId)
        )
      )
      .limit(1);

    if (existingMember) {
      return NextResponse.json(
        { error: 'Already joined this classroom' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { role } = body;

    await db.insert(classroomMembers).values({
      id: nanoid(),
      classroomId,
      userId,
      role: role || 'student',
    });

    return NextResponse.json(
      { message: 'Joined classroom successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Join classroom error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
