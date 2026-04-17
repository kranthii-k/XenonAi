"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  UploadCloud, FileText, CheckCircle2, AlertTriangle,
  Loader2, XCircle, Wifi, WifiOff, ChevronDown, ChevronUp
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface IngestResponse {
  job_id?: string;
  batch_id?: string;
  total_received?: number;
  queued_for_analysis?: number;
  flagged?: {
    total: number;
    breakdown: {
      bot_pattern: number;
      exact_duplicate: number;
      near_duplicate: number;
    };
  };
  message?: string;
  error?: string;
  hint?: string;
  found_columns?: string;
  details?: unknown;
}

interface JobStatus {
  status: 'queued' | 'processing' | 'done' | 'error';
  progress_pct: number;
  total_received: number;
  queued_for_analysis: number;
  total_flagged: number;
  total_processed: number;
  error?: string | null;
}

type InputMode = 'file' | 'paste';

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const [inputMode, setInputMode] = useState<InputMode>('file');
  const [productId, setProductId] = useState('');
  const [pasteText, setPasteText] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<IngestResponse | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [liveFeedActive, setLiveFeedActive] = useState(false);
  const [liveFeedItems, setLiveFeedItems] = useState<string[]>([]);
  const [showFlagDetails, setShowFlagDetails] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // ── Polling job status ──────────────────────────────────────────────────

  const startPolling = useCallback((jobId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/ingest/status?job_id=${jobId}`);
        const data: JobStatus = await res.json();
        setJobStatus(data);
        if (data.status === 'done' || data.status === 'error') {
          clearInterval(pollRef.current!);
        }
      } catch {
        clearInterval(pollRef.current!);
      }
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (eventSourceRef.current) eventSourceRef.current.close();
    };
  }, []);

  // ── File handling ──────────────────────────────────────────────────────────

  const handleFileSelect = (file: File) => {
    if (!file.name.match(/\.(csv|json)$/i)) {
      setResponse({ error: 'Only .csv and .json files are accepted.' });
      return;
    }
    setSelectedFile(file);
    setResponse(null);
    setJobStatus(null);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  // ── Submit to /api/ingest ─────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (inputMode === 'file' && !selectedFile) return;
    if (inputMode === 'paste' && !pasteText.trim()) return;

    setIsSubmitting(true);
    setResponse(null);
    setJobStatus(null);

    try {
      const formData = new FormData();
      if (productId.trim()) formData.append('product_id', productId.trim());

      if (inputMode === 'file' && selectedFile) {
        formData.append('file', selectedFile);
      } else if (inputMode === 'paste') {
        formData.append('text', pasteText);
      }

      const res = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });

      const data: IngestResponse = await res.json();
      setResponse(data);

      if (data.job_id && !data.error) {
        startPolling(data.job_id);
      }
    } catch {
      setResponse({ error: 'Network error. Is the dev server running?' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Live Feed ─────────────────────────────────────────────────────────────

  const toggleLiveFeed = () => {
    if (liveFeedActive) {
      eventSourceRef.current?.close();
      setLiveFeedActive(false);
    } else {
      setLiveFeedItems([]);
      const es = new EventSource('/api/feed');
      eventSourceRef.current = es;
      setLiveFeedActive(true);

      es.onmessage = (e) => {
        try {
          const review = JSON.parse(e.data);
          setLiveFeedItems(prev => [review.text, ...prev].slice(0, 20));
        } catch {/* ignore */}
      };

      es.onerror = () => {
        es.close();
        setLiveFeedActive(false);
      };
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const canSubmit =
    !isSubmitting &&
    (inputMode === 'file' ? !!selectedFile : pasteText.trim().length > 0);

  const isSuccess = !!(response && !response.error && response.job_id);
  const isError = !!(response && response.error);

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-slate-200 p-6 md:p-10">
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <header className="border-b border-white/10 pb-6">
          <h1 className="text-3xl font-bold text-white">Ingestion Pipeline</h1>
          <p className="text-slate-400 mt-1">
            Upload CSV / JSON reviews, or paste text — deduplication, bot detection, and NLP extraction run automatically.
          </p>
        </header>

        {/* Product ID */}
        <div className="space-y-2">
          <label className="text-sm text-slate-400 font-medium" htmlFor="product-id-input">
            Product ID <span className="text-slate-600">(optional — defaults to "default-product")</span>
          </label>
          <input
            id="product-id-input"
            type="text"
            value={productId}
            onChange={e => setProductId(e.target.value)}
            placeholder="e.g. samsung-galaxy-s24"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>

        {/* Mode Toggle */}
        <div className="flex rounded-lg border border-white/10 overflow-hidden">
          <button
            id="mode-file-btn"
            onClick={() => setInputMode('file')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              inputMode === 'file'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            File Upload
          </button>
          <button
            id="mode-paste-btn"
            onClick={() => setInputMode('paste')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
              inputMode === 'paste'
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Paste Text
          </button>
        </div>

        {/* File Upload */}
        {inputMode === 'file' && (
          <Card
            id="file-drop-zone"
            className={`border-2 border-dashed transition-colors cursor-pointer ${
              dragOver
                ? 'border-blue-400 bg-blue-500/10'
                : 'border-white/10 bg-white/5'
            } backdrop-blur-md`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <CardContent className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="bg-blue-500/10 w-16 h-16 rounded-full flex items-center justify-center">
                {selectedFile
                  ? <FileText className="w-8 h-8 text-blue-400" />
                  : <UploadCloud className="w-8 h-8 text-blue-400" />
                }
              </div>
              {selectedFile ? (
                <>
                  <p className="text-white font-semibold">{selectedFile.name}</p>
                  <p className="text-slate-400 text-sm">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                  <button
                    id="remove-file-btn"
                    onClick={e => { e.stopPropagation(); setSelectedFile(null); setResponse(null); }}
                    className="text-xs text-slate-500 hover:text-rose-400"
                  >
                    Remove file
                  </button>
                </>
              ) : (
                <>
                  <p className="text-white font-semibold">Drag & drop or click to browse</p>
                  <p className="text-slate-500 text-sm">Supports .csv and .json — up to 50MB</p>
                </>
              )}
              <input
                ref={fileInputRef}
                id="file-input"
                type="file"
                accept=".csv,.json"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) handleFileSelect(f);
                }}
              />
            </CardContent>
          </Card>
        )}

        {/* Paste Mode */}
        {inputMode === 'paste' && (
          <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Paste Reviews</CardTitle>
              <CardDescription className="text-slate-400">
                One review per line. Minimum 1 line.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                id="paste-textarea"
                value={pasteText}
                onChange={e => setPasteText(e.target.value)}
                placeholder={"Battery died in 2 days. Terrible product.\nLove the camera quality, very sharp!\nAmazing phone, totally worth it."}
                rows={8}
                className="w-full bg-black/30 border border-white/10 rounded-lg p-4 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 resize-none"
              />
              <p className="text-xs text-slate-600 mt-2 text-right">
                {pasteText.split('\n').filter(l => l.trim()).length} review(s) detected
              </p>
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <Button
          id="submit-ingest-btn"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-base font-semibold disabled:opacity-40"
        >
          {isSubmitting ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Uploading & deduplicating...</>
          ) : (
            <><UploadCloud className="w-5 h-5 mr-2" /> Run Ingestion Pipeline</>
          )}
        </Button>

        {/* Response / Error */}
        {isError && (
          <Card className="border-rose-500/30 bg-rose-500/10 backdrop-blur-md">
            <CardContent className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-400">
                <XCircle className="w-5 h-5" />
                <span className="font-semibold">Ingestion Failed</span>
              </div>
              <p className="text-slate-300 text-sm">{response?.error}</p>
              {response?.hint && (
                <p className="text-slate-400 text-xs">💡 {response.hint}</p>
              )}
              {response?.found_columns && (
                <p className="text-slate-500 text-xs">
                  Columns found: <code className="text-slate-300">{response.found_columns}</code>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {isSuccess && (
          <Card className="border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md">
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-semibold">Ingestion Queued</span>
              </div>

              {/* Key stats */}
              <div className="grid grid-cols-3 gap-3">
                <StatBox label="Received" value={response?.total_received ?? 0} color="text-white" />
                <StatBox label="Queued" value={response?.queued_for_analysis ?? 0} color="text-blue-400" />
                <StatBox
                  label="Flagged"
                  value={response?.flagged?.total ?? 0}
                  color={(response?.flagged?.total ?? 0) > 0 ? 'text-amber-400' : 'text-slate-500'}
                />
              </div>

              {/* Flagged breakdown */}
              {(response?.flagged?.total ?? 0) > 0 && (
                <div>
                  <button
                    id="toggle-flag-details-btn"
                    onClick={() => setShowFlagDetails(v => !v)}
                    className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300"
                  >
                    {showFlagDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    Flag breakdown
                  </button>
                  {showFlagDetails && (
                    <div className="mt-2 space-y-1 text-xs text-slate-400">
                      <p>🤖 Bot pattern: <span className="text-white">{response?.flagged?.breakdown.bot_pattern}</span></p>
                      <p>📋 Exact duplicate: <span className="text-white">{response?.flagged?.breakdown.exact_duplicate}</span></p>
                      <p>≈ Near duplicate: <span className="text-white">{response?.flagged?.breakdown.near_duplicate}</span></p>
                      <p className="text-slate-600">All flagged reviews are stored in DB for audit — not deleted.</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Job progress */}
        {jobStatus && (
          <Card className="bg-white/5 border-white/10 backdrop-blur-md">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-400">Analysis Progress</span>
                <Badge
                  id="job-status-badge"
                  className={
                    jobStatus.status === 'done' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                    jobStatus.status === 'error' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' :
                    'bg-blue-500/20 text-blue-400 border-blue-500/30'
                  }
                >
                  {jobStatus.status === 'processing' && (
                    <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  )}
                  {jobStatus.status.toUpperCase()}
                </Badge>
              </div>
              <Progress value={jobStatus.progress_pct} className="h-2" />
              <p className="text-xs text-slate-500">
                {jobStatus.total_processed} / {jobStatus.queued_for_analysis} analyzed
                {jobStatus.total_flagged > 0 && ` · ${jobStatus.total_flagged} flagged`}
              </p>
              {jobStatus.status === 'done' && (
                <p className="text-xs text-emerald-400">
                  ✓ Analysis complete — check the dashboard for results.
                </p>
              )}
              {jobStatus.error && (
                <p className="text-xs text-rose-400">Error: {jobStatus.error}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Live Feed */}
        <Card className="bg-gradient-to-r from-purple-500/10 to-transparent border-purple-500/20 backdrop-blur-md">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  {liveFeedActive
                    ? <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
                    : <WifiOff className="w-4 h-4 text-slate-500" />
                  }
                  Live Data Feed
                </h3>
                <p className="text-sm text-slate-400">
                  Stream seed reviews from the demo pipeline via SSE
                </p>
              </div>
              <Button
                id="live-feed-btn"
                onClick={toggleLiveFeed}
                className={
                  liveFeedActive
                    ? 'bg-rose-500 hover:bg-rose-600 text-white'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }
              >
                {liveFeedActive ? 'Stop Feed' : 'Start Live Feed'}
              </Button>
            </div>

            {liveFeedItems.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {liveFeedItems.map((item, i) => (
                  <div key={i} className="text-xs text-slate-400 bg-white/5 rounded px-3 py-1.5 border border-white/5">
                    {item}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

// Tiny stat box component
function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-black/30 rounded-lg p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}
