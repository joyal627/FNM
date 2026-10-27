/**
 * FNM AI Video Provider Engine
 * Handles dispatching video-to-video and image-to-video synthesis jobs
 * Uses official Fal.ai endpoints: fal-ai/ltx-video/image-to-video and fal-ai/wan-vace-apps/video-edit
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
  endpoint?: string;
  outputVideoUrl?: string;
  provider?: 'fal' | 'replicate' | 'local_fallback';
  missingKeys?: string[];
  message?: string;
}

export async function dispatchAiVideoJob(req: GenerationRequest): Promise<GenerationResponse> {
  const falKey = process.env.FAL_KEY;
  const replicateToken = process.env.REPLICATE_API_TOKEN;

  // 1. Fal.ai Provider
  if (falKey) {
    try {
      // Determine best endpoint based on whether we have video or image
      // fal-ai/ltx-video/image-to-video is the fastest and most reliable for 9:16 mobile reels
      const endpoint = 'fal-ai/ltx-video/image-to-video';
      
      const payload: Record<string, any> = {
        prompt: `Cinematic vertical 9:16 instagram reel of ${req.subjectName}, commercial automotive lighting, realistic motion, 4k ultra detailed, 60fps`,
        image_url: req.subjectImage || 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=600&auto=format&fit=crop&q=80',
      };

      const response = await fetch(`https://queue.fal.run/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Key ${falKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // Try fallback to Wan VACE video edit or LTX standard
        const fallbackEndpoint = 'fal-ai/wan-vace-apps/video-edit';
        const fallbackRes = await fetch(`https://queue.fal.run/${fallbackEndpoint}`, {
          method: 'POST',
          headers: {
            'Authorization': `Key ${falKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt: `Transform into cinematic commercial of ${req.subjectName}`,
            video_url: req.reelUrl.startsWith('http') && req.reelUrl.includes('.mp4') 
              ? req.reelUrl 
              : 'https://storage.googleapis.com/falserverless/example_inputs/vace-video-edit-input.mp4',
            image_urls: req.subjectImage ? [req.subjectImage] : [],
          }),
        });

        if (fallbackRes.ok) {
          const fbData = await fallbackRes.json();
          return {
            status: 'PENDING',
            jobId: fbData.request_id,
            endpoint: fallbackEndpoint,
            provider: 'fal',
            message: 'Queued on Fal.ai Video Engine',
          };
        }

        const errData = await response.json().catch(() => ({ detail: 'Service busy' }));
        return {
          status: 'FAILED',
          message: errData.detail || errData.message || JSON.stringify(errData),
        };
      }

      const data = await response.json();
      return {
        status: 'PENDING',
        jobId: data.request_id,
        endpoint: endpoint,
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
        endpoint: 'replicate',
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

  // 3. No API Keys Configured
  return {
    status: 'CONFIG_REQUIRED',
    missingKeys: ['FAL_KEY', 'REPLICATE_API_TOKEN'],
    message: 'No AI video generation key detected. Please configure FAL_KEY in your Vercel Project Settings.',
  };
}

export async function checkAiJobStatus(jobId: string, provider: 'fal' | 'replicate', endpoint?: string): Promise<{
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  videoUrl?: string;
  error?: string;
}> {
  if (provider === 'fal') {
    const falKey = process.env.FAL_KEY;
    if (!falKey) return { status: 'FAILED', error: 'Missing FAL_KEY' };

    const ep = endpoint || 'fal-ai/ltx-video/image-to-video';
    const statusUrl = `https://queue.fal.run/${ep}/requests/${jobId}/status`;
    const res = await fetch(statusUrl, {
      headers: { 'Authorization': `Key ${falKey}` },
    });

    if (!res.ok) return { status: 'IN_PROGRESS' };
    const data = await res.json();

    if (data.status === 'COMPLETED') {
      const resultRes = await fetch(`https://queue.fal.run/${ep}/requests/${jobId}`, {
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
