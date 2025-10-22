import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { materials } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

// POST: 追踪下载
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const materialId = params.id;

    // Increment download count
    await db
      .update(materials)
      .set({ downloadCount: sql`${materials.downloadCount} + 1` })
      .where(eq(materials.id, materialId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error tracking download:', error);
    return NextResponse.json({ error: 'Failed to track download' }, { status: 500 });
  }
}
