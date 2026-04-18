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

interface FeedLog { id: number; type: 'normal' | 'error' | 'anomaly' | 'system'; text: string; ts: string; }

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
  interface FeedLog { id: number; type: 'normal' | 'error' | 'anomaly' | 'system'; text: string; ts: string; }
  const [liveFeedActive, setLiveFeedActive] = useState(false);
  const [liveFeedItems, setLiveFeedItems] = useState<FeedLog[]>([]);
  const [scanCount, setScanCount] = useState(0);
  const [n8nConnected, setN8nConnected] = useState<boolean | null>(null);
  const terminalEndRef = useRef<HTMLDivElement>(null);
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

  const ts = () => new Date().toLocaleTimeString('en-US', { hour12: false });

  const addLog = (type: FeedLog['type'], text: string) => {
    setLiveFeedItems(prev => [...prev, { id: Date.now() + Math.random(), type, text, ts: ts() }]);
  };

  const toggleLiveFeed = () => {
    if (liveFeedActive) {
      eventSourceRef.current?.close();
      setLiveFeedActive(false);
      addLog('system', '[SYSTEM] Feed manually stopped.');
    } else {
      setLiveFeedItems([]);
      setScanCount(0);
      setN8nConnected(null);

      // Boot sequence
      const bootLines = [
        '[BOOT] XenonAI Telemetry Engine v2.0 initializing...',
        '[BOOT] Connecting to SSE data pipeline...',
        '[BOOT] Anomaly detection armed. Crisis threshold: Z > 1.5 | negPct > 20%',
        '[BOOT] n8n Swarm relay: checking http://localhost:5678...',
      ];
      bootLines.forEach((line, i) => {
        setTimeout(() => addLog('system', line), i * 180);
      });

      // Test n8n availability
      fetch('/api/health/n8n').then(r => {
        setN8nConnected(r.ok);
        setTimeout(() => addLog(
          r.ok ? 'system' : 'error',
          r.ok ? '[SYSTEM] n8n Swarm online ✓ — webhook ready' : '[WARN] n8n offline — webhook dispatch will queue silently'
        ), bootLines.length * 180 + 100);
      }).catch(() => {
        setN8nConnected(false);
        setTimeout(() => addLog('error', '[WARN] n8n offline — start with: npx n8n'), bootLines.length * 180 + 100);
      });

      const es = new EventSource('/api/feed');
      eventSourceRef.current = es;
      setLiveFeedActive(true);

      es.onmessage = (e) => {
        try {
          const review = JSON.parse(e.data);
          if (review.error) {
            addLog('error', `[ERROR] ${review.message}`);
          } else if (review.isAnomaly) {
            addLog('anomaly', `[CRITICAL ANOMALY] 🚨 Systemic failure in [${review.product_id}] → Feature: battery_life. Z-score threshold crossed. Webhook dispatched to n8n Crisis Swarm.`);
          } else {
            setScanCount(c => c + 1);
            const sentiment = review.sentiment === 'negative' ? '🔴' : review.sentiment === 'positive' ? '🟢' : '⚪';
            addLog('normal', `[INGESTED] ${sentiment} #${review.id?.substring(0, 8) ?? '??'} | ${review.product_id} | Sentiment: ${review.sentiment ?? 'neutral'} | Logged`);
          }
        } catch {/* ignore parse errors */}
      };

      es.addEventListener('done', () => {
        addLog('system', `[DONE] Stream complete. ${scanCount} reviews ingested. Anomaly engine standing by.`);
        es.close();
        setLiveFeedActive(false);
      });

      es.onerror = () => {
        addLog('error', '[SYSTEM] ⚠ Stream connection lost.');
        es.close();
        setLiveFeedActive(false);
      };
    }
  };

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [liveFeedItems]);

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const canSubmit =
    !isSubmitting &&
    (inputMode === 'file' ? !!selectedFile : pasteText.trim().length > 0);

  const isSuccess = !!(response && !response.error && response.job_id);
  const isError = !!(response && response.error);

  return (
    <div className="flex-1 p-8 overflow-x-hidden relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-40 bg-blue-500/10 blur-[100px] -z-10 rounded-full" />
      <div className="max-w-3xl mx-auto space-y-8">

        {/* Header */}
        <header className="border-b border-white/10 pb-6 relative">
          <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Data Ingestion Engine</h1>
          <p className="text-slate-400 mt-1 font-medium">
            Standardized deduplication, bot pattern extraction, and asynchronous NLP processing.
          </p>
        </header>

        {/* Product Selector */}
        <div className="space-y-2">
          <label className="text-sm text-slate-400 font-medium" htmlFor="product-id-input">
            Product <span className="text-slate-600">(required)</span>
          </label>
          <select
            id="product-id-input"
            value={productId}
            onChange={e => setProductId(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500/50 transition-colors appearance-none cursor-pointer"
          >
            <option value="" className="bg-slate-900">— Select a product —</option>
            <optgroup label="Electronics" className="bg-slate-900">
              <option value="smartphones" className="bg-slate-900">📱 Smartphones</option>
              <option value="earbuds" className="bg-slate-900">🎧 Earbuds</option>
              <option value="laptops" className="bg-slate-900">💻 Laptops</option>
            </optgroup>
            <optgroup label="Home Appliances" className="bg-slate-900">
              <option value="geyser" className="bg-slate-900">🔥 Geyser</option>
              <option value="refrigerator" className="bg-slate-900">🧊 Refrigerator</option>
              <option value="microwave-oven" className="bg-slate-900">📡 Microwave Oven</option>
            </optgroup>
          </select>
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

        {/* Live Feed Terminal */}
        <Card className="bg-gradient-to-br from-slate-900 to-slate-950 border-purple-500/20 backdrop-blur-md">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="space-y-1">
                <h3 className="font-semibold text-white flex items-center gap-2 flex-wrap">
                  {liveFeedActive
                    ? <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
                    : <WifiOff className="w-4 h-4 text-slate-500" />
                  }
                  Live Ingestion Terminal
                  {liveFeedActive && (
                    <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      {scanCount} scanned
                    </span>
                  )}
                  {n8nConnected === true && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      n8n online
                    </span>
                  )}
                  {n8nConnected === false && (
                    <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full">
                      n8n offline
                    </span>
                  )}
                </h3>
                <p className="text-sm text-slate-400">
                  Real-time SSE pipeline · anomaly detection · autonomous crisis webhook
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
                {liveFeedActive ? 'Stop Feed' : '▶ Start Live Feed'}
              </Button>
            </div>

            {liveFeedItems.length > 0 && (
              <div className="bg-[#0a0e17] border border-slate-800 rounded-xl font-mono text-xs overflow-y-auto h-[420px] p-4 space-y-1 shadow-inner">
                <div className="flex items-center gap-1.5 pb-3 mb-1 border-b border-slate-800">
                  <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                  <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  <span className="ml-2 text-slate-600 text-[10px] tracking-widest uppercase">XenonAI — Crisis Monitor</span>
                </div>
                {liveFeedItems.map((log) => (
                  <div key={log.id} className="flex gap-2 leading-relaxed">
                    <span className="text-slate-600 shrink-0 select-none">{log.ts}</span>
                    <span className={
                      log.type === 'normal'  ? 'text-emerald-400' :
                      log.type === 'anomaly' ? 'text-rose-400 font-bold animate-pulse' :
                      log.type === 'system'  ? 'text-sky-400' :
                      'text-amber-400'
                    }>
                      {log.text}
                    </span>
                  </div>
                ))}
                <div ref={terminalEndRef} />
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
