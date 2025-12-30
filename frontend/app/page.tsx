"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type Tab = "encode" | "decode";
type Status = "idle" | "loading" | "success" | "error";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("encode");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const MAX_FILE_SIZE = 5*1024*1024; // 5 MB

  const resetState = useCallback(() => {
    setStatus("idle");
    setDownloadUrl(null);
    setError(null);
  }, []);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setFile(null);
    resetState();
  };

  const handleFile = (selectedFile: File | null) => {
    if (selectedFile) {
      setFile(selectedFile);
      resetState();
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    handleFile(droppedFile);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleUpload = async () => {
    if (!file) return;
    if (activeTab === "encode" && file.size > MAX_FILE_SIZE) {
      setFile(null);
      setStatus("error");
      setError("File size must be 5MB or less");
      return;
    }

    setStatus("loading");
    setError(null);
    setDownloadUrl(null);

    const formData = new FormData();
    formData.append("file", file);

    const endpoint = activeTab === "encode" ? "/encode" : "/decode";
    const url = `${process.env.NEXT_PUBLIC_BACKEND_URL}${endpoint}`;

    try {
      const response = await fetch(url, {method: "POST",body: formData});

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Upload failed: ${errorData.detail || response.statusText}`);
      }
      const data = await response.json();
      setDownloadUrl(data.download_url);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  };

  const isLoading = status === "loading";

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 via-gray-100 to-gray-200 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 flex items-center justify-center p-6 transition-colors duration-500">
      <div className="w-full max-w-md">
        <div className="bg-white/80 dark:bg-white/5 backdrop-blur-xl rounded-3xl shadow-2xl shadow-gray-300/50 dark:shadow-black/50 border border-gray-200/50 dark:border-white/10 overflow-hidden transition-all duration-500">
          <div className="px-6 pt-6 pb-2">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white text-center tracking-tight">
              Youtube Drive
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
              Unlimited storage :)
            </p>
          </div>

          <div className="px-6 pt-4">
            <div className="flex bg-gray-100 dark:bg-white/5 rounded-2xl p-1.5">
              {(["encode", "decode"] as Tab[]).map((tab) => (
                <button key={tab} onClick={() => handleTabChange(tab)} disabled={isLoading} className={`flex-1 py-3 text-sm font-medium rounded-xl transition-all duration-300 relative ${activeTab === tab ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"} ${isLoading ? "cursor-not-allowed opacity-50" : ""} `}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div onClick={() => !isLoading && inputRef.current?.click()} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onKeyDown={(e) => e.key === "Enter" && !isLoading && inputRef.current?.click()} tabIndex={isLoading ? -1 : 0} role="button" aria-label="Upload file" className={`relative border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-300 ${isDragging ? " bg-violet-50 dark:bg-violet-500/10 scale-[1.02]" : "border-gray-200 dark:border-white/10 hover:border-gray-300 dark:hover:border-white/20 hover:bg-gray-50 dark:hover:bg-white/5"} ${isLoading ? "cursor-not-allowed opacity-50" : "cursor-pointer"} focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900`}>
              <input ref={inputRef} type="file" onChange={(e) => handleFile(e.target.files?.[0] || null)} disabled={isLoading} className="hidden" aria-hidden="true" />
              <div className="space-y-3">
                <div className={`w-14 h-14 mx-auto rounded-2xl flex items-center justify-center transition-all duration-300 ${file ? "bg-violet-100 dark:bg-violet-500/20" : "bg-gray-100 dark:bg-white/5"}`}>
                  {file ? (
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  ) : (
                    <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {file ? file.name : "Drop a file or click to browse"}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : "Supports any file type. Upto 5MB"}
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={handleUpload}
              disabled={!file || isLoading}
              className={`w-full py-4 px-4 rounded-2xl text-sm font-semibold transition-all duration-300 ${!file || isLoading ? "bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-gray-600 cursor-not-allowed" : "bg-black hover:to-indigo-700 text-white shadow-lg hover:scale-[1.02] active:scale-[0.98]"} focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900`}>
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                `${activeTab === "encode" ? "Encode" : "Decode"} File`
              )}
            </button>

            {status === "success" && downloadUrl && (
              <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">
                    {activeTab === "encode" ? "Encoded" : "Decoded"} successfully!
                  </p>
                </div>
                <a
                  href={process.env.NEXT_PUBLIC_BACKEND_URL + downloadUrl}
                  download
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download File
                </a>
              </div>
            )}

            {status === "error" && error && (
              <div className="p-5 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-500/20 flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-300 font-medium">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="text-center font-bold text-xs text-gray-400 dark:text-gray-600 py-4">
              Note: This is a demo application. Files are stored temporarily and deleted after 5 minutes of processing.
        </div>
      </div>
    </div>
  );
}
