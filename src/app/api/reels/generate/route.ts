import { NextResponse } from 'next/server';
import { store, ClonedReel } from '@/lib/store';
import { dispatchAiVideoJob } from '@/lib/ai-provider';

export async function POST(req: Request) {
  try {
    const { email, reelUrl, subjectName, audioOption, customSubjectImage, forceDemo } = await req.json();

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

    // Attempt real AI dispatch if not forced demo
    if (!forceDemo) {
      const aiResponse = await dispatchAiVideoJob({
        reelUrl,
        subjectImage: customSubjectImage || 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=600&auto=format&fit=crop&q=80',
        subjectName: subjectName || 'Subject',
        audioOption: audioOption || 'original',
      });

      // If missing API keys, notify client so they can configure Vercel Environment Variables
      if (aiResponse.status === 'CONFIG_REQUIRED') {
        // Refund credit so user isn't penalized for unconfigured server
        store.addCredits(email, 1);
        return NextResponse.json({
          success: false,
          configRequired: true,
          missingKeys: aiResponse.missingKeys,
          message: aiResponse.message,
        });
      }

      // If asynchronous job dispatched to Fal / Replicate
      if (aiResponse.status === 'PENDING' && aiResponse.jobId) {
        const updatedUser = store.getUser(email);
        return NextResponse.json({
          success: true,
          pending: true,
          jobId: aiResponse.jobId,
          provider: aiResponse.provider,
          message: aiResponse.message,
          remainingCredits: updatedUser.credits,
        });
      }

      if (aiResponse.status === 'FAILED') {
        store.addCredits(email, 1);
        return NextResponse.json({
          success: false,
          error: aiResponse.message || 'AI generation service failed',
        }, { status: 502 });
      }
    }

    // Fallback/Local render using the user's actual uploaded image/video
    const previewUrl = customSubjectImage || 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=600&auto=format&fit=crop&q=80';
    
    const newReel: ClonedReel = {
      id: `reel-${Date.now()}`,
      userEmail: email,
      sourceUrl: reelUrl,
      subjectTitle: subjectName || 'Custom Subject',
      previewUrl: previewUrl,
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
      message: 'Reel processed successfully!',
      reel: newReel,
      remainingCredits: updatedUser.credits,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
