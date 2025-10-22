import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { tests, testQuestions, chatMessages } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Create/Publish a quiz
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const user = session.user as any;

  // Only teachers and administrators can create quizzes
  if (user.role !== 'teacher' && user.role !== 'administrator') {
    return NextResponse.json({ error: 'Forbidden: Teacher access required' }, { status: 403 });
  }

  try {
    const {
      classroomId,
      sessionId,
      title,
      description,
      duration,
      passingScore,
      startTime,
      endTime,
      questions,
      publishInChat,
    } = await request.json();

    if (!classroomId || !title || !duration || !questions || questions.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question || !q.question.trim()) {
        return NextResponse.json({ error: `Question ${i + 1} text is required` }, { status: 400 });
      }
      if (!q.type) {
        return NextResponse.json({ error: `Question ${i + 1} type is required` }, { status: 400 });
      }
      if (q.points === undefined || q.points === null || q.points < 0) {
        return NextResponse.json({ error: `Question ${i + 1} points must be >= 0` }, { status: 400 });
      }
    }

    // Calculate total points
    const totalPoints = questions.reduce((sum: number, q: any) => sum + (q.points || 0), 0);

    const testId = nanoid();
    let chatMessageId = null;

    // Create the quiz
    await db.insert(tests).values({
      id: testId,
      classroomId,
      sessionId: sessionId || null,
      title,
      description: description || null,
      duration,
      totalPoints,
      passingScore: passingScore || Math.floor(totalPoints * 0.6), // Default 60%
      startTime: new Date(startTime || Date.now()),
      endTime: new Date(endTime || Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
      isPublished: true,
      publishedInChat: publishInChat || false,
      createdById: user.id,
    });

    // Create quiz questions
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      console.log(`Creating question ${i + 1}:`, {
        question: q.question,
        type: q.type,
        points: q.points,
        hasOptions: q.options && q.options.length > 0
      });
      
      await db.insert(testQuestions).values({
        id: nanoid(),
        testId,
        question: q.question,
        type: q.type,
        options: q.options && q.options.length > 0 ? q.options : null,
        correctAnswer: q.correctAnswer || null,
        points: q.points,
        order: i + 1,
      });
    }

    // If publish in chat, create a chat message with quiz link
    if (publishInChat && sessionId) {
      chatMessageId = nanoid();
      await db.insert(chatMessages).values({
        id: chatMessageId,
        sessionId,
        userId: user.id,
        message: `📝 Quiz Published: **${title}**\n${description || ''}\n⏱️ Duration: ${duration} minutes | 📊 Total Points: ${totalPoints}\n🔗 Quiz ID: ${testId}`,
        type: 'announcement',
        createdAt: new Date(),
      });

      // Update quiz with chat message ID
      await db
        .update(tests)
        .set({ chatMessageId })
        .where(eq(tests.id, testId));
    }

    return NextResponse.json({
      testId,
      chatMessageId,
      message: 'Quiz published successfully',
    });
  } catch (error) {
    console.error('Error publishing quiz:', error);
    return NextResponse.json({ error: 'Failed to publish quiz' }, { status: 500 });
  }
}

// Get all quizzes for a classroom/session
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const classroomId = searchParams.get('classroomId');
  const sessionId = searchParams.get('sessionId');

  if (!classroomId) {
    return NextResponse.json({ error: 'classroomId is required' }, { status: 400 });
  }

  try {
    const conditions = [eq(tests.classroomId, classroomId)];
    if (sessionId) {
      conditions.push(eq(tests.sessionId, sessionId));
    }

    const quizzes = await db
      .select()
      .from(tests)
      .where(and(...conditions))
      .orderBy(tests.createdAt);

    return NextResponse.json(quizzes);
  } catch (error) {
    console.error('Error fetching quizzes:', error);
    return NextResponse.json({ error: 'Failed to fetch quizzes' }, { status: 500 });
  }
}
