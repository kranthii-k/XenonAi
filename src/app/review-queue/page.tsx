"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, CheckCircle, ThumbsUp, ThumbsDown, Minus } from "lucide-react";

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

  const handleResolve = async (id: string, newSentiment: string) => {
    try {
      await fetch(`/api/reviews/${id}/resolve`, { 
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newSentiment })
      });
      // Slide out effect
      setReviews(prev => prev.filter(r => r.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-1 p-8 overflow-x-hidden">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <header className="border-b border-white/10 pb-6 relative">
          <div className="absolute top-0 left-0 w-48 h-48 bg-indigo-500/10 blur-3xl -z-10 rounded-full" />
          <h1 className="text-3xl font-extrabold text-white">Manual Review Validation</h1>
          <p className="text-slate-400 mt-1">Review system flags. Your verdicts continuously improve future pipeline confidence.</p>
        </header>

        <Card className="bg-white/5 border-white/10 backdrop-blur-md shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-50" />
          <CardHeader className="bg-black/20 border-b border-white/5">
            <CardTitle className="text-white flex items-center justify-between">
              Pending Audit Queue 
              <Badge className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-1 animate-pulse">
                {reviews.length} Tickets
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex justify-center items-center py-24 text-slate-500">
                 <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : reviews.length === 0 ? (
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-24 flex flex-col items-center justify-center space-y-4"
              >
                <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                   <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-emerald-400">Queue is Clear!</h3>
                  <p className="text-slate-400 text-sm mt-1">All flagged language anomalies have been safely verified.</p>
                </div>
              </motion.div>
            ) : (
              <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto custom-scrollbar">
                <AnimatePresence>
                  {reviews.map((r, index) => (
                    <motion.div 
                      key={r.id} 
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 50, scale: 0.95, transition: { duration: 0.2 } }}
                      transition={{ type: "spring", stiffness: 120, delay: index * 0.05 }}
                      className="p-6 bg-transparent hover:bg-white/[0.02] transition-colors relative group"
                    >
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                      
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex space-x-2 items-center">
                          {r.isSarcastic && (
                            <Badge className="bg-pink-500/10 text-pink-400 border-pink-500/30 font-medium tracking-wide">
                              Sarcasm Detected
                            </Badge>
                          )}
                          {r.isAmbiguous && (
                            <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/30 font-medium tracking-wide">
                              Ambiguous Phrasing
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-xs text-slate-500 border-white/10 uppercase tracking-widest bg-black/40">
                            {r.language || 'en'}
                          </Badge>
                        </div>
                        <span className="text-xs font-mono text-slate-500">{new Date(r.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short'})}</span>
                      </div>
                      
                      <div className="p-4 bg-black/30 rounded-xl border border-white/5 mb-5 relative">
                        <span className="absolute top-2 left-2 text-4xl text-white/5 font-serif font-bold">"</span>
                        <p className="text-slate-200 text-lg leading-relaxed relative z-10 px-4 py-2 font-medium">
                          {r.originalText || r.text}
                        </p>
                      </div>
                      
                      <div className="flex items-center space-x-4 border-t border-white/5 pt-4 mt-2">
                        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-2">Override Verdict:</span>
                        <Button 
                          onClick={() => handleResolve(r.id, 'positive')} 
                          className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 border border-emerald-500/20 rounded-full h-8 px-4 text-xs font-semibold transition-all"
                        >
                          <ThumbsUp className="w-3 h-3 mr-2" /> Positive
                        </Button>
                        <Button 
                          onClick={() => handleResolve(r.id, 'negative')} 
                          className="bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 border border-rose-500/20 rounded-full h-8 px-4 text-xs font-semibold transition-all"
                        >
                          <ThumbsDown className="w-3 h-3 mr-2" /> Negative
                        </Button>
                        <Button 
                          onClick={() => handleResolve(r.id, 'neutral')} 
                          variant="outline" 
                          className="border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white rounded-full h-8 px-4 text-xs font-semibold transition-all"
                        >
                          <Minus className="w-3 h-3 mr-2" /> Neutral
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
