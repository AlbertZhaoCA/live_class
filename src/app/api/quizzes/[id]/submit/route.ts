import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { testSubmissions, tests, testQuestions, grades } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Submit quiz answers
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;
  const { id: testId } = params;

  try {
    const { answers } = await request.json();

    if (!answers) {
      return NextResponse.json({ error: 'Answers are required' }, { status: 400 });
    }

    // Check if already submitted
    const [existing] = await db
      .select()
      .from(testSubmissions)
      .where(and(
        eq(testSubmissions.testId, testId),
        eq(testSubmissions.userId, user.id)
      ))
      .limit(1);

    if (existing) {
      return NextResponse.json({ error: 'Quiz already submitted' }, { status: 400 });
    }

    // Get quiz details
    const [quiz] = await db
      .select()
      .from(tests)
      .where(eq(tests.id, testId))
      .limit(1);

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    // Check if quiz is still open
    if (new Date() > new Date(quiz.endTime)) {
      return NextResponse.json({ error: 'Quiz has ended' }, { status: 400 });
    }

    // Get questions
    const questions = await db
      .select()
      .from(testQuestions)
      .where(eq(testQuestions.testId, testId));

    // Auto-grade multiple choice and true/false questions
    let totalScore = 0;
    const questionResults: any = {};

    console.log('Auto-grading submission:', {
      testId,
      userId: user.id,
      answersReceived: answers,
      questionsCount: questions.length
    });

    for (const question of questions) {
      const userAnswer = answers[question.id];
      questionResults[question.id] = {
        answer: userAnswer,
        correct: false,
        points: 0,
      };

      console.log(`Checking question ${question.id}:`, {
        type: question.type,
        userAnswer,
        userAnswerType: typeof userAnswer,
        correctAnswer: question.correctAnswer,
        correctAnswerType: typeof question.correctAnswer,
        match: userAnswer === question.correctAnswer,
        points: question.points,
        pointsType: typeof question.points
      });

      if (question.type === 'multiple_choice' || question.type === 'true_false') {
        if (userAnswer === question.correctAnswer) {
          const pointsToAdd = Number(question.points) || 0;
          totalScore += pointsToAdd;
          questionResults[question.id].correct = true;
          questionResults[question.id].points = pointsToAdd;
          console.log(`✓ Correct! Adding ${pointsToAdd} points. Total score: ${totalScore}`);
        } else {
          console.log(`✗ Wrong. Expected "${question.correctAnswer}" but got "${userAnswer}"`);
        }
      }
      // Short answer and essay need manual grading
    }

    console.log('Final auto-grade result:', { totalScore });

    // Create submission
    const submissionId = nanoid();
    console.log('Creating submission with answers:', answers);
    
    await db.insert(testSubmissions).values({
      id: submissionId,
      testId,
      userId: user.id,
      answers: answers, // Drizzle will handle JSON serialization
      score: totalScore.toString(),
      submittedAt: new Date(),
      gradedAt: null, // Will be set after manual grading if needed
    });

    // Create grade record
    const gradeId = nanoid();
    await db.insert(grades).values({
      id: gradeId,
      classroomId: quiz.classroomId,
      userId: user.id,
      testId,
      score: totalScore.toString(),
      maxScore: quiz.totalPoints.toString(),
      percentage: ((totalScore / quiz.totalPoints) * 100).toFixed(2),
    });

    return NextResponse.json({
      submissionId,
      score: totalScore,
      maxScore: quiz.totalPoints,
      percentage: ((totalScore / quiz.totalPoints) * 100).toFixed(2),
      needsManualGrading: questions.some(q => 
        q.type === 'short_answer' || q.type === 'essay'
      ),
      message: 'Quiz submitted successfully',
    });
  } catch (error) {
    console.error('Error submitting quiz:', error);
    return NextResponse.json({ error: 'Failed to submit quiz' }, { status: 500 });
  }
}
