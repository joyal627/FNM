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
  // Navigation & Modal states
  const [activeTab, setActiveTab] = useState<'create' | 'library'>('create');
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [missingKeys, setMissingKeys] = useState<string[]>([]);

  // User & Credits state
  const [userEmail, setUserEmail] = useState('client@brand.com');
  const [emailInput, setEmailInput] = useState('client@brand.com');
  const [credits, setCredits] = useState(2);
  const [libraryReels, setLibraryReels] = useState<ClonedReel[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  // Reel Creation form states
  const [reelUrl, setReelUrl] = useState('https://www.instagram.com/reel/C8xYz1_sample_reel');
  const [subjectName, setSubjectName] = useState('My Custom Subject');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [subjectDataUrl, setSubjectDataUrl] = useState<string | null>(null);
  const [audioOption, setAudioOption] = useState<'original' | 'custom'>('original');
  const [isDragging, setIsDragging] = useState(false);

  // Generation execution state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPct, setProgressPct] = useState(20);
  const [progressText, setProgressText] = useState('Initializing spatial tracking...');
  const [clonedResult, setClonedResult] = useState<ClonedReel | null>(null);

  // Hidden File input reference
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    fetchLibrary(userEmail);
  }, [userEmail]);

  // Handle Real File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file: File) => {
    setSelectedFileName(file.name);
    // Auto populate subject title if default
    if (subjectName === 'My Custom Subject') {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      setSubjectName(cleanName);
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSubjectDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  // Handle Login / Switch Account
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput) return;
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput }),
      });
      const data = await res.json();
      if (data.success) {
        setUserEmail(emailInput);
        setCredits(data.user.credits);
        setShowAuthModal(false);
        fetchLibrary(emailInput);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle Plan Purchase (First Plan ₹119)
  const handleBuyCredits = async (packId: string) => {
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
    if (credits <= 0) {
      setShowPricingModal(true);
      return;
    }

    setIsProcessing(true);
    setProgressPct(20);
    setProgressText('Downloading Instagram Reel & extracting spatial motion vectors...');

    // Progress simulation while API works
    const interval = setInterval(() => {
      setProgressPct((prev) => {
        if (prev === 20) {
          setProgressText('Meta SAM 2: Isolating original subject contours...');
          return 45;
        } else if (prev === 45) {
          setProgressText('Diffusion Inpainting: Placing replacement subject into 3D perspective...');
          return 75;
        } else if (prev === 75) {
          setProgressText('Matching scene reflections & syncing original audio beats...');
          return 90;
        }
        return prev;
      });
    }, 700);

    try {
      const res = await fetch('/api/reels/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          reelUrl,
          subjectName,
          audioOption,
          customSubjectImage: subjectDataUrl,
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

      // If missing API keys on server
      if (data.configRequired) {
        setIsProcessing(false);
        setMissingKeys(data.missingKeys || ['FAL_KEY', 'REPLICATE_API_TOKEN']);
        setShowConfigModal(true);
        return;
      }

      // If asynchronous job dispatched to Fal / Replicate
      if (data.pending && data.jobId) {
        setProgressText('AI GPU rendering in progress (Wan 2.1 / Kling)...');
        pollJobStatus(data.jobId, data.provider);
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
  const pollJobStatus = async (jobId: string, provider: 'fal' | 'replicate') => {
    let attempts = 0;
    const pollInterval = setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/reels/status?jobId=${jobId}&provider=${provider}&email=${encodeURIComponent(userEmail)}&subjectTitle=${encodeURIComponent(subjectName)}`);
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
              <span className="text-[9px] block text-neutral-400 font-sans tracking-wider">AI REEL CLONE ENGINE</span>
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

            <div
              onClick={() => setShowAuthModal(true)}
              className="border border-neutral-800 bg-[#0f0f0f] hover:border-neutral-600 px-3 py-1.5 rounded-xl cursor-pointer flex items-center gap-2 text-xs transition-colors"
            >
              <div className="w-5 h-5 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-[10px] font-bold text-white uppercase">
                {userEmail.charAt(0)}
              </div>
              <span className="text-neutral-300 text-[11px] font-mono truncate max-w-[130px]">
                {userEmail}
              </span>
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
                      <h2 className="text-sm font-black text-white uppercase tracking-wider">New Reel Clone Job</h2>
                      <p className="text-[11px] text-neutral-400">1 generation = 1 credit</p>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded">
                      SPATIAL 3D
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
                      placeholder="Paste Instagram Reel link here..."
                      className="w-full bg-[#121212] border border-neutral-800 focus:border-white px-4 py-3 rounded-2xl text-xs text-white placeholder-neutral-500 focus:outline-none transition-all font-mono"
                    />
                  </div>

                  {/* Input 2: Real File Upload for Subject */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-neutral-300 tracking-wider flex items-center justify-between uppercase">
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-white rounded-full"></span>
                        <span>2. Upload Your Subject (Photos or Video)</span>
                      </span>
                      <span className="text-[10px] text-neutral-400 font-mono">ANY FORMAT</span>
                    </label>

                    {/* Hidden Native File Input */}
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*,video/*"
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
                      {subjectDataUrl ? (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-24 h-24 rounded-xl overflow-hidden border border-white/40 shadow-xl bg-black">
                            {subjectDataUrl.startsWith('data:video') ? (
                              <video src={subjectDataUrl} className="w-full h-full object-cover" autoPlay muted loop />
                            ) : (
                              <img src={subjectDataUrl} alt="Preview" className="w-full h-full object-cover" />
                            )}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white flex items-center justify-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                              <span>{selectedFileName || 'Subject File Attached'}</span>
                            </div>
                            <p className="text-[10px] text-neutral-400 mt-0.5">Click or drop to replace file</p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="w-10 h-10 mx-auto rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-lg text-white group-hover:scale-110 transition-transform">
                            📁
                          </div>
                          <p className="mt-2 text-xs font-bold text-white tracking-wide">
                            Click or Drop Your Photos or Video Here
                          </p>
                          <p className="text-[11px] text-neutral-400 mt-0.5">
                            Vehicle, person, fashion, watch, or any product
                          </p>
                          <span className="mt-3 inline-block bg-neutral-900 border border-neutral-700 text-neutral-300 text-[10px] font-mono px-3 py-1 rounded-full">
                            Browse Files
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="pt-1">
                      <input
                        type="text"
                        value={subjectName}
                        onChange={(e) => setSubjectName(e.target.value)}
                        placeholder="Subject name (e.g. Matte Black Yamaha R15)"
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
                          <span className="text-xs font-black">USE REEL AUDIO</span>
                          <input
                            type="radio"
                            name="audio"
                            checked={audioOption === 'original'}
                            readOnly
                            className="w-3.5 h-3.5 accent-black"
                          />
                        </div>
                        <p className={`text-[10px] mt-1 font-medium ${audioOption === 'original' ? 'text-neutral-700' : 'text-neutral-400'}`}>
                          Retains beat drops & sound
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
                          Upload MP3 or silent
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
                      <span>CLONE REEL (CONSUMES 1 CREDIT)</span>
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
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">AI Cloning in Progress</h3>
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
                      Job Completed & Saved to Account
                    </h3>
                    <p className="text-xs text-neutral-400 font-mono">Added to your client library</p>
                  </div>
                  <button
                    onClick={() => {
                      setClonedResult(null);
                      setSubjectDataUrl(null);
                      setSelectedFileName(null);
                    }}
                    className="border border-neutral-800 hover:border-neutral-600 text-xs px-3 py-1.5 rounded-xl text-neutral-400 font-mono"
                  >
                    + New Reel
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 justify-items-center">
                  <div className="space-y-1 text-center w-full">
                    <span className="text-[10px] text-neutral-400 font-mono">ORIGINAL</span>
                    <div className="reel-aspect w-full max-w-[180px] mx-auto bg-black border border-neutral-800 rounded-xl overflow-hidden relative">
                      <img
                        src={clonedResult.originalPreviewUrl}
                        alt="Original"
                        className="w-full h-full object-cover grayscale"
                      />
                    </div>
                  </div>
                  <div className="space-y-1 text-center w-full">
                    <span className="text-[10px] font-bold text-white font-mono">CLONED OUTPUT</span>
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
                  <span className="font-bold text-white">Recommended: Fal.ai (Free Trial Available)</span>
                  <span className="text-[10px] font-mono text-emerald-400">Fastest</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Offers free trial credits upon signup. Supports <b>Wan 2.1 Video-to-Video</b> and <b>SAM 2</b>.
                </p>
                <div className="text-[11px] font-mono text-neutral-300 bg-black/60 p-2 rounded-lg border border-neutral-800">
                  Environment Variable: <span className="text-white font-bold">FAL_KEY</span>
                </div>
              </div>

              <div className="p-3.5 bg-neutral-900/90 border border-neutral-800 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Alternative: Replicate</span>
                  <span className="text-[10px] font-mono text-neutral-400">Pay-as-you-go</span>
                </div>
                <p className="text-[11px] text-neutral-400">
                  Supports <b>Lightricks LTX Video</b>, <b>Kling</b>, and <b>Hunyuan Video</b>.
                </p>
                <div className="text-[11px] font-mono text-neutral-300 bg-black/60 p-2 rounded-lg border border-neutral-800">
                  Environment Variable: <span className="text-white font-bold">REPLICATE_API_TOKEN</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <button
                onClick={() => {
                  setShowConfigModal(false);
                  handleStartGeneration(true); // Run with user's uploaded asset in instant render mode
                }}
                className="w-full py-3 bg-white hover:bg-neutral-200 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all"
              >
                Test Now With My Uploaded Subject (Local Render)
              </button>
              <p className="text-[10px] text-neutral-500 text-center font-mono">
                Add keys in Vercel: Project Settings → Environment Variables
              </p>
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

      {/* MODAL 2: EMAIL LOGIN / SIGNUP */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0d0d0d] border border-neutral-800 max-w-sm w-full p-6 md:p-8 rounded-3xl mono-glow space-y-5 relative font-sans">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-white text-lg"
            >
              ✕
            </button>

            <div className="text-center space-y-1">
              <div className="w-10 h-10 mx-auto rounded-xl bg-white text-black flex items-center justify-center font-black text-sm">
                FNM
              </div>
              <h3 className="text-lg font-black text-white uppercase tracking-wider pt-1">
                Client Login
              </h3>
              <p className="text-xs text-neutral-400">Access your created reels and credits</p>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-neutral-300">Your Email Address</label>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full bg-[#141414] border border-neutral-800 px-3 py-2.5 rounded-xl text-xs text-white focus:outline-none focus:border-white font-mono"
                  placeholder="name@company.com"
                  required
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-white hover:bg-neutral-200 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all"
              >
                Continue with Email
              </button>
            </form>

            <p className="text-[10px] text-neutral-500 text-center font-mono">
              Instant access • No password needed
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
