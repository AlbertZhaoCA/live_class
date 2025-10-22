import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { testSubmissions, tests, testQuestions } from '@/db/schema';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';

// 提交测试答案
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const testId = params.id;

    const body = await request.json();
    const { answers } = body;

    if (!answers) {
      return NextResponse.json(
        { error: 'Answers are required' },
        { status: 400 }
      );
    }

    // 获取测试题目
    const questions = await db
      .select()
      .from(testQuestions)
      .where(eq(testQuestions.testId, testId));

    // 自动评分（仅针对选择题和判断题）
    let totalScore = 0;
    for (const question of questions) {
      if (question.type === 'multiple_choice' || question.type === 'true_false') {
        const studentAnswer = answers[question.id];
        if (studentAnswer === question.correctAnswer) {
          totalScore += question.points;
        }
      }
    }

    const submissionId = nanoid();

    await db.insert(testSubmissions).values({
      id: submissionId,
      testId,
      userId,
      answers: JSON.stringify(answers),
      score: totalScore.toString(),
    });

    return NextResponse.json(
      { message: 'Test submitted successfully', submissionId, score: totalScore },
      { status: 201 }
    );
  } catch (error) {
    console.error('Submit test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
