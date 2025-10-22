import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { tests, testQuestions } from '@/db/schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

// 创建测试
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== 'teacher') {
      return NextResponse.json(
        { error: 'Only teachers can create tests' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      classroomId,
      sessionId,
      title,
      description,
      duration,
      totalPoints,
      passingScore,
      startTime,
      endTime,
      questions,
    } = body;

    if (!classroomId || !title || !duration || !totalPoints || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const testId = nanoid();
    const userId = (session.user as any).id;

    // 创建测试
    await db.insert(tests).values({
      id: testId,
      classroomId,
      sessionId: sessionId || null,
      title,
      description,
      duration,
      totalPoints,
      passingScore: passingScore || 0,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      isPublished: false,
      createdById: userId,
    });

    // 添加题目
    if (questions && questions.length > 0) {
      const questionValues = questions.map((q: any, index: number) => ({
        id: nanoid(),
        testId,
        question: q.question,
        type: q.type,
        options: q.options ? JSON.stringify(q.options) : null,
        correctAnswer: q.correctAnswer,
        points: q.points,
        order: index + 1,
      }));

      await db.insert(testQuestions).values(questionValues);
    }

    return NextResponse.json(
      { message: 'Test created successfully', testId },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 获取测试列表
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classroomId = searchParams.get('classroomId');

    if (!classroomId) {
      return NextResponse.json(
        { error: 'Classroom ID is required' },
        { status: 400 }
      );
    }

    const testList = await db
      .select()
      .from(tests)
      .where(eq(tests.classroomId, classroomId))
      .orderBy(tests.startTime);

    return NextResponse.json(testList);
  } catch (error) {
    console.error('Get tests error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
