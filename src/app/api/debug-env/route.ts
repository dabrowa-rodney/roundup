import { NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';

export async function GET() {
  const envKeys = Object.keys(process.env).filter(k => 
    k.includes('DATABASE') || k.includes('POSTGRES') || k.includes('NEON') || k.includes('NEXTAUTH')
  ).sort();
  
  let dbTest = 'not tested';
  try {
    const result = await db.select({ id: users.id }).from(users).limit(1);
    dbTest = `OK - ${result.length} users found`;
  } catch (e: unknown) {
    dbTest = `ERROR: ${(e as Error).message}`;
  }

  return NextResponse.json({ 
    envKeys,
    dbTest,
    databaseUrlSet: !!process.env.DATABASE_URL,
    databaseUrlPrefix: process.env.DATABASE_URL?.substring(0, 60) + '...',
  });
}
