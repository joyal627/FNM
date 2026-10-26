import { NextResponse } from 'next/server';
import { checkAiJobStatus } from '@/lib/ai-provider';
import { store, ClonedReel } from '@/lib/store';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    const provider = searchParams.get('provider') as 'fal' | 'replicate';
    const email = searchParams.get('email') || 'client@brand.com';
    const subjectTitle = searchParams.get('subjectTitle') || 'Custom Subject';

    if (!jobId || !provider) {
      return NextResponse.json({ error: 'Missing jobId or provider' }, { status: 400 });
    }

    const result = await checkAiJobStatus(jobId, provider);

    if (result.status === 'COMPLETED' && result.videoUrl) {
      const newReel: ClonedReel = {
        id: `reel-${Date.now()}`,
        userEmail: email,
        sourceUrl: 'Instagram Reel',
        subjectTitle,
        previewUrl: result.videoUrl,
        originalPreviewUrl: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=600&auto=format&fit=crop&q=80',
        audioOption: 'original',
        createdAt: 'Just now',
        status: 'completed',
        resolution: '1080x1920',
        fps: 60,
      };

      store.saveReel(newReel);

      return NextResponse.json({
        status: 'COMPLETED',
        videoUrl: result.videoUrl,
        reel: newReel,
      });
    }

    return NextResponse.json({
      status: result.status,
      error: result.error,
    });
  } catch (error: any) {
    return NextResponse.json({ status: 'FAILED', error: error.message }, { status: 500 });
  }
}
