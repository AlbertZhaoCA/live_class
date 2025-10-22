import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { classrooms, classroomMembers } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id as string;

    const publicClassrooms = await db.query.classrooms.findMany({
      where: eq(classrooms.isPublic, true),
      with: {
        members: {
          with: {
            user: {
              columns: {
                id: true,
                name: true,
                email: true,
              }
            }
          }
        }
      },
      orderBy: (classrooms, { desc }) => [desc(classrooms.createdAt)],
    });

    const userClassrooms = await db.query.classroomMembers.findMany({
      where: eq(classroomMembers.userId, userId),
      columns: {
        classroomId: true,
      }
    });

    const userClassroomIds = new Set(userClassrooms.map(m => m.classroomId));

    const classroomsWithJoinStatus = publicClassrooms.map(classroom => ({
      ...classroom,
      isJoined: userClassroomIds.has(classroom.id),
      memberCount: classroom.members.length,
      teacherCount: classroom.members.filter(m => m.role === 'teacher').length,
      studentCount: classroom.members.filter(m => m.role === 'student').length,
    }));

    return NextResponse.json(classroomsWithJoinStatus);
  } catch (error) {
    console.error('Error fetching public classrooms:', error);
    return NextResponse.json({ error: 'Failed to fetch public classrooms' }, { status: 500 });
  }
}
