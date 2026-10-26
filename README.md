# FNM - AI Instagram Reel Cloning & Spatial Inpainting Engine

FNM is an AI web application that clones any Instagram Reel or video and seamlessly replaces the original subject with a new subject (vehicle, product, person, or asset) in 3D perspective while retaining original camera motion and syncing music & beat drops.

## 🚀 Key Features

1. **Original Reel Link Input:**
   - Paste any Instagram Reel URL.
   - Automatically detects subject contours and isolates background audio.

2. **Universal Subject Inpainting:**
   - Upload photos or video of the replacement subject (bike, car, product, person, fashion).
   - No duration limits or file size constraints.

3. **Audio Selection (2 Modes):**
   - **Mode 1 (Retain Original Audio):** Preserves original reel music, beat drops, and sound effects.
   - **Mode 2 (Custom Audio or Mute):** Upload custom MP3 / audio track or generate silent video.

4. **Customer Accounts & History Library:**
   - Passwordless email login.
   - **"My Cloned Reels"** library showing all past generated reels, status, timestamps, and one-click download.

5. **Credit System & Flexible Pricing:**
   - Real-time credit balance display in the navigation bar.
   - Deducts 1 credit per reel generation.
   - **Starter Pack at ₹119:** 10 Cloned Reels (~₹11.9 / reel), 1080p 60fps HD, no watermark.
   - **Creator Pro Pack at ₹299:** 30 Cloned Reels.

6. **Luxury 3D Monochrome Aesthetic:**
   - Apple / Nothing OS inspired pure black & white design.
   - 3D rotating FNM spatial cube.
   - Interactive 3D mouse perspective tilt effects.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router, React 18, TypeScript)
- **Styling:** Tailwind CSS + CSS 3D transforms
- **Backend APIs:**
  - `POST /api/auth` - Email login & account persistence
  - `GET /api/reels/library` - Retrieve all client reels & credits
  - `POST /api/reels/generate` - AI cloning pipeline & credit deduction
  - `POST /api/credits/buy` - Recharge credit packs (Starter ₹119 / Pro ₹299)
- **Database:** Modular in-memory store (`src/lib/store.ts`), easily pluggable into SQLite / PostgreSQL via Prisma.

---

## 💻 How to Run Locally

```bash
cd fnm-app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🔌 Connecting Real AI Video GPUs (Production)

To connect this application to live serverless GPU models (Fal.ai, Replicate, RunPod):

1. Set your API Key in `.env.local`:
   ```env
   FAL_KEY=your_fal_api_key_here
   # or
   REPLICATE_API_TOKEN=your_replicate_token_here
   ```

2. Inside `src/app/api/reels/generate/route.ts`, connect to:
   - **Meta SAM 2** (`fal-ai/sam-2/video`) for video subject tracking.
   - **Wan 2.1 / Kling Video-to-Video** (`fal-ai/wan-2.1/video-to-video`) for diffusion inpainting.
