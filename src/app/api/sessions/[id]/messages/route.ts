import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { chatMessages, users } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getIO } from '@/lib/socket';

// GET: 获取课程的历史消息
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sessionId = params.id;

    // 获取消息及发送者信息
    const rawMessages = await db
      .select({
        id: chatMessages.id,
        userId: chatMessages.userId,
        message: chatMessages.message,
        timestamp: chatMessages.createdAt,
        userName: users.name,
        type: chatMessages.type,
        metadata: chatMessages.metadata,
      })
      .from(chatMessages)
      .leftJoin(users, eq(chatMessages.userId, users.id))
      .where(eq(chatMessages.sessionId, sessionId))
      .orderBy(chatMessages.createdAt)
      .limit(100); // 最多返回100条消息

    // Convert timestamps to ensure consistent timezone handling
    const messages = rawMessages.map(msg => ({
      ...msg,
      // Return timestamp as ISO string to avoid timezone conversion issues
      timestamp: msg.timestamp instanceof Date ? msg.timestamp.toISOString() : msg.timestamp,
    }));

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST: 创建新消息（用于白板等特殊消息）
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;
    const sessionId = params.id;
    const { message, type, metadata } = await req.json();

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const messageId = nanoid();
    const now = new Date();

    await db.insert(chatMessages).values({
      id: messageId,
      sessionId,
      userId: user.id,
      message,
      type: type || 'text',
      metadata: metadata || null,
      createdAt: now,
    });

    // Broadcast via Socket.IO
    const io = getIO();
    if (io) {
      const metadataParsed = metadata ? JSON.parse(metadata) : null;
      io.to(sessionId).emit('new-message', {
        id: messageId,
        userId: user.id,
        userName: user.name,
        message,
        type: type || 'text',
        metadata: metadataParsed,
        timestamp: now,
      });
    }

    return NextResponse.json({ 
      success: true, 
      messageId,
    });
  } catch (error) {
    console.error('Error creating message:', error);
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}
