"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, ShieldAlert } from "lucide-react";

interface StreamEvent {
  type: "review" | "flagged";
  id: string;
  text: string;
  sentiment?: string;
  feature?: string;
  reason?: string;
  score?: number | null;
  timestamp: string;
}

export function LiveTerminal() {
  const [messages, setMessages] = useState<StreamEvent[]>([]);

  // Ref to the scrollable terminal BODY — NOT to a bottom sentinel
  const scrollBodyRef = useRef<HTMLDivElement>(null);
  // Whether the user is currently near the bottom (auto-scroll eligible)
  const isNearBottom = useRef(true);
  // Whether we've done the one-time initial scroll to the terminal
  const hasScrolledToTerminal = useRef(false);

  useEffect(() => {
    const evtSource = new EventSource("/api/stream");

    evtSource.onmessage = (event) => {
      try {
        const rawArray = JSON.parse(event.data);
        if (Array.isArray(rawArray)) {
          setMessages((prev) => {
            const newMsgs = [...prev, ...rawArray];
            return newMsgs.slice(-100);
          });
        }
      } catch (err) {
        console.error("SSE parse error", err);
      }
    };

    return () => evtSource.close();
  }, []);

  // Track whether the user is near the bottom of the terminal scroll area
  const handleScroll = () => {
    const el = scrollBodyRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottom.current = distanceFromBottom < 80;
  };

  useEffect(() => {
    if (messages.length === 0) return;

    const el = scrollBodyRef.current;
    if (!el) return;

    // One-time: on very first message, scroll the PAGE to the terminal so the
    // user can see it — then never touch window scroll again.
    if (!hasScrolledToTerminal.current) {
      el.closest('[data-terminal-wrapper]')?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      hasScrolledToTerminal.current = true;
    }

    // Auto-scroll INSIDE the terminal box only if user is already near the bottom
    if (isNearBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  return (
    <div data-terminal-wrapper className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl overflow-hidden shadow-2xl mt-6 font-mono relative">
      {/* Terminal Header */}
      <div className="flex items-center px-4 py-2 bg-[#141414] border-b border-[#222]">
        <div className="flex gap-1.5 mr-4">
          <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
          <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
        </div>
        <div className="flex items-center text-xs text-slate-500 gap-2">
          <Terminal size={14} />
          <span>xenon-core-ingestion-feed - bash (80x24)</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs">
          <span className="flex h-2 w-2 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-emerald-500 uppercase tracking-widest font-bold">LIVE</span>
        </div>
      </div>

      {/* Terminal Body — scrollable, scroll events tracked here */}
      <div
        ref={scrollBodyRef}
        onScroll={handleScroll}
        className="p-4 h-64 overflow-y-auto custom-scrollbar text-xs leading-relaxed space-y-1.5 select-text"
      >
        <div className="text-slate-500 mb-4 opacity-70">
          <p>Xenon AI Ingestion Engine v2.0</p>
          <p>Listening for real-time telemetry on port 3000...</p>
        </div>

        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={`${msg.id}-${i}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex gap-2 font-mono word-break-all break-words"
            >
              {msg.type === "review" ? (
                <div className="text-slate-300">
                  <span className="text-emerald-400 font-semibold">[INCOMING]</span>
                  <span className="mx-1">
                    {msg.sentiment === "positive" ? "🟢 Positive" : msg.sentiment === "negative" ? "🔴 Negative" : "⚪ Neutral"}
                  </span>
                  <span className="text-slate-500 mx-1">|</span>
                  <span className="text-indigo-300">{msg.feature?.replace(/_/g, " ")}</span>
                  <span className="text-slate-500 mx-1">|</span>
                  <span className="text-slate-400">"{msg.text}"</span>
                </div>
              ) : (
                <div className="text-rose-400 opacity-90">
                  <span className="text-rose-500 font-bold bg-rose-500/10 px-1 rounded inline-flex items-center gap-1">
                    <ShieldAlert size={12} /> [BLOCKED]
                  </span>
                  <span className="mx-1 text-orange-400">
                    {msg.reason === "bot_pattern" ? "Spam Detected" : msg.reason === "exact_duplicate" ? "Duplicate Blocked" : "Near Duplicate"}
                  </span>
                  {msg.score !== null && msg.score !== undefined && (
                    <>
                      <span className="text-slate-500 mx-1">|</span>
                      <span className="text-rose-300">Jaccard Score: {Number(msg.score).toFixed(2)}</span>
                    </>
                  )}
                  <span className="text-slate-500 mx-1">|</span>
                  <span className="text-rose-200">"{msg.text}"</span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Blinking cursor */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-blue-400 font-bold">xenon@server:~$</span>
          <span className="w-2 h-4 bg-slate-400 animate-pulse"></span>
        </div>
      </div>
    </div>
  );
}
