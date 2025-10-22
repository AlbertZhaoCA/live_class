import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { classroomMembers, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

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
    const { searchParams } = new URL(request.url);
    const roleFilter = searchParams.get('role');

    let conditions = [eq(classroomMembers.classroomId, classroomId)];
    
    if (roleFilter) {
      conditions.push(eq(classroomMembers.role, roleFilter as any));
    }

    const members = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: classroomMembers.role,
      })
      .from(classroomMembers)
      .leftJoin(users, eq(classroomMembers.userId, users.id))
      .where(and(...conditions));

    return NextResponse.json(members);
  } catch (error) {
    console.error('Error fetching classroom members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch classroom members' },
      { status: 500 }
    );
  }
}
