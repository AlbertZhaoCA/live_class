import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { teacherInviteCodes } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Revoke a teacher invite code (Admin only)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  
  if (user.role !== 'administrator') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const { reason } = await request.json();
    const { id } = params;

    const [code] = await db
      .select()
      .from(teacherInviteCodes)
      .where(eq(teacherInviteCodes.id, id))
      .limit(1);

    if (!code) {
      return NextResponse.json({ error: 'Invite code not found' }, { status: 404 });
    }

    if (code.isRevoked) {
      return NextResponse.json({ error: 'Invite code already revoked' }, { status: 400 });
    }

    if (code.isUsed) {
      return NextResponse.json({ error: 'Cannot revoke used invite code' }, { status: 400 });
    }

    await db
      .update(teacherInviteCodes)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason || 'No reason provided',
      })
      .where(eq(teacherInviteCodes.id, id));

    return NextResponse.json({ message: 'Invite code revoked successfully' });
  } catch (error) {
    console.error('Error revoking invite code:', error);
    return NextResponse.json({ error: 'Failed to revoke invite code' }, { status: 500 });
  }
}

// Delete a teacher invite code (Admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  
  if (user.role !== 'administrator') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const { id } = params;

    const [code] = await db
      .select()
      .from(teacherInviteCodes)
      .where(eq(teacherInviteCodes.id, id))
      .limit(1);

    if (!code) {
      return NextResponse.json({ error: 'Invite code not found' }, { status: 404 });
    }

    if (code.isUsed) {
      return NextResponse.json({ error: 'Cannot delete used invite code' }, { status: 400 });
    }

    await db
      .delete(teacherInviteCodes)
      .where(eq(teacherInviteCodes.id, id));

    return NextResponse.json({ message: 'Invite code deleted successfully' });
  } catch (error) {
    console.error('Error deleting invite code:', error);
    return NextResponse.json({ error: 'Failed to delete invite code' }, { status: 500 });
  }
}
