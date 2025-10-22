import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { tests, testQuestions, testSubmissions, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

// Get quiz details with questions
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  const { id } = params;

  try {
    // Get quiz details
    const [quiz] = await db
      .select()
      .from(tests)
      .where(eq(tests.id, id))
      .limit(1);

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // Get quiz questions
    const questions = await db
      .select()
      .from(testQuestions)
      .where(eq(testQuestions.testId, id))
      .orderBy(testQuestions.order);

    // For students, hide correct answers
    let questionsToReturn = questions;
    if (user.role === 'student') {
      questionsToReturn = questions.map(q => ({
        ...q,
        correctAnswer: null, // Hide correct answer for students
      }));
    }

    // Check if user has already submitted
    const [submission] = await db
      .select()
      .from(testSubmissions)
      .where(and(
        eq(testSubmissions.testId, id),
        eq(testSubmissions.userId, user.id)
      ))
      .limit(1);

    return NextResponse.json({
      quiz,
      questions: questionsToReturn,
      hasSubmitted: !!submission,
      submission: submission || null,
    });
  } catch (error) {
    console.error('Error fetching quiz:', error);
    return NextResponse.json({ error: 'Failed to fetch quiz' }, { status: 500 });
  }
}
