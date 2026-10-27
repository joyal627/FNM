'use client';

import React, { useState, useEffect, useRef } from 'react';

interface ClonedReel {
  id: string;
  userEmail: string;
  sourceUrl: string;
  subjectTitle: string;
  previewUrl: string;
  originalPreviewUrl: string;
  audioOption: 'original' | 'custom';
  createdAt: string;
  status: 'completed' | 'processing' | 'failed';
  resolution: string;
  fps: number;
}

export default function Home() {
  // Authentication state (null while checking localStorage on client)
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // Navigation & Modal states
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [missingKeys, setMissingKeys] = useState<string[]>([]);

  // User & Credits state
  const [credits, setCredits] = useState(2);
  const [libraryReels, setLibraryReels] = useState<ClonedReel[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  // Reel Creation form states
  const [reelUrl, setReelUrl] = useState('https://www.instagram.com/reel/C8xYz1_sample_reel');
  const [subjectName, setSubjectName] = useState('My Product');
  
  // Multiple Photos state (Only photos, no video)
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [photoNames, setPhotoNames] = useState<string[]>([]);
  
  const [audioOption, setAudioOption] = useState<'original' | 'custom'>('original');
  const [isDragging, setIsDragging] = useState(false);

  // Generation execution state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(20);
  const [progressText, setProgressText] = useState('Initializing spatial tracking...');
  const [clonedResult, setClonedResult] = useState<ClonedReel | null>(null);

  // Hidden File input reference (multiple photos)
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check localStorage for existing user session on mount
  useEffect(() => {
    try {
      const storedEmail = localStorage.getItem('fnm_user_email');
      if (storedEmail) {
        setUserEmail(storedEmail);
        fetchLibrary(storedEmail);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsAuthChecking(false);
    }
  }, []);

  // Fetch user details & library
  const fetchLibrary = async (email: string) => {
    try {
      setLoadingLibrary(true);
      const res = await fetch(`/api/reels/library?email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (data.success) {
        setCredits(data.credits);
        setLibraryReels(data.reels || []);
      }
    } catch (err) {
      console.error('Failed to load library:', err);
    } finally {
      setLoadingLibrary(false);
    }
  };

  // Handle User Login
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    const email = emailInput.trim().toLowerCase();
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('fnm_user_email', email);
        setUserEmail(email);
        setCredits(data.user.credits);
        fetchLibrary(email);
      }
    } catch (err) {
      console.error(err);
      // Fallback local save
      localStorage.setItem('fnm_user_email', email);
      setUserEmail(email);
    }
  };

  // Handle Logout / Switch Account
  const handleLogout = () => {
    localStorage.removeItem('fnm_user_email');
    setUserEmail(null);
    setEmailInput('');
    setLibraryReels([]);
    setClonedResult(null);
  };

  // Handle Multiple Photos Selection
  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processPhotoFiles(Array.from(e.target.files));
    }
  };

  const processPhotoFiles = (files: File[]) => {
    const validImageFiles = files.filter(f => f.type.startsWith('image/'));
    if (validImageFiles.length === 0) {
      alert('Please select photo images (JPG, PNG, WEBP). Video files are not supported for product reference.');
      return;
    }

    const names = validImageFiles.map(f => f.name);
    setPhotoNames(names);

    if (subjectName === 'My Product' && validImageFiles[0]) {
      const cleanName = validImageFiles[0].name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setSubjectName(cleanName);
    }

    const readers = validImageFiles.map(file => {
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readers).then(dataUrls => {
      setUploadedPhotos(dataUrls);
    });
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processPhotoFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Handle Plan Purchase
  const handleBuyCredits = async (packId: string) => {
    if (!userEmail) return;
    try {
      const res = await fetch('/api/credits/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, packId }),
      });
      const data = await res.json();
      if (data.success) {
        setCredits(data.currentCredits);
        setShowPricingModal(false);
        alert(data.message + `\nCurrent balance: ${data.currentCredits} Credits`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger Generation
  const handleStartGeneration = async (forceDemoMode: boolean = false) => {
    if (!userEmail) return;
    if (credits <= 0) {
      setShowPricingModal(true);
      return;
    }

    setIsProcessing(true);
    setProgressPct(20);
    setProgressText('Extracting original reel & tracking product contours with SAM 2...');

    const interval = setInterval(() => {
      setProgressPct((prev) => {
        if (prev === 20) {
          setProgressText('Isolating original vehicle/product from background...');
          return 45;
        } else if (prev === 45) {
          setProgressText('Inpainting your product photos into original 3D camera angles...');
          return 75;
        } else if (prev === 75) {
          setProgressText('Matching scene lighting, shadows & syncing original beat drops...');
          return 90;
        }
        return prev;
      });
    }, 700);

    try {
      const primaryPhoto = uploadedPhotos.length > 0 ? uploadedPhotos[0] : null;

      const res = await fetch('/api/reels/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          reelUrl,
          subjectName,
          audioOption,
          customSubjectImage: primaryPhoto,
          subjectImages: uploadedPhotos,
          forceDemo: forceDemoMode,
        }),
      });

      const data = await res.json();
      clearInterval(interval);

      if (res.status === 402) {
        setIsProcessing(false);
        setShowPricingModal(true);
        return;
      }

      if (data.configRequired) {
        setIsProcessing(false);
        setMissingKeys(data.missingKeys || ['FAL_KEY', 'REPLICATE_API_TOKEN']);
        setShowConfigModal(true);
        return;
      }

      if (data.pending && data.jobId) {
        setProgressText('AI GPU rendering in progress (LTX Video / Wan)...');
        pollJobStatus(data.jobId, data.provider, data.endpoint);
        return;
      }

      if (!data.success && data.allowFallback) {
        handleStartGeneration(true);
        return;
      }

      if (data.success && data.reel) {
        setProgressPct(100);
        setProgressText('Complete!');
        setTimeout(() => {
          setIsProcessing(false);
          setClonedResult(data.reel);
          setCredits(data.remainingCredits);
          fetchLibrary(userEmail);
        }, 500);
      } else {
        setIsProcessing(false);
        alert(data.error || 'Failed to generate reel');
      }
    } catch (err) {
      clearInterval(interval);
      setIsProcessing(false);
      alert('Error during generation. Please check your network connection.');
    }
  };

  // Poll status for real AI video jobs
  const pollJobStatus = async (jobId: string, provider: 'fal' | 'replicate', endpoint?: string) => {
    if (!userEmail) return;
    let attempts = 0;
    const pollInterval = setInterval(async () => {
      attempts += 1;
      try {
        const epParam = endpoint ? `&endpoint=${encodeURIComponent(endpoint)}` : '';
        const res = await fetch(`/api/reels/status?jobId=${jobId}&provider=${provider}${epParam}&email=${encodeURIComponent(userEmail)}&subjectTitle=${encodeURIComponent(subjectName)}`);
        const data = await res.json();

        if (data.status === 'COMPLETED' && data.reel) {
          clearInterval(pollInterval);
          setProgressPct(100);
          setProgressText('AI Video Generation Completed!');
          setIsProcessing(false);
          setClonedResult(data.reel);
          fetchLibrary(userEmail);
        } else if (data.status === 'FAILED') {
          clearInterval(pollInterval);
          setIsProcessing(false);
          alert(`AI video generation failed: ${data.error}`);
        } else if (attempts > 60) {
          clearInterval(pollInterval);
          setIsProcessing(false);
          alert('Generation timed out. Please check your AI provider dashboard.');
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 3000);
  };

  // If initial auth check is running
  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
      </div>
    );
  }

  // 1. NEW USER LOGIN / WELCOME SCREEN (Shown first before accessing creator interface)
  if (!userEmail) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#ededed] p-4 flex flex-col justify-center items-center font-mono selection:bg-white selection:text-black">
        <div className="max-w-md w-full space-y-8 text-center">
          
          {/* 3D Rotating FNM Cube */}
          <div className="cube-scene mx-auto">
            <div className="cube">
              <div className="cube-face cube-front">FNM</div>
              <div className="cube-face cube-back">AI</div>
              <div className="cube-face cube-right">3D</div>
              <div className="cube-face cube-left">⚡</div>
              <div className="cube-face cube-top">9:16</div>
              <div className="cube-face cube-bottom">REEL</div>
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-widest text-white uppercase">F N M</h1>
            <p className="text-xs text-neutral-400 font-sans tracking-wide">
              REEL PRODUCT CLONER & SPATIAL INPAINTING
            </p>
          </div>

          <div className="bg-[#0d0d0d] border border-neutral-800 p-6 md:p-8 rounded-3xl mono-glow space-y-5 text-left font-sans">
            <div className="space-y-1">
              <h2 className="text-base font-black text-white uppercase tracking-wider">Client Login</h2>
              <p className="text-xs text-neutral-400">
                Enter your email to access the studio and your saved reels.
              </p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="yourname@gmail.com"
                  required
                  className="w-full bg-[#121212] border border-neutral-800 focus:border-white px-4 py-3 rounded-2xl text-xs text-white placeholder-neutral-500 focus:outline-none transition-all font-mono"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-white hover:bg-neutral-200 text-black font-black text-xs tracking-widest uppercase rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2"
              >
                <span>ENTER STUDIO</span>
                <span>→</span>
              </button>
            </form>

            <div className="border-t border-neutral-900 pt-3 space-y-1 text-center font-mono text-[10px] text-neutral-500">
              <div>✓ 2 Free Starter Credits on Signup</div>
              <div>✓ Replace products in any Instagram Reel</div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  // 2. MAIN CREATOR INTERFACE (Shown for logged-in users)
  return (
    <div className="min-h-screen bg-[#050505] text-[#ededed] p-4 md:p-6 font-mono flex flex-col justify-between selection:bg-white selection:text-black">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        
        {/* Top Navbar */}
        <header className="flex flex-col sm:flex-row items-center justify-between border-b border-neutral-800 pb-4 gap-4">
          
          {/* Logo & 3D Mini Cube */}
          <div className="flex items-center gap-3">
            <div className="cube-scene">
              <div className="cube">
                <div className="cube-face cube-front">FNM</div>
                <div className="cube-face cube-back">AI</div>
                <div className="cube-face cube-right">3D</div>
                <div className="cube-face cube-left">⚡</div>
                <div className="cube-face cube-top">9:16</div>
                <div className="cube-face cube-bottom">REEL</div>
              </div>
            </div>
            <div>
              <span className="text-xl font-black tracking-widest text-white uppercase">F N M</span>
              <span className="text-[9px] block text-neutral-400 font-sans tracking-wider">REEL PRODUCT CLONER</span>
            </div>
          </div>

          {/* Nav Tabs */}
          <div className="flex items-center bg-[#0d0d0d] border border-neutral-800 p-1 rounded-xl text-xs font-sans">
            <button
              onClick={() => {
                setActiveTab('create');
                setClonedResult(null);
              }}
              className={`px-4 py-1.5 rounded-lg transition-all ${
                activeTab === 'create'
                  ? 'bg-white text-black font-bold'
                  : 'text-neutral-400 hover:text-white font-medium'
              }`}
            >
              ⚡ Create Reel
            </button>
            <button
              onClick={() => setActiveTab('library')}
              className={`px-4 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                activeTab === 'library'
                  ? 'bg-white text-black font-bold'
                  : 'text-neutral-400 hover:text-white font-medium'
              }`}
            >
              <span>📁 My Cloned Reels</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${activeTab === 'library' ? 'bg-black text-white' : 'bg-neutral-800 text-white'}`}>
                {libraryReels.length}
              </span>
            </button>
          </div>

          {/* Account & Credits */}
          <div className="flex items-center gap-3 font-sans">
            <div className="bg-[#0f0f0f] border border-neutral-800 px-3 py-1.5 rounded-xl flex items-center gap-2.5 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                <span className="text-neutral-400 text-[11px]">Credits:</span>
                <span className="font-bold text-white font-mono">{credits} left</span>
              </div>
              <button
                onClick={() => setShowPricingModal(true)}
                className="bg-white hover:bg-neutral-200 text-black text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider transition-all"
              >
                + Buy Credits
              </button>
            </div>

            {/* User Pill & Logout */}
            <div className="flex items-center gap-2">
              <div className="border border-neutral-800 bg-[#0f0f0f] px-3 py-1.5 rounded-xl flex items-center gap-2 text-xs">
                <div className="w-5 h-5 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                  {userEmail.charAt(0)}
                </div>
                <span className="text-neutral-300 text-[11px] font-mono truncate max-w-[120px]">
                  {userEmail}
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="Log Out / Switch Account"
                className="border border-neutral-800 hover:border-neutral-600 bg-[#0f0f0f] text-neutral-400 hover:text-white px-2 py-1.5 rounded-xl text-[10px] font-mono transition-colors"
              >
                Exit
              </button>
            </div>
          </div>

        </header>

        {/* TAB 1: CREATE REEL */}
        {activeTab === 'create' && (
          <main className="max-w-2xl mx-auto w-full space-y-6">
            {!isProcessing && !clonedResult && (
              <div className="bg-[#0d0d0d] border border-neutral-800 p-6 md:p-8 rounded-3xl mono-glow space-y-5 relative overflow-hidden">
                <div className="absolute inset-0 wireframe-grid pointer-events-none opacity-40"></div>

                <div className="relative z-10 space-y-5 font-sans">
                  
                  <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3">
                    <div>
                      <h2 className="text-sm font-black text-white uppercase tracking-wider">Product Reel Cloning</h2>
                      <p className="text-[11px] text-neutral-400">Replaces only the product inside the reel with your photos</p>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded">
                      SAM 2 + 3D
                    </span>
                  </div>

                  {/* Input 1: Original Reel Link */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-300 tracking-wider flex items-center justify-between uppercase">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-white rounded-full"></span>
                        <span>1. Original Instagram Reel Link</span>
                      </span>
                    </label>
                    <input
                      type="text"
                      value={reelUrl}
                      onChange={(e) => setReelUrl(e.target.value)}
                      placeholder="https://www.instagram.com/reel/..."
                      className="w-full bg-[#121212] border border-neutral-800 focus:border-white px-4 py-3 rounded-2xl text-xs text-white placeholder-neutral-500 focus:outline-none transition-all font-mono"
                    />
                    <p className="text-[10px] text-neutral-500">
                      AI will keep the exact background, camera motion, and audio of this reel.
                    </p>
                  </div>

                  {/* Input 2: Multiple Photos Upload (Photos Only - No Video) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-300 tracking-wider flex items-center justify-between uppercase">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-white rounded-full"></span>
                        <span>2. Upload Your Product Photos (Multiple Angles)</span>
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">PHOTOS ONLY</span>
                    </label>

                    {/* Hidden Native File Input with multiple attribute & images only */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFilesChange}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />

                    {/* Interactive Drop Box */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all group relative overflow-hidden ${
                        isDragging ? 'border-white bg-neutral-900' : 'border-neutral-800 hover:border-white bg-[#121212]/70'
                      }`}
                    >
                      {uploadedPhotos.length > 0 ? (
                        <div className="space-y-3">
                          {/* Thumbnail Gallery of Selected Photos */}
                          <div className="flex items-center justify-center gap-2 flex-wrap max-h-36 overflow-y-auto p-1">
                            {uploadedPhotos.map((photoUrl, idx) => (
                              <div key={idx} className="w-16 h-16 rounded-xl overflow-hidden border border-white/40 shadow-lg bg-black relative">
                                <img src={photoUrl} alt={`Angle ${idx + 1}`} className="w-full h-full object-cover" />
                                <span className="absolute bottom-0.5 right-0.5 bg-black/80 px-1 rounded text-[8px] font-mono text-white">
                                  #{idx + 1}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              <span>{uploadedPhotos.length} Product Photos Attached</span>
                            </div>
                            <p className="text-[10px] text-neutral-400 mt-0.5">Click or drop to add more or replace</p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="w-10 h-10 mx-auto rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-lg text-white group-hover:scale-110 transition-transform">
                            📷
                          </div>
                          <p className="mt-2 text-xs font-bold text-white tracking-wide">
                            Click to Select Multiple Product Photos
                          </p>
                          <p className="text-[11px] text-neutral-400 mt-0.5">
                            Upload 1 to 4 clear photos (Front, Side, 45° angle)
                          </p>
                          <span className="mt-3 inline-block bg-neutral-900 border border-neutral-700 text-neutral-300 text-[10px] font-mono px-3 py-1 rounded-full">
                            Select Photos (Multiple)
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-1">
                      <input
                        type="text"
                        value={subjectName}
                        onChange={(e) => setSubjectName(e.target.value)}
                        placeholder="Product Name / Model (e.g. Continental GT 650, Sneaker, Watch)"
                        className="w-full bg-[#121212] border border-neutral-800 focus:border-white px-3 py-2 rounded-xl text-xs text-white placeholder-neutral-500 font-mono focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Input 3: Audio Preference */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-300 tracking-wider flex items-center gap-2 uppercase">
                      <span className="w-2 h-2 bg-white rounded-full"></span>
                      <span>3. Audio Preference</span>
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      <div
                        onClick={() => setAudioOption('original')}
                        className={`border-2 rounded-2xl p-3 cursor-pointer flex flex-col justify-between transition-all ${
                          audioOption === 'original'
                            ? 'border-white bg-white text-black'
                            : 'border-neutral-800 bg-[#121212] text-white'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-xs font-black">KEEP REEL AUDIO</span>
                          <input
                            type="radio"
                            name="audio"
                            checked={audioOption === 'original'}
                            readOnly
                            className="w-3.5 h-3.5 accent-black"
                          />
                        </div>
                        <p className={`text-[10px] mt-1 font-medium ${audioOption === 'original' ? 'text-neutral-700' : 'text-neutral-400'}`}>
                          Retains original music & beat drops
                        </p>
                      </div>

                      <div
                        onClick={() => setAudioOption('custom')}
                        className={`border-2 rounded-2xl p-3 cursor-pointer flex flex-col justify-between transition-all ${
                          audioOption === 'custom'
                            ? 'border-white bg-white text-black'
                            : 'border-neutral-800 bg-[#121212] text-white'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-xs font-black">CUSTOM / MUTE</span>
                          <input
                            type="radio"
                            name="audio"
                            checked={audioOption === 'custom'}
                            readOnly
                            className="w-3.5 h-3.5 accent-white"
                          />
                        </div>
                        <p className={`text-[10px] mt-1 ${audioOption === 'custom' ? 'text-neutral-700' : 'text-neutral-400'}`}>
                          Upload MP3 or generate silent
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="pt-2">
                    <button
                      onClick={() => handleStartGeneration(false)}
                      className="w-full py-4 bg-white hover:bg-neutral-200 text-black font-black text-xs tracking-widest uppercase rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2"
                    >
                      <span>REPLACE PRODUCT IN REEL (1 CREDIT)</span>
                      <span>→</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* PROCESSING STATE */}
            {isProcessing && (
              <div className="bg-[#0d0d0d] border border-neutral-800 p-8 rounded-3xl text-center space-y-6 mono-glow font-sans">
                <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                  <div className="text-white font-mono text-xs font-black">FNM</div>
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Swapping Product in Reel</h3>
                  <p className="text-xs text-neutral-400 font-mono">{progressText}</p>
                </div>
                <div className="max-w-md mx-auto space-y-1.5">
                  <div className="w-full bg-neutral-900 h-1.5 rounded-full overflow-hidden border border-neutral-800">
                    <div
                      className="bg-white h-full transition-all duration-300"
                      style={{ width: `${progressPct}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-neutral-400 font-mono">
                    <span>{progressPct}% COMPLETED</span>
                    <span>AUTOSAVING TO ACCOUNT</span>
                  </div>
                </div>
              </div>
            )}

            {/* RESULT STATE */}
            {clonedResult && (
              <div className="bg-[#0d0d0d] border border-neutral-800 p-6 rounded-3xl space-y-5 mono-glow font-sans">
                <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-white"></span>
                      Product Replaced Successfully!
                    </h3>
                    <p className="text-xs text-neutral-400 font-mono">Original camera motion & audio synced with your product</p>
                  </div>
                  <button
                    onClick={() => {
                      setClonedResult(null);
                      setUploadedPhotos([]);
                      setPhotoNames([]);
                    }}
                    className="border border-neutral-800 hover:border-neutral-600 text-xs px-3 py-1.5 rounded-xl text-neutral-400 font-mono"
                  >
                    + New Reel
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 justify-items-center">
                  <div className="space-y-1 text-center w-full">
                    <span className="text-[10px] text-neutral-400 font-mono">ORIGINAL REEL</span>
                    <div className="reel-aspect w-full max-w-[180px] mx-auto bg-black border border-neutral-800 rounded-xl overflow-hidden relative">
                      <img
                        src={clonedResult.originalPreviewUrl}
                        alt="Original"
                        className="w-full h-full object-cover grayscale"
                      />
                    </div>
                  </div>
                  <div className="space-y-1 text-center w-full">
                    <span className="text-[10px] font-bold text-white font-mono">YOUR PRODUCT REEL</span>
                    <div className="reel-aspect w-full max-w-[180px] mx-auto bg-black border-2 border-white rounded-xl overflow-hidden relative shadow-lg">
                      {clonedResult.previewUrl.startsWith('data:video') || clonedResult.previewUrl.endsWith('.mp4') ? (
                        <video src={clonedResult.previewUrl} className="w-full h-full object-cover" autoPlay muted loop controls />
                      ) : (
                        <img
                          src={clonedResult.previewUrl}
                          alt="Cloned"
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = clonedResult.previewUrl;
                    a.download = `FNM_${clonedResult.subjectTitle.replace(/\s+/g, '_')}.mp4`;
                    a.click();
                  }}
                  className="w-full py-3.5 bg-white hover:bg-neutral-200 text-black font-black text-xs uppercase tracking-widest rounded-xl flex items-center justify-center gap-2"
                >
                  <span>DOWNLOAD 1080P HD (MP4)</span>
                  <span>↓</span>
                </button>
              </div>
            )}
          </main>
        )}

        {/* TAB 2: CLIENT REEL LIBRARY */}
        {activeTab === 'library' && (
          <main className="w-full space-y-5 font-sans">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <div>
                <h2 className="text-base font-black text-white uppercase tracking-wider">
                  Account Library: Cloned Reels
                </h2>
                <p className="text-xs text-neutral-400">
                  All reels generated under <span className="font-mono text-white">{userEmail}</span>
                </p>
              </div>
              <button
                onClick={() => {
                  setActiveTab('create');
                  setClonedResult(null);
                }}
                className="bg-white text-black font-bold text-xs px-3.5 py-2 rounded-xl"
              >
                + Create New Reel
              </button>
            </div>

            {loadingLibrary ? (
              <div className="text-center py-12 text-xs text-neutral-500 font-mono">
                Loading client reels...
              </div>
            ) : libraryReels.length === 0 ? (
              <div className="text-center py-12 text-xs text-neutral-500 font-mono border border-dashed border-neutral-800 rounded-2xl">
                No reels created yet for this account. Create your first reel!
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {libraryReels.map((reel) => (
                  <div
                    key={reel.id}
                    className="bg-[#0d0d0d] border border-neutral-800 rounded-2xl p-4 space-y-3 hover:border-neutral-600 transition-all"
                  >
                    <div className="reel-aspect w-full rounded-xl overflow-hidden bg-black relative border border-neutral-800">
                      <img
                        src={reel.previewUrl}
                        alt={reel.subjectTitle}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-2 right-2 bg-black/80 px-2 py-0.5 rounded text-[10px] text-white font-mono">
                        {reel.resolution}
                      </div>
                      <div className="absolute bottom-2 left-2 bg-white text-black px-2 py-0.5 rounded text-[9px] font-bold font-mono">
                        {reel.audioOption === 'original' ? 'ORIGINAL AUDIO' : 'CUSTOM AUDIO'}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs font-bold text-white truncate">{reel.subjectTitle}</div>
                      <div className="text-[10px] text-neutral-400 font-mono">{reel.createdAt}</div>
                    </div>
                    <div className="flex gap-2 pt-1 font-mono text-xs font-bold">
                      <button
                        onClick={() => alert(`Previewing ${reel.subjectTitle}...`)}
                        className="flex-1 py-2 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white rounded-lg"
                      >
                        Preview
                      </button>
                      <button
                        onClick={() => alert(`Downloading ${reel.subjectTitle} (MP4)...`)}
                        className="flex-1 py-2 bg-white hover:bg-neutral-200 text-black rounded-lg"
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        )}

        {/* Footer */}
        <footer className="text-center text-[10px] text-neutral-600 font-mono border-t border-neutral-900 pt-4">
          FNM AI • CLONE ANY REEL • HIGH-DEFINITION SPATIAL INPAINTING
        </footer>
      </div>

      {/* MODAL: AI API KEY CONFIGURATION GUIDE */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d0d0d] border border-neutral-700 max-w-lg w-full p-6 md:p-8 rounded-3xl mono-glow space-y-5 relative font-sans">
            <button
              onClick={() => setShowConfigModal(false)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-white text-lg"
            >
              ✕
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2.5 py-0.5 rounded-full">
                AI ENGINE SETUP
              </span>
              <h3 className="text-xl font-black text-white uppercase tracking-wider pt-2">
                Connect AI Video GPU
              </h3>
              <p className="text-xs text-neutral-400">
                To perform real video-to-video inpainting, connect a serverless AI provider.
              </p>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Fal.ai Connected</span>
                  <span className="text-[10px] font-mono text-emerald-400">Active</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Using <b>fal-ai/ltx-video/image-to-video</b> and <b>SAM 2</b> to swap your product photos into the reel.
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  setShowConfigModal(false);
                  handleStartGeneration(true);
                }}
                className="w-full py-3 bg-white hover:bg-neutral-200 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all"
              >
                Test With Uploaded Photos (Instant Render)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: BUY CREDITS (FIRST PLAN ₹119) */}
      {showPricingModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d0d0d] border border-neutral-800 max-w-md w-full p-6 md:p-8 rounded-3xl mono-glow space-y-6 relative font-sans">
            <button
              onClick={() => setShowPricingModal(false)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-white text-lg"
            >
              ✕
            </button>

            <div className="text-center space-y-1">
              <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-400 bg-neutral-900 border border-neutral-800 px-3 py-1 rounded-full">
                CREDIT RECHARGE
              </span>
              <h3 className="text-2xl font-black text-white uppercase tracking-wider pt-2">
                Choose Your Pack
              </h3>
              <p className="text-xs text-neutral-400">Unlock reel generations with no watermarks.</p>
            </div>

            {/* Plans Cards */}
            <div className="space-y-3">
              {/* FIRST PLAN: STARTER PACK ₹119 */}
              <div className="border-2 border-white bg-white text-black p-4 rounded-2xl relative shadow-xl">
                <span className="absolute top-3 right-3 bg-black text-white text-[9px] font-mono px-2 py-0.5 rounded-full uppercase font-bold">
                  BEST VALUE
                </span>
                <div className="space-y-1">
                  <div className="text-xs font-bold uppercase tracking-wider text-neutral-700">
                    Starter Pack
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black tracking-tight">₹119</span>
                    <span className="text-xs font-medium text-neutral-600">/ one-time</span>
                  </div>
                  <div className="text-xs font-black pt-1">⚡ 10 Cloned Reels (10 Credits)</div>
                  <p className="text-[11px] text-neutral-700">
                    Just ~₹11.9 per reel • 1080p HD • Audio Sync • Instant Delivery
                  </p>
                </div>
                <button
                  onClick={() => handleBuyCredits('starter-10')}
                  className="w-full mt-3 py-2.5 bg-black hover:bg-neutral-800 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all"
                >
                  Buy Starter Pack (₹119)
                </button>
              </div>

              {/* PLAN 2: CREATOR PACK */}
              <div className="border border-neutral-800 bg-[#121212] hover:border-neutral-600 p-4 rounded-2xl transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-neutral-300 uppercase">Creator Pro Pack</div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-white">₹299</span>
                      <span className="text-[10px] text-neutral-500">/ 30 Credits</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleBuyCredits('pro-30')}
                    className="border border-neutral-700 hover:border-white text-white text-xs font-bold px-3 py-2 rounded-xl"
                  >
                    Select
                  </button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 text-[10px] text-neutral-500 font-mono">
              <span>✓ UPI / GPAY / PHONEPE</span>
              <span>•</span>
              <span>✓ ALL CARDS & NETBANKING</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
