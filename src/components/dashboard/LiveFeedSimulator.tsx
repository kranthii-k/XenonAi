"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Zap } from "lucide-react";

interface LiveFeedSimulatorProps {
  productId: string | null;
}

export function LiveFeedSimulator({ productId }: LiveFeedSimulatorProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  const noProduct = !productId;

  const startSimulation = async () => {
    if (noProduct || isRunning) return;
    setIsRunning(true);
    setProgress(0);
    setTotal(0);

    try {
      const res = await fetch(`/api/demo-reviews?product_id=${productId}`);
      if (!res.ok) {
        const err = await res.json();
        console.error("[LiveFeedSimulator] API error:", err);
        return;
      }

      const raw = await res.json();

      let reviews: string[] = [];
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

      for (let i = 0; i < reviews.length; i++) {
        const formData = new FormData();
        formData.append("product_id", productId!);
        formData.append("text", reviews[i]);

        try {
          await fetch("/api/ingest", { method: "POST", body: formData });
        } catch (postErr) {
          console.error("[LiveFeedSimulator] POST failed:", postErr);
        }

        setProgress(i + 1);
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } catch (err) {
      console.error("[LiveFeedSimulator] Error:", err);
    } finally {
      setIsRunning(false);
    }
  };

  // ── Running state ────────────────────────────────────────────────────────
  if (isRunning) {
    return (
      <Button
        disabled
        className="font-semibold tracking-wide flex items-center gap-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/15 cursor-default"
      >
        <span className="relative flex h-2.5 w-2.5 mr-1">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
        </span>
        Streaming ({progress}/{total})…
      </Button>
    );
  }

  // ── No product selected — clearly visible but disabled ───────────────────
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

  // ── Product selected — fully active ─────────────────────────────────────
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
