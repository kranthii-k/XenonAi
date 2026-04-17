"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ShieldCheck, AlertTriangle } from "lucide-react";

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const res = await fetch("/api/alerts");
      const data = await res.json();
      setAlerts(data || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const intervalId = setInterval(fetchAlerts, 5000);
    return () => clearInterval(intervalId);
  }, []);

  const handleResolve = async (id: string) => {
    try {
      await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="flex-1 p-8 overflow-x-hidden">
      <div className="max-w-5xl mx-auto space-y-8">
        
        <header className="border-b border-white/10 pb-6 relative">
           <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/10 blur-3xl -z-10 rounded-full" />
           <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-amber-400">Active Anomalies</h1>
           <p className="text-slate-400 font-medium mt-1">Manage, audit, and resolve localized production alerts pushed by telemetry.</p>
        </header>

        {loading ? (
           <div className="flex justify-center py-20 text-slate-500"><Loader2 className="w-8 h-8 animate-spin" /></div>
        ) : alerts.length === 0 ? (
           <motion.div 
             initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
             className="flex flex-col items-center justify-center py-20 px-4 text-center border border-emerald-500/20 rounded-2xl bg-emerald-500/5 backdrop-blur-md"
           >
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 border border-emerald-500/20 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]">
                <ShieldCheck className="w-8 h-8 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Systems Nominal</h2>
              <p className="text-slate-400 max-w-sm">No systemic anomalies detected across product lines. Telemetry is routing safely.</p>
           </motion.div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AnimatePresence>
              {alerts.map((alert, index) => (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                  transition={{ type: "spring", stiffness: 100, delay: index * 0.05 }}
                >
                  <Card className={`h-full bg-white/5 backdrop-blur-md transition-shadow relative overflow-hidden group ${alert.severity === 'critical' ? 'border-rose-500/30 shadow-[0_0_20px_-5px_rgba(244,63,94,0.1)] hover:shadow-[0_0_20px_-5px_rgba(244,63,94,0.2)] hover:border-rose-500/50' : 'border-amber-500/30 hover:border-amber-500/50'}`}>
                    <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl -z-10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 ${alert.severity === 'critical' ? 'bg-rose-500/20' : 'bg-amber-500/20'}`} />
                    
                    <CardHeader className="flex flex-row items-start justify-between pb-2 space-y-0 relative z-10">
                      <div className="space-y-2">
                        <Badge className={`${alert.severity === 'critical' ? 'bg-rose-500 hover:bg-rose-600 shadow-[0_0_10px_-2px_rgba(244,63,94,0.5)] border-rose-400/50' : 'bg-amber-500 hover:bg-amber-600 border-amber-400/50'} uppercase tracking-wide px-3 py-1`}>
                          {alert.severity}
                        </Badge>
                        <CardTitle className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                          <AlertTriangle className={alert.severity === 'critical' ? 'text-rose-400 w-5 h-5' : 'text-amber-400 w-5 h-5'} /> 
                          {alert.feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        </CardTitle>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-xs font-mono text-slate-500">{new Date(alert.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                        <div className="flex space-x-2 text-sm font-mono mt-1 font-semibold">
                          <span className="text-slate-400">{alert.previousPct.toFixed(1)}%</span>
                          <span className="text-slate-500">➔</span>
                          <span className={`${alert.severity === 'critical' ? 'text-rose-400' : 'text-amber-400'}`}>{alert.currentPct.toFixed(1)}%</span>
                        </div>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="relative z-10 pt-4 flex flex-col justify-between" style={{ minHeight: '120px'}}>
                      <p className="text-slate-300 font-medium leading-relaxed">{alert.message}</p>
                      
                      <div className="mt-6 pt-4 border-t border-white/5 flex justify-end">
                        <Button 
                          onClick={() => handleResolve(alert.id)}
                          variant="outline" 
                          className="text-emerald-400 border-white/10 bg-white/5 hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-300 transition-colors"
                        >
                          <ShieldCheck className="w-4 h-4 mr-2" /> Mark Resolved
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
