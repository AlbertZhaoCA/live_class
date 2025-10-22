import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { teacherInviteCodes, users } from '@/db/schema';
import { eq, and, isNull, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Generate new teacher invite code (Admin only)
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  
  // Only administrators can generate invite codes
  if (user.role !== 'administrator') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const { expiresInDays } = await request.json();

    const code = nanoid(16); // Generate a 16-character code
    const id = nanoid();
    
    let expiresAt = null;
    if (expiresInDays && expiresInDays > 0) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    }

    await db.insert(teacherInviteCodes).values({
      id,
      code,
      createdById: user.id,
      expiresAt,
    });

    return NextResponse.json({ 
      id, 
      code,
      expiresAt,
      message: 'Invite code generated successfully' 
    });
  } catch (error) {
    console.error('Error generating invite code:', error);
    return NextResponse.json({ error: 'Failed to generate invite code' }, { status: 500 });
  }
}

// List all teacher invite codes (Admin only)
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  
  if (user.role !== 'administrator') {
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  try {
    const codes = await db
      .select({
        id: teacherInviteCodes.id,
        code: teacherInviteCodes.code,
        isUsed: teacherInviteCodes.isUsed,
        isRevoked: teacherInviteCodes.isRevoked,
        usedAt: teacherInviteCodes.usedAt,
        expiresAt: teacherInviteCodes.expiresAt,
        revokedAt: teacherInviteCodes.revokedAt,
        revokedReason: teacherInviteCodes.revokedReason,
        createdAt: teacherInviteCodes.createdAt,
        createdBy: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(teacherInviteCodes)
      .leftJoin(users, eq(teacherInviteCodes.createdById, users.id))
      .orderBy(teacherInviteCodes.createdAt);

    return NextResponse.json(codes);
  } catch (error) {
    console.error('Error fetching invite codes:', error);
    return NextResponse.json({ error: 'Failed to fetch invite codes' }, { status: 500 });
  }
}
