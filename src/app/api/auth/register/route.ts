import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users, teacherInviteCodes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, role, inviteCode } = body;

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Teacher role requires an invite code (administrator can register without invite code)
    if (role === 'teacher' && !inviteCode) {
      return NextResponse.json(
        { error: 'Teacher invite code is required for teacher registration' },
        { status: 400 }
      );
    }

    // Validate invite code for teacher registration
    if (role === 'teacher' && inviteCode) {
      const [code] = await db
        .select()
        .from(teacherInviteCodes)
        .where(eq(teacherInviteCodes.code, inviteCode))
        .limit(1);

      if (!code) {
        return NextResponse.json(
          { error: 'Invalid invite code' },
          { status: 400 }
        );
      }

      if (code.isUsed) {
        return NextResponse.json(
          { error: 'Invite code already used' },
          { status: 400 }
        );
      }

      if (code.isRevoked) {
        return NextResponse.json(
          { error: 'Invite code has been revoked' },
          { status: 400 }
        );
      }

      if (code.expiresAt && new Date(code.expiresAt) < new Date()) {
        return NextResponse.json(
          { error: 'Invite code has expired' },
          { status: 400 }
        );
      }
    }

    // 检查用户是否已存在
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 400 }
      );
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const userId = nanoid();
    await db.insert(users).values({
      id: userId,
      email,
      password: hashedPassword,
      name,
      role,
    });

    // Mark invite code as used for teacher registration
    if (role === 'teacher' && inviteCode) {
      await db
        .update(teacherInviteCodes)
        .set({
          isUsed: true,
          usedById: userId,
          usedAt: new Date(),
        })
        .where(eq(teacherInviteCodes.code, inviteCode));
    }

    return NextResponse.json(
      { message: 'User created successfully', userId },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
