import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { materials, users, materialCategories } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

// GET: 获取教室的所有资料
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const classroomId = params.id;

    const rawMaterials = await db
      .select({
        id: materials.id,
        title: materials.title,
        description: materials.description,
        fileName: materials.fileName,
        fileSize: materials.fileSize,
        fileType: materials.fileType,
        fileUrl: materials.fileUrl,
        uploadedById: materials.uploadedById,
        uploaderName: users.name,
        createdAt: materials.createdAt,
        downloadCount: materials.downloadCount,
        categoryId: materials.categoryId,
        categoryName: materialCategories.name,
      })
      .from(materials)
      .leftJoin(users, eq(materials.uploadedById, users.id))
      .leftJoin(materialCategories, eq(materials.categoryId, materialCategories.id))
      .where(eq(materials.classroomId, classroomId))
      .orderBy(desc(materials.createdAt));

    return NextResponse.json(rawMaterials);
  } catch (error) {
    console.error('Error fetching materials:', error);
    return NextResponse.json({ error: 'Failed to fetch materials' }, { status: 500 });
  }
}

// POST: 添加 YouTube 视频或其他材料
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const classroomId = params.id;
    const body = await req.json();
    const { title, description, fileUrl, fileType, fileName, fileSize, categoryId, sessionId } = body;

    if (!title || !fileUrl || !fileType) {
      return NextResponse.json(
        { error: 'Title, fileUrl, and fileType are required' },
        { status: 400 }
      );
    }

    // Generate material ID
    const { nanoid } = await import('nanoid');
    const materialId = nanoid();

    await db.insert(materials).values({
      id: materialId,
      classroomId,
      sessionId: sessionId || null,
      categoryId: categoryId || null,
      uploadedById: (session.user as any).id,
      title,
      description: description || null,
      fileType,
      fileName: fileName || title,
      fileSize: fileSize || 0,
      fileUrl,
      downloadCount: 0,
    });

    return NextResponse.json({ success: true, materialId });
  } catch (error) {
    console.error('Error adding material:', error);
    return NextResponse.json({ error: 'Failed to add material' }, { status: 500 });
  }
}
