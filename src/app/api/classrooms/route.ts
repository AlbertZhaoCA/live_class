import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { classrooms, classroomMembers } from '@/db/schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;

    const userClassrooms = await db
      .select({
        id: classrooms.id,
        name: classrooms.name,
        description: classrooms.description,
        teacherId: classrooms.teacherId,
        coverImage: classrooms.coverImage,
        isActive: classrooms.isActive,
        createdAt: classrooms.createdAt,
        role: classroomMembers.role,
      })
      .from(classroomMembers)
      .leftJoin(classrooms, eq(classroomMembers.classroomId, classrooms.id))
      .where(eq(classroomMembers.userId, userId));

    return NextResponse.json(userClassrooms);
  } catch (error) {
    console.error('Get classrooms error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const userRole = (session.user as any).role;

    if (userRole !== 'teacher') {
      return NextResponse.json(
        { error: 'Only teachers can create classrooms' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, coverImage, isPublic } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Classroom name is required' },
        { status: 400 }
      );
    }

    const classroomId = nanoid();

    await db.insert(classrooms).values({
      id: classroomId,
      name,
      description,
      teacherId: userId,
      coverImage,
      isPublic: isPublic ?? true,
    });

    await db.insert(classroomMembers).values({
      id: nanoid(),
      classroomId,
      userId,
      role: 'teacher',
    });

    return NextResponse.json(
      { message: 'Classroom created successfully', classroomId },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create classroom error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
