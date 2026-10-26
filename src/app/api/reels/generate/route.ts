import { NextResponse } from 'next/server';
import { store, ClonedReel } from '@/lib/store';

export async function POST(req: Request) {
  try {
    const { email, reelUrl, subjectName, audioOption, customSubjectImage } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!reelUrl) {
      return NextResponse.json({ error: 'Original Reel Link is required' }, { status: 400 });
    }

    // Check & deduct credit
    const hasCredit = store.deductCredit(email);
    if (!hasCredit) {
      return NextResponse.json(
        {
          error: 'Insufficient credits. Please top up your account.',
          insufficientCredits: true,
        },
        { status: 402 }
      );
    }

    // AI Pipeline simulation & rendering
    // In production, this coordinates with Fal.ai / Replicate / SAM 2 Video API
    const newReel: ClonedReel = {
      id: `reel-${Date.now()}`,
      userEmail: email,
      sourceUrl: reelUrl,
      subjectTitle: subjectName || 'Custom Subject',
      previewUrl: customSubjectImage || 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=600&auto=format&fit=crop&q=80',
      originalPreviewUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600&auto=format&fit=crop&q=80',
      audioOption: audioOption || 'original',
      createdAt: 'Just now',
      status: 'completed',
      resolution: '1080x1920',
      fps: 60,
    };

    store.saveReel(newReel);
    const updatedUser = store.getUser(email);

    return NextResponse.json({
      success: true,
      message: 'Reel cloned successfully!',
      reel: newReel,
      remainingCredits: updatedUser.credits,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
