"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, Square, Zap } from "lucide-react";

interface LiveFeedSimulatorProps {
  productId: string | null;
}

export function LiveFeedSimulator({ productId }: LiveFeedSimulatorProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  // Cancellation flag — set to true when the user hits Stop
  const stoppedRef = useRef(false);

  const noProduct = !productId;

  // ── Stop ──────────────────────────────────────────────────────────────────
  const stopSimulation = useCallback(() => {
    stoppedRef.current = true;
  }, []);

  // ── Start ─────────────────────────────────────────────────────────────────
  const startSimulation = useCallback(async () => {
    if (noProduct || isRunning) return;

    stoppedRef.current = false;
    setIsRunning(true);
    setProgress(0);
    setTotal(0);

    try {
      // 1. Fetch the demo corpus for the selected product
      const res = await fetch(`/api/demo-reviews?product_id=${productId}`);
      if (!res.ok) {
        console.error("[LiveFeedSimulator] Failed to fetch demo reviews:", await res.json());
        return;
      }

      const raw = await res.json();
      let reviews: string[] = [];

      // Accept both string[] and {text: string}[] from the API
      if (Array.isArray(raw)) {
        if (typeof raw[0] === "string") {
          reviews = raw as string[];
        } else if (raw[0]?.text) {
          reviews = raw.map((r: { text: string }) => r.text);
        }
      }

      if (reviews.length === 0) {
        console.error("[LiveFeedSimulator] No reviews returned for", productId);
        return;
      }

      setTotal(reviews.length);

      // 2. Simulated real-time API feed — one review per HTTP request, 800ms apart
      for (let i = 0; i < reviews.length; i++) {
        // Honour the stop signal before every request
        if (stoppedRef.current) break;

        const formData = new FormData();
        formData.append("product_id", productId!);
        // Single review as the "text" field — ingest splits on \n, so one line = one review
        formData.append("text", reviews[i]);

        try {
          await fetch("/api/ingest", { method: "POST", body: formData });
        } catch (postErr) {
          console.error("[LiveFeedSimulator] POST failed:", postErr);
        }

        setProgress(i + 1);

        // Realistic delay — checked again right before sleeping so Stop is instant
        if (!stoppedRef.current) {
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(resolve, 800);
            // Poll the flag every 50ms so Stop cancels the sleep quickly
            const poll = setInterval(() => {
              if (stoppedRef.current) {
                clearTimeout(timeout);
                clearInterval(poll);
                resolve();
              }
            }, 50);
          });
        }
      }
    } catch (err) {
      console.error("[LiveFeedSimulator] Error:", err);
    } finally {
      stoppedRef.current = false;
      setIsRunning(false);
    }
  }, [productId, isRunning, noProduct]);

  // ── No product selected ───────────────────────────────────────────────────
  if (noProduct) {
    return (
      <Button
        disabled
        title="Select a specific product above to simulate a live review feed"
        className="font-semibold tracking-wide flex items-center gap-1.5
          bg-transparent border border-dashed border-slate-500/50
          text-slate-400 hover:bg-transparent cursor-not-allowed opacity-70"
      >
        <Zap className="w-3.5 h-3.5" />
        Simulate Live Feed
      </Button>
    );
  }

  // ── Running — show Stop button ────────────────────────────────────────────
  if (isRunning) {
    return (
      <Button
        onClick={stopSimulation}
        className="font-semibold tracking-wide flex items-center gap-2
          bg-rose-600 hover:bg-rose-700 text-white transition-colors"
      >
        <Square className="w-3.5 h-3.5 fill-white" />
        Stop ({progress}/{total})
      </Button>
    );
  }

  // ── Idle — ready to start ─────────────────────────────────────────────────
  return (
    <Button
      onClick={startSimulation}
      className="font-semibold tracking-wide flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white"
    >
      <Play className="w-4 h-4 fill-white" />
      Simulate Live Feed
    </Button>
  );
}
