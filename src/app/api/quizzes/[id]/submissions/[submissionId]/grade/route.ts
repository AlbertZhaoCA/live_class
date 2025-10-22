import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { testSubmissions, testQuestions, grades } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; submissionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const { id: quizId, submissionId } = params;

    // 只有教师和管理员可以批改
    if (user.role !== 'teacher' && user.role !== 'administrator') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { scores } = body; // scores: { questionId: score }

    // 获取提交记录
    const [submission] = await db
      .select()
      .from(testSubmissions)
      .where(eq(testSubmissions.id, submissionId));

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
    }

    // 获取所有题目
    const questions = await db
      .select()
      .from(testQuestions)
      .where(eq(testQuestions.testId, quizId));

    // 计算总分
    let totalScore = 0;
    let maxScore = 0;
    
    // Parse answers if it's a string
    const answers = typeof submission.answers === 'string' 
      ? JSON.parse(submission.answers) 
      : submission.answers;

    console.log('Grading submission:', {
      submissionId,
      answers,
      answersType: typeof submission.answers,
      scores,
      questionsCount: questions.length
    });

    for (const question of questions) {
      maxScore += question.points;
      const userAnswer = answers[question.id];

      console.log(`Question ${question.id}:`, {
        type: question.type,
        userAnswer,
        correctAnswer: question.correctAnswer,
        points: question.points
      });

      // 自动批改的题目
      if (question.type === 'multiple_choice' || question.type === 'true_false') {
        if (userAnswer === question.correctAnswer) {
          totalScore += question.points;
          console.log(`✓ Correct! Adding ${question.points} points. Total: ${totalScore}`);
        } else {
          console.log(`✗ Wrong. userAnswer="${userAnswer}" correctAnswer="${question.correctAnswer}"`);
        }
      } 
      // 人工批改的题目
      else if (question.type === 'short_answer' || question.type === 'essay') {
        if (scores[question.id] !== undefined) {
          const pointsToAdd = Math.min(scores[question.id], question.points);
          totalScore += pointsToAdd;
          console.log(`Manual grading: ${pointsToAdd} points. Total: ${totalScore}`);
        }
      }
    }

    // 更新提交记录的分数和批改时间
    await db
      .update(testSubmissions)
      .set({ 
        score: totalScore.toString(),
        gradedAt: new Date(),
      })
      .where(eq(testSubmissions.id, submissionId));

    // 更新成绩记录
    const percentage = (totalScore / maxScore) * 100;
    await db
      .update(grades)
      .set({
        score: totalScore.toString(),
        maxScore: maxScore.toString(),
        percentage: percentage.toFixed(2),
      })
      .where(
        and(
          eq(grades.userId, submission.userId),
          eq(grades.testId, quizId)
        )
      );

    return NextResponse.json({
      success: true,
      score: totalScore,
      maxScore: maxScore,
      percentage: parseFloat(percentage.toFixed(2)),
    });
  } catch (error) {
    console.error('Error grading submission:', error);
    return NextResponse.json(
      { error: 'Failed to grade submission' },
      { status: 500 }
    );
  }
}
