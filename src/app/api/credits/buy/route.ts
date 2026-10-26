import { NextResponse } from 'next/server';
import { store } from '@/lib/store';

export async function POST(req: Request) {
  try {
    const { email, packId } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    let creditsToAdd = 10;
    let price = 119;
    let packName = 'Starter Pack';

    if (packId === 'pro-30') {
      creditsToAdd = 30;
      price = 299;
      packName = 'Creator Pro Pack';
    }

    // Process payment & update credit balance
    const updatedUser = store.addCredits(email, creditsToAdd);

    return NextResponse.json({
      success: true,
      message: `Successfully purchased ${packName} for ₹${price}`,
      addedCredits: creditsToAdd,
      currentCredits: updatedUser.credits,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
