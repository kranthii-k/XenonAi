"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play, Loader2 } from "lucide-react";

export function LiveFeedSimulator() {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(200); // Default, updates dynamically when fetched

  const startSimulation = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setProgress(0);

    try {
      const res = await fetch("/data/demo-smartphones.json");
      if (!res.ok) throw new Error("Failed to fetch demo data");
      
      const textData = await res.text();
      // It might be a flat array of reviews, or objects with text
      const rawJson = JSON.parse(textData);
      
      // Ensure we extract an array of text strings properly regardless of format
      let reviews: string[] = [];
      if (Array.isArray(rawJson)) {
        if (typeof rawJson[0] === 'string') {
          reviews = rawJson;
        } else if (rawJson[0]?.text) {
          reviews = rawJson.map(r => r.text);
        } else if (rawJson[0]?.review) {
          reviews = rawJson.map(r => r.review);
        }
      } else if (rawJson.reviews && Array.isArray(rawJson.reviews)) {
        reviews = rawJson.reviews.map((r: any) => r.text || r.review || String(r));
      }

      setTotal(reviews.length > 0 ? reviews.length : 200);

      if (reviews.length === 0) {
        throw new Error("No reviews found in demo-smartphones.json");
      }

      for (let i = 0; i < reviews.length; i++) {
        const reviewText = reviews[i];

        const formData = new FormData();
        formData.append("product_id", "smartphones");
        formData.append("text", reviewText);

        try {
          await fetch("/api/ingest", {
            method: "POST",
            body: formData,
          });
        } catch (postErr) {
          console.error("Simulation POST failed:", postErr);
        }
        
        setProgress(i + 1);

        // Wait 1.5 seconds before sending the next one
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    } catch (err) {
      console.error("[LiveFeedSimulator] Error:", err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Button
      onClick={startSimulation}
      disabled={isRunning}
      className={`font-semibold tracking-wide flex items-center gap-2 transition-all ${
        isRunning
          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
          : "bg-blue-600 hover:bg-blue-700 text-white"
      }`}
    >
      {isRunning ? (
        <>
          <span className="relative flex h-2.5 w-2.5 mr-1">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          Live Streaming ({progress}/{total})...
        </>
      ) : (
        <>
          <Play className="w-4 h-4 fill-white" />
          Simulate Live Feed
        </>
      )}
    </Button>
  );
}
