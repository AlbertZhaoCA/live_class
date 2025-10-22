import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { nanoid } from 'nanoid';
import { db } from '@/db';
import { materials, chatMessages } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getIO } from '@/lib/socket';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;

    // Only teachers and administrators can upload files
    if (user.role !== 'teacher' && user.role !== 'administrator') {
      return NextResponse.json({ error: 'Forbidden: Teacher access required' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const classroomId = formData.get('classroomId') as string;
    const sessionId = formData.get('sessionId') as string | null;
    const categoryId = formData.get('categoryId') as string | null;
    const title = formData.get('title') as string | null;
    const description = formData.get('description') as string | null;
    const publishToChat = formData.get('publishToChat') === 'true';

    if (!file || !classroomId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate file size (max 50MB)
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 50MB limit' }, { status: 400 });
    }

    // Get file extension
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    
    // Determine file type
    const fileTypeMap: Record<string, string> = {
      'pdf': 'pdf',
      'ppt': 'ppt',
      'pptx': 'pptx',
      'doc': 'doc',
      'docx': 'docx',
      'xls': 'xls',
      'xlsx': 'xlsx',
      'png': 'image',
      'jpg': 'image',
      'jpeg': 'image',
      'gif': 'image',
      'mp4': 'video',
      'avi': 'video',
      'mov': 'video',
    };
    
    const fileType = fileTypeMap[fileExt] || 'other';

    // Generate unique filename
    const uniqueId = nanoid();
    const fileName = `${uniqueId}_${file.name}`;
    
    // Create upload directory if it doesn't exist
    const uploadDir = join(process.cwd(), 'public', 'uploads', classroomId);
    await mkdir(uploadDir, { recursive: true });

    // Save file
    const filePath = join(uploadDir, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // File URL (accessible via /uploads/...)
    const fileUrl = `/uploads/${classroomId}/${fileName}`;

    // Create material record
    const materialId = nanoid();
    let chatMessageId: string | null = null;

    await db.insert(materials).values({
      id: materialId,
      classroomId,
      sessionId: sessionId || null,
      categoryId: categoryId || null,
      chatMessageId: null, // Will update if sending to chat
      uploadedById: user.id,
      title: title || file.name,
      description: description || null,
      fileType: fileType as any,
      fileName: file.name,
      fileSize: file.size,
      fileUrl,
      downloadCount: 0,
    });

    // Send to chat if requested
    if (publishToChat && sessionId) {
      chatMessageId = nanoid();
      
      const fileIcon = {
        'pdf': '📄',
        'ppt': '📊',
        'pptx': '📊',
        'doc': '📝',
        'docx': '📝',
        'xls': '📈',
        'xlsx': '📈',
        'image': '🖼️',
        'video': '🎥',
        'other': '📎',
      }[fileType] || '📎';

      const now = new Date();

      await db.insert(chatMessages).values({
        id: chatMessageId,
        sessionId,
        userId: user.id,
        message: `${fileIcon} **File Shared: ${title || file.name}**\n${description || ''}\n📦 Size: ${(file.size / 1024).toFixed(2)} KB`,
        type: 'file',
        metadata: JSON.stringify({
          materialId,
          fileUrl,
          fileName: file.name,
          fileSize: file.size,
          fileType,
        }),
        createdAt: now,
      });

      // Update material with chat message ID
      await db.update(materials)
        .set({ chatMessageId })
        .where(eq(materials.id, materialId));

      // Broadcast the file message via Socket.IO
      const io = getIO();
      if (io) {
        io.to(sessionId).emit('new-message', {
          id: chatMessageId,
          userId: user.id,
          userName: user.name,
          message: `${fileIcon} **File Shared: ${title || file.name}**\n${description || ''}\n📦 Size: ${(file.size / 1024).toFixed(2)} KB`,
          type: 'file',
          metadata: {
            materialId,
            fileUrl,
            fileName: file.name,
            fileSize: file.size,
            fileType,
          },
          timestamp: now,
        });
      }
    }

    return NextResponse.json({
      success: true,
      materialId,
      chatMessageId,
      fileUrl,
      message: 'File uploaded successfully',
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
