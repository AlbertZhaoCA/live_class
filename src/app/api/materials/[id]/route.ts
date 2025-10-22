import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { materials } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { unlink } from 'fs/promises';
import { join } from 'path';

// DELETE: 删除资料
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = session.user as any;

    // Only teachers and administrators can delete materials
    if (user.role !== 'teacher' && user.role !== 'administrator') {
      return NextResponse.json({ error: 'Forbidden: Teacher access required' }, { status: 403 });
    }

    const materialId = params.id;

    // Get material info
    const material = await db
      .select()
      .from(materials)
      .where(eq(materials.id, materialId))
      .limit(1);

    if (material.length === 0) {
      return NextResponse.json({ error: 'Material not found' }, { status: 404 });
    }

    // Delete file from disk
    try {
      const fileUrl = material[0].fileUrl;
      const filePath = join(process.cwd(), 'public', fileUrl);
      await unlink(filePath);
    } catch (error) {
      console.error('Error deleting file from disk:', error);
      // Continue even if file deletion fails
    }

    // Delete from database
    await db.delete(materials).where(eq(materials.id, materialId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting material:', error);
    return NextResponse.json({ error: 'Failed to delete material' }, { status: 500 });
  }
}
