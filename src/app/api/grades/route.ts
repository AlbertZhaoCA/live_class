import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { grades, users, tests } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  const { searchParams } = new URL(request.url);
  const classroomId = searchParams.get('classroomId');
  const studentId = searchParams.get('studentId');

  if (!classroomId) {
    return NextResponse.json({ error: 'classroomId is required' }, { status: 400 });
  }

  try {
    let targetUserId = user.id;
    
    if ((user.role === 'teacher' || user.role === 'administrator') && studentId) {
      targetUserId = studentId;
    }

    const quizGradesRaw = await db
      .select({
        gradeId: grades.id,
        quizId: tests.id,
        quizTitle: tests.title,
        score: grades.score,
        maxScore: grades.maxScore,
        percentage: grades.percentage,
        createdAt: grades.createdAt,
      })
      .from(grades)
      .leftJoin(tests, eq(grades.testId, tests.id))
      .where(and(
        eq(grades.classroomId, classroomId),
        eq(grades.userId, targetUserId)
      ))
      .orderBy(grades.createdAt);

    const quizGrades = quizGradesRaw.map(grade => ({
      id: grade.gradeId,
      testId: grade.quizId,
      testTitle: grade.quizTitle || 'Unknown Quiz',
      score: parseFloat(grade.score || '0'),
      maxScore: parseFloat(grade.maxScore || '0'),
      percentage: parseFloat(grade.percentage || '0'),
      submittedAt: grade.createdAt,
    }));

    const totalScoreResult = await db
      .select({
        totalScore: sql<number>`SUM(CAST(${grades.score} AS DECIMAL(10,2)))`,
        totalMaxScore: sql<number>`SUM(CAST(${grades.maxScore} AS DECIMAL(10,2)))`,
      })
      .from(grades)
      .where(and(
        eq(grades.classroomId, classroomId),
        eq(grades.userId, targetUserId)
      ))
      .groupBy(grades.userId);

    const totalScore = totalScoreResult[0]?.totalScore || 0;
    const totalMaxScore = totalScoreResult[0]?.totalMaxScore || 0;
    const totalPercentage = totalMaxScore > 0 
      ? (totalScore / totalMaxScore) * 100
      : 0;

    return NextResponse.json({
      userId: targetUserId,
      classroomId,
      quizGrades,
      totalScore: parseFloat(totalScore.toString()),
      totalMaxScore: parseFloat(totalMaxScore.toString()),
      totalPercentage,
      quizCount: quizGrades.length,
    });
  } catch (error) {
    console.error('Error fetching grades:', error);
    return NextResponse.json({ error: 'Failed to fetch grades' }, { status: 500 });
  }
}
