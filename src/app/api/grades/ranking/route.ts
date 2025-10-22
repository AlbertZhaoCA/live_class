import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { grades, users } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const classroomId = searchParams.get('classroomId');

  if (!classroomId) {
    return NextResponse.json({ error: 'classroomId is required' }, { status: 400 });
  }

  try {
    // Get aggregated scores for all students in classroom
    const rankings = await db
      .select({
        userId: users.id,
        userName: users.name,
        userEmail: users.email,
        userRole: users.role,
        totalScore: sql<number>`SUM(CAST(${grades.score} AS DECIMAL(10,2)))`,
        totalMaxScore: sql<number>`SUM(CAST(${grades.maxScore} AS DECIMAL(10,2)))`,
        quizCount: sql<number>`COUNT(${grades.id})`,
        avgPercentage: sql<number>`AVG(CAST(${grades.percentage} AS DECIMAL(10,2)))`,
      })
      .from(grades)
      .leftJoin(users, eq(grades.userId, users.id))
      .where(eq(grades.classroomId, classroomId))
      .groupBy(grades.userId, users.id, users.name, users.email, users.role)
      .orderBy(sql`SUM(CAST(${grades.score} AS DECIMAL(10,2))) DESC`);

    // Add rank to each student and convert to numbers
    const rankedResults = rankings.map((student, index) => {
      const totalScore = parseFloat(student.totalScore?.toString() || '0');
      const totalMaxScore = parseFloat(student.totalMaxScore?.toString() || '0');
      const avgPercentage = parseFloat(student.avgPercentage?.toString() || '0');
      const totalPercentage = totalMaxScore > 0
        ? (totalScore / totalMaxScore) * 100
        : 0;

      return {
        rank: index + 1,
        userId: student.userId,
        userName: student.userName || 'Unknown',
        totalScore,
        totalMaxScore,
        totalPercentage,
        quizCount: student.quizCount || 0,
        avgPercentage,
      };
    });

    return NextResponse.json(rankedResults);
  } catch (error) {
    console.error('Error fetching rankings:', error);
    return NextResponse.json({ error: 'Failed to fetch rankings' }, { status: 500 });
  }
}
