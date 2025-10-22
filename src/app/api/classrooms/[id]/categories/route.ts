import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { materialCategories } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// GET: 获取教室的所有分类
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

    const categories = await db
      .select()
      .from(materialCategories)
      .where(eq(materialCategories.classroomId, classroomId))
      .orderBy(asc(materialCategories.order));

    return NextResponse.json(categories);
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

// POST: 创建新分类
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

    // Only teachers and administrators can create categories
    if (user.role !== 'teacher' && user.role !== 'administrator') {
      return NextResponse.json({ error: 'Forbidden: Teacher access required' }, { status: 403 });
    }

    const classroomId = params.id;
    const { name, description } = await req.json();

    if (!name) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    // Get the max order number for this classroom
    const existingCategories = await db
      .select()
      .from(materialCategories)
      .where(eq(materialCategories.classroomId, classroomId));

    const maxOrder = existingCategories.length > 0
      ? Math.max(...existingCategories.map(c => c.order))
      : 0;

    const categoryId = nanoid();
    await db.insert(materialCategories).values({
      id: categoryId,
      classroomId,
      name,
      description: description || null,
      order: maxOrder + 1,
    });

    return NextResponse.json({ success: true, id: categoryId });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
  }
}
