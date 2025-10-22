import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { invitations, users, classrooms, classroomMembers } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id as string;
    const { classroomId, inviteeEmail, role, message } = await req.json();

    console.log('Creating invitation - userId:', userId, 'classroomId:', classroomId, 'inviteeEmail:', inviteeEmail);

    if (!classroomId || !inviteeEmail) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const classroom = await db.query.classrooms.findFirst({
      where: eq(classrooms.id, classroomId),
    });

    console.log('Classroom query result:', classroom);

    if (!classroom) {
      return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
    }

    const isCreator = classroom.teacherId === userId;
    
    const membership = await db.query.classroomMembers.findFirst({
      where: and(
        eq(classroomMembers.classroomId, classroomId),
        eq(classroomMembers.userId, userId),
        eq(classroomMembers.role, 'teacher')
      ),
    });

    console.log('Membership query result:', membership);
    console.log('Is creator:', isCreator, 'teacherId:', classroom.teacherId, 'userId:', userId);

    if (!isCreator && !membership) {
      return NextResponse.json({ error: 'Only teachers can invite students' }, { status: 403 });
    }

    const invitee = await db.query.users.findFirst({
      where: eq(users.email, inviteeEmail),
    });

    if (invitee) {
      const existingMember = await db.query.classroomMembers.findFirst({
        where: and(
          eq(classroomMembers.classroomId, classroomId),
          eq(classroomMembers.userId, invitee.id)
        ),
      });

      if (existingMember) {
        return NextResponse.json({ error: 'User is already a member of the classroom' }, { status: 400 });
      }

      const existingInvitation = await db.query.invitations.findFirst({
        where: and(
          eq(invitations.classroomId, classroomId),
          eq(invitations.inviteeId, invitee.id),
          eq(invitations.status, 'pending')
        ),
      });

      if (existingInvitation) {
        return NextResponse.json({ error: 'Existing pending invitation found' }, { status: 400 });
      }
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const newInvitation = await db.insert(invitations).values({
      id: nanoid(),
      classroomId,
      inviterId: userId,
      inviteeEmail,
      inviteeId: invitee?.id || null,
      role: role || 'student',
      status: 'pending',
      message: message || null,
      expiresAt,
      createdAt: new Date(),
    });

    return NextResponse.json({ 
      message: 'Invitation sent successfully',
      invitation: newInvitation
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating invitation:', error);
    return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
  }
}

// GET: 获取邀请列表
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id as string;
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'received' 或 'sent'
    const status = searchParams.get('status'); // 'pending', 'accepted', 'declined', 'expired'

    let query;

    if (type === 'sent') {
      // 查看我发送的邀请（作为老师）
      query = db.query.invitations.findMany({
        where: and(
          eq(invitations.inviterId, userId),
          status ? eq(invitations.status, status as any) : undefined
        ),
        with: {
          classroom: true,
          invitee: {
            columns: {
              id: true,
              name: true,
              email: true,
            }
          },
        },
        orderBy: (invitations, { desc }) => [desc(invitations.createdAt)],
      });
    } else {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }

      query = db.query.invitations.findMany({
        where: and(
          or(
            eq(invitations.inviteeId, userId),
            eq(invitations.inviteeEmail, user.email)
          ),
          status ? eq(invitations.status, status as any) : undefined
        ),
        with: {
          classroom: true,
          inviter: {
            columns: {
              id: true,
              name: true,
              email: true,
            }
          },
        },
        orderBy: (invitations, { desc }) => [desc(invitations.createdAt)],
      });
    }

    const results = await query;

    const now = new Date();
    for (const invitation of results) {
      if (
        invitation.status === 'pending' &&
        invitation.expiresAt &&
        new Date(invitation.expiresAt) < now
      ) {
        await db.update(invitations)
          .set({ status: 'expired' })
          .where(eq(invitations.id, invitation.id));
        invitation.status = 'expired';
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error fetching invitation list:', error);
    return NextResponse.json({ error: 'Failed to fetch invitation list' }, { status: 500 });
  }
}
