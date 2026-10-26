import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get('email') || 'client@brand.com';

    const user = store.getUser(email);
    const reels = store.getUserReels(email);

    return NextResponse.json({
      success: true,
      email: user.email,
      credits: user.credits,
      reels,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
