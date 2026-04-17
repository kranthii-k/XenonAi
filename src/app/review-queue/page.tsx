"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export default function ReviewQueue() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const res = await fetch('/api/reviews/queue');
        const data = await res.json();
        setReviews(data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchQueue();
  }, []);

  const handleResolve = (id: string, newSentiment: string) => {
    // In a real app we would POST to /api/reviews/resolve
    setReviews(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-slate-200 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="border-b border-white/10 pb-6">
          <h1 className="text-3xl font-bold text-white">Review Queue</h1>
          <p className="text-slate-400">Human validation for ambiguous or sarcastic reviews</p>
        </header>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-xl">
          <CardHeader>
            <CardTitle className="text-white flex justify-between">
              Pending Validation 
              <Badge className="bg-purple-500/20 text-purple-400">{reviews.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="text-center py-10 text-slate-500">Loading queue...</div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-10 text-emerald-400">All caught up! No reviews require human validation.</div>
            ) : (
              reviews.map(r => (
                <div key={r.id} className="p-4 border border-white/10 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex space-x-2 items-center">
                      {r.isSarcastic && <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20">Sarcastic</Badge>}
                      {r.isAmbiguous && <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20">Ambiguous</Badge>}
                      <Badge variant="outline" className="text-xs text-slate-500 border-white/10">{r.language.toUpperCase()}</Badge>
                    </div>
                  </div>
                  <p className="text-slate-200 indent-0 mb-2 italic">"{r.originalText}"</p>
                  
                  <div className="flex space-x-3 mt-4">
                    <Button onClick={() => handleResolve(r.id, 'positive')} size="sm" className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">Approve Positive</Button>
                    <Button onClick={() => handleResolve(r.id, 'negative')} size="sm" className="bg-rose-500/20 text-rose-400 hover:bg-rose-500/30">Approve Negative</Button>
                    <Button onClick={() => handleResolve(r.id, 'neutral')} size="sm" variant="outline" className="border-white/10 text-slate-400">Mark Neutral</Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
