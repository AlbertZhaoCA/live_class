import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { teacherInviteCodes } from '@/db/schema';
import { eq } from 'drizzle-orm';

// Validate teacher invite code (Public endpoint for registration)
export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: 'Code is required' }, { status: 400 });
    }

    const [inviteCode] = await db
      .select()
      .from(teacherInviteCodes)
      .where(eq(teacherInviteCodes.code, code))
      .limit(1);

    if (!inviteCode) {
      return NextResponse.json({ error: 'Invalid invite code' }, { status: 404 });
    }

    if (inviteCode.isUsed) {
      return NextResponse.json({ error: 'Invite code already used' }, { status: 400 });
    }

    if (inviteCode.isRevoked) {
      return NextResponse.json({ error: 'Invite code has been revoked' }, { status: 400 });
    }

    if (inviteCode.expiresAt && new Date(inviteCode.expiresAt) < new Date()) {
      return NextResponse.json({ error: 'Invite code has expired' }, { status: 400 });
    }

    return NextResponse.json({ 
      valid: true, 
      codeId: inviteCode.id,
      message: 'Valid invite code' 
    });
  } catch (error) {
    console.error('Error validating invite code:', error);
    return NextResponse.json({ error: 'Failed to validate invite code' }, { status: 500 });
  }
}
