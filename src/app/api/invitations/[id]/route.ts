import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { invitations, classroomMembers } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id as string;
    const { action } = await req.json();

    if (!action || !['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const invitation = await db.query.invitations.findFirst({
      where: eq(invitations.id, params.id),
      with: {
        classroom: true,
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // 验证邀请是否属于当前用户
    if (invitation.inviteeId !== userId && invitation.inviteeEmail !== session.user.email) {
      return NextResponse.json({ error: 'Unauthorized to access this invitation' }, { status: 403 });
    }

    // 检查邀请状态
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation has already been processed' }, { status: 400 });
    }

    // 检查邀请是否过期
    if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
      await db.update(invitations)
        .set({ status: 'expired' })
        .where(eq(invitations.id, params.id));
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 });
    }

    if (action === 'accept') {
      // 先更新邀请状态为 accepted（带条件检查）
      const updateResult = await db.update(invitations)
        .set({ 
          status: 'accepted',
          inviteeId: userId,
          respondedAt: new Date(),
        })
        .where(and(
          eq(invitations.id, params.id),
          eq(invitations.status, 'pending') // 只更新 pending 状态的邀请
        ));

      // 如果邀请已被处理，返回错误
      if (!updateResult) {
        return NextResponse.json({ 
          error: 'Invitation has already been processed',
        }, { status: 400 });
      }

      // 尝试插入 classroom member，使用 try-catch 处理唯一约束冲突
      try {
        await db.insert(classroomMembers).values({
          id: nanoid(),
          classroomId: invitation.classroomId,
          userId,
          role: invitation.role,
          joinedAt: new Date(),
        });

        return NextResponse.json({ 
          message: 'Invitation accepted successfully',
          classroom: invitation.classroom
        });
      } catch (insertError: any) {
        // 如果是唯一约束冲突（用户已是成员），这是正常情况
        if (insertError?.code === 'ER_DUP_ENTRY' || insertError?.errno === 1062) {
          return NextResponse.json({ 
            message: 'You are already a member of this classroom',
            classroom: invitation.classroom
          });
        }
        // 其他错误重新抛出
        throw insertError;
      }
    } else {
      // 拒绝邀请
      await db.update(invitations)
        .set({ 
          status: 'declined',
          respondedAt: new Date(),
        })
        .where(eq(invitations.id, params.id));

      return NextResponse.json({ message: 'Invitation declined successfully' });
    }
  } catch (error) {
    console.error('Error responding to invitation:', error);
    return NextResponse.json({ error: 'Failed to respond to invitation' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id as string;

    const invitation = await db.query.invitations.findFirst({
      where: eq(invitations.id, params.id),
    });

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // 只有邀请者可以删除邀请
    if (invitation.inviterId !== userId) {
      return NextResponse.json({ error: 'Unauthorized to delete this invitation' }, { status: 403 });
    }

    // 只能删除待处理的邀请
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Only pending invitations can be deleted' }, { status: 400 });
    }

    await db.delete(invitations).where(eq(invitations.id, params.id));

    return NextResponse.json({ message: 'Invitation revoked successfully' });
  } catch (error) {
    console.error('Error deleting invitation:', error);
    return NextResponse.json({ error: 'Failed to delete invitation' }, { status: 500 });
  }
}
