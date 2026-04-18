"use client";

import { useState } from "react";
import { Globe, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "idle" | "loading" | "dispatching" | "done" | "error" | "missing";

export function ScrapedDataButton() {
  const [status, setStatus] = useState<Status>("idle");
  const [count, setCount] = useState(0);
  const [toastMsg, setToastMsg] = useState("");

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(""), 4000);
  };

  const handleIngest = async () => {
    setStatus("loading");

    try {
      // 1. Fetch scraped reviews from public/data
      const res = await fetch("/data/scraped-reviews.json");

      if (res.status === 404) {
        setStatus("missing");
        showToast("No scraped data found. Run: npm run scrape");
        return;
      }

      if (!res.ok) {
        setStatus("error");
        showToast("Failed to load scraped-reviews.json");
        return;
      }

      const allReviews: { product_id: string; text: string }[] = await res.json();
      if (!allReviews.length) {
        setStatus("error");
        showToast("scraped-reviews.json is empty. Run: npm run scrape");
        return;
      }

      setCount(allReviews.length);
      setStatus("dispatching");

      // 2. Group by product_id to send one batch per product
      const groups: Record<string, { product_id: string; text: string }[]> = {};
      for (const r of allReviews) {
        if (!groups[r.product_id]) groups[r.product_id] = [];
        groups[r.product_id].push(r);
      }

      // 3. POST each product group as a JSON file to /api/ingest
      const ingestPromises = Object.entries(groups).map(async ([productId, reviews]) => {
        const blob = new Blob([JSON.stringify(reviews)], { type: "application/json" });
        const file = new File([blob], `scraped-${productId}.json`, { type: "application/json" });

        const form = new FormData();
        form.append("product_id", productId);
        form.append("file", file);

        const r = await fetch("/api/ingest", { method: "POST", body: form });
        return r.ok;
      });

      await Promise.all(ingestPromises);

      setStatus("done");
      showToast(`Scraped data dispatched to Xenon NLP Pipeline — ${allReviews.length} reviews across ${Object.keys(groups).length} products.`);

      // Reset to idle after a few seconds
      setTimeout(() => setStatus("idle"), 5000);
    } catch (err) {
      console.error("[ScrapedDataButton] Error:", err);
      setStatus("error");
      showToast("Network error — is the dev server running?");
      setTimeout(() => setStatus("idle"), 4000);
    }
  };

  // ── Visual states ─────────────────────────────────────────────────────────

  const isLoading = status === "loading" || status === "dispatching";

  return (
    <div className="relative">
      <Button
        onClick={handleIngest}
        disabled={isLoading}
        className={`font-semibold tracking-wide flex items-center gap-2 transition-all ${
          status === "done"
            ? "bg-emerald-600 hover:bg-emerald-700 text-white"
            : status === "error" || status === "missing"
            ? "bg-rose-600 hover:bg-rose-700 text-white"
            : isLoading
            ? "bg-amber-600/80 text-white cursor-wait"
            : "bg-violet-600 hover:bg-violet-700 text-white"
        }`}
      >
        {status === "loading" && <Loader2 className="w-4 h-4 animate-spin" />}
        {status === "dispatching" && (
          <span className="relative flex h-2.5 w-2.5 mr-0.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
          </span>
        )}
        {status === "done" && <CheckCircle2 className="w-4 h-4" />}
        {(status === "error" || status === "missing") && <AlertCircle className="w-4 h-4" />}
        {!isLoading && status !== "done" && status !== "error" && status !== "missing" && (
          <Globe className="w-4 h-4" />
        )}

        {status === "idle"       && "Ingest Real Scraped Data"}
        {status === "loading"    && "Loading scraped data…"}
        {status === "dispatching"&& `Dispatching ${count} reviews…`}
        {status === "done"       && "Dispatched!"}
        {status === "error"      && "Error — retry?"}
        {status === "missing"    && "Run scrape first"}
      </Button>

      {/* Inline toast */}
      {toastMsg && (
        <div className="absolute top-full mt-2 right-0 z-50 min-w-[280px] max-w-sm bg-slate-800 border border-white/10 text-slate-200 text-xs px-4 py-2.5 rounded-lg shadow-xl animate-in fade-in slide-in-from-top-1 duration-200 leading-relaxed">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
