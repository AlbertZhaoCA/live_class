import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { testSubmissions, users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const quizId = params.id;

    // 只有教师和管理员可以查看所有提交
    if (user.role !== 'teacher' && user.role !== 'administrator') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 获取所有提交记录
    const submissionsRaw = await db
      .select({
        id: testSubmissions.id,
        userId: testSubmissions.userId,
        userName: users.name,
        score: testSubmissions.score,
        submittedAt: testSubmissions.submittedAt,
        answers: testSubmissions.answers,
      })
      .from(testSubmissions)
      .leftJoin(users, eq(testSubmissions.userId, users.id))
      .where(eq(testSubmissions.testId, quizId));

    // Convert score from decimal string to number and parse answers JSON
    const submissions = submissionsRaw.map(sub => ({
      ...sub,
      score: parseFloat(sub.score || '0'),
      answers: typeof sub.answers === 'string' ? JSON.parse(sub.answers) : sub.answers,
    }));

    console.log('Processed submissions:', submissions.map(s => ({
      id: s.id,
      answersType: typeof s.answers,
      answers: s.answers
    })));

    return NextResponse.json(submissions);
  } catch (error) {
    console.error('Error fetching submissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    );
  }
}
