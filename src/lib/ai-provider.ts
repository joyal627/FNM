/**
 * FNM AI Video Provider Engine
 * Handles dispatching video-to-video and image-to-video synthesis jobs
 * supports Fal.ai (Wan 2.1 / Kling / LTX) and Replicate (Wan / Kling / Hunyuan)
 */

export interface GenerationRequest {
  reelUrl: string;
  subjectImage: string; // Base64 or public URL
  subjectName: string;
  audioOption: 'original' | 'custom';
}

export interface GenerationResponse {
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CONFIG_REQUIRED';
  jobId?: string;
  outputVideoUrl?: string;
  provider?: 'fal' | 'replicate' | 'local_fallback';
  missingKeys?: string[];
  message?: string;
}

export async function dispatchAiVideoJob(req: GenerationRequest): Promise<GenerationResponse> {
  const falKey = process.env.FAL_KEY;
  const replicateToken = process.env.REPLICATE_API_TOKEN;

  // 1. Fal.ai Provider (Fastest serverless video generation)
  if (falKey) {
    try {
      const response = await fetch('https://queue.fal.run/fal-ai/wan-2.1/video-to-video', {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Cinematic commercial video of ${req.subjectName}, 9:16 vertical instagram reel style, 1080p, ultra detailed, photorealistic, dynamic camera motion`,
          image_url: req.subjectImage,
          video_url: req.reelUrl,
        }),
      });

      if (!response.ok) {
        // Fallback to Fal Kling or LTX if Wan 2.1 model queue fails
        const fallbackRes = await fetch('https://queue.fal.run/fal-ai/ltx-video/image-to-video', {
          method: 'POST',
          headers: {
            'Authorization': `Key ${falKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: `Cinematic reel of ${req.subjectName}, 9:16 aspect ratio, high resolution, 60fps`,
            image_url: req.subjectImage,
          }),
        });

        if (fallbackRes.ok) {
          const data = await fallbackRes.json();
          return {
            status: 'PENDING',
            jobId: data.request_id,
            provider: 'fal',
            message: 'AI video generation dispatched to Fal.ai queue',
          };
        }

        const errData = await response.text();
        return {
          status: 'FAILED',
          message: `Fal.ai returned: ${errData}`,
        };
      }

      const data = await response.json();
      return {
        status: 'PENDING',
        jobId: data.request_id,
        provider: 'fal',
        message: 'AI video generation queued on Fal.ai',
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        message: `Fal.ai connection error: ${err.message}`,
      };
    }
  }

  // 2. Replicate Provider
  if (replicateToken) {
    try {
      const response = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${replicateToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: 'lightricks/ltx-video',
          input: {
            prompt: `Cinematic 9:16 reel of ${req.subjectName}, realistic lighting, smooth camera movement`,
            input_image: req.subjectImage,
            aspect_ratio: '9:16',
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        return {
          status: 'FAILED',
          message: data.detail || 'Replicate error',
        };
      }

      return {
        status: 'PENDING',
        jobId: data.id,
        provider: 'replicate',
        message: 'Job dispatched to Replicate',
      };
    } catch (err: any) {
      return {
        status: 'FAILED',
        message: `Replicate connection error: ${err.message}`,
      };
    }
  }

  // 3. No API Keys Configured: Return CONFIG_REQUIRED status
  return {
    status: 'CONFIG_REQUIRED',
    missingKeys: ['FAL_KEY', 'REPLICATE_API_TOKEN'],
    message: 'No AI video generation key detected. Please configure FAL_KEY or REPLICATE_API_TOKEN in your Vercel Project Settings.',
  };
}

export async function checkAiJobStatus(jobId: string, provider: 'fal' | 'replicate'): Promise<{
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  videoUrl?: string;
  error?: string;
}> {
  if (provider === 'fal') {
    const falKey = process.env.FAL_KEY;
    if (!falKey) return { status: 'FAILED', error: 'Missing FAL_KEY' };

    const res = await fetch(`https://queue.fal.run/fal-ai/wan-2.1/requests/${jobId}/status`, {
      headers: { 'Authorization': `Key ${falKey}` },
    });

    if (!res.ok) return { status: 'IN_PROGRESS' };
    const data = await res.json();

    if (data.status === 'COMPLETED') {
      const resultRes = await fetch(`https://queue.fal.run/fal-ai/wan-2.1/requests/${jobId}`, {
        headers: { 'Authorization': `Key ${falKey}` },
      });
      const resultData = await resultRes.json();
      return {
        status: 'COMPLETED',
        videoUrl: resultData.video?.url || resultData.output?.url,
      };
    }

    if (data.status === 'FAILED') {
      return { status: 'FAILED', error: data.error || 'Video rendering failed' };
    }

    return { status: 'IN_PROGRESS' };
  }

  if (provider === 'replicate') {
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) return { status: 'FAILED', error: 'Missing REPLICATE_API_TOKEN' };

    const res = await fetch(`https://api.replicate.com/v1/predictions/${jobId}`, {
      headers: { 'Authorization': `Bearer ${replicateToken}` },
    });

    if (!res.ok) return { status: 'IN_PROGRESS' };
    const data = await res.json();

    if (data.status === 'succeeded') {
      const output = Array.isArray(data.output) ? data.output[0] : data.output;
      return { status: 'COMPLETED', videoUrl: output };
    }

    if (data.status === 'failed' || data.status === 'canceled') {
      return { status: 'FAILED', error: data.error || 'Replicate job failed' };
    }

    return { status: 'IN_PROGRESS' };
  }

  return { status: 'FAILED', error: 'Unknown provider' };
}
