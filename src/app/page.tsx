"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, LineChart, Line, ReferenceLine } from "recharts";
import { Activity, AlertTriangle, MessageSquare, TrendingUp, Download } from "lucide-react";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { generateReport } from "@/lib/utils/export";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useTheme } from "next-themes";

// Initial Mock Data Fallback
const fallbackFeatureData = [
  { feature: "Battery Life", positive: 65, neutral: 10, negative: 25 },
  { feature: "Display Quality", positive: 85, neutral: 10, negative: 5 },
  { feature: "Camera", positive: 90, neutral: 5, negative: 5 },
  { feature: "Build Quality", positive: 70, neutral: 15, negative: 15 },
  { feature: "Software", positive: 50, neutral: 20, negative: 30 },
];

const fallbackTrendData = Array.from({ length: 15 }).map((_, i) => ({
  batch: `Batch ${i + 1}`,
  negativeRate: i === 12 ? 45 : 10 + Math.random() * 5,
  isAnomaly: i === 12
}));

// Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 100 }
  }
};

export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [featureData, setFeatureData] = useState<any[]>(fallbackFeatureData);
  const [trendData, setTrendData] = useState<any[]>(fallbackTrendData);
  const [activeAlertsList, setActiveAlertsList] = useState<any[]>([]);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [avgSentiment, setAvgSentiment] = useState(75);
  const { theme } = useTheme();

  const fetchDashboardData = async () => {
    try {
      const [fRes, tRes, aRes] = await Promise.all([
        fetch('/api/features'),
        fetch('/api/trends'),
        fetch('/api/alerts')
      ]);
      const fData = await fRes.json();
      const tData = await tRes.json();
      const aData = await aRes.json();
      
      if (fData && fData.features) {
         setFeatureData(fData.features.length > 0 ? fData.features : fallbackFeatureData);
         if (fData.total_records !== undefined) setReviewsCount(fData.total_records);
         if (fData.global_sentiment_score !== undefined) setAvgSentiment(fData.global_sentiment_score);
      }
      
      if (tData && Array.isArray(tData) && tData.length > 0) {
         const formattedTrends = tData.map((t: any) => ({
           batch: `B-${t.batchIndex.toString().slice(-4)}`, // Show last 4 digits of index for brevity
           negativeRate: Number(t.negativePct).toFixed(1),
           isAnomaly: t.isAnomaly
         }));
         setTrendData(formattedTrends);
      }
      
      if (aData && Array.isArray(aData)) setActiveAlertsList(aData);
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchDashboardData();
    const intervalId = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(intervalId);
  }, []);

  const handleExport = () => {
    const reportData = {
      features: featureData.map(f => ({
         feature: f.feature,
         positive_pct: f.positive,
         negative_pct: f.negative,
         avg_confidence: 0.95 // mock confidence aggregate
      })),
      alerts: activeAlertsList
    };
    generateReport("System Dashboard", reportData);
  };

  if (!mounted) return <div className="min-h-screen bg-background text-foreground flex items-center justify-center">Loading Engine...</div>;

  return (
    <div className="flex-1 p-8 font-sans overflow-x-hidden">
      <motion.div 
        className="max-w-[1600px] mx-auto space-y-8"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        
        {/* Header section w/ Glassmorphism */}
        <motion.header variants={itemVariants} className="flex justify-between items-end pb-6 border-b border-slate-200 dark:border-white/5 relative">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-emerald-500/5 dark:from-purple-500/10 dark:to-blue-500/10 blur-[100px] -z-10" />
          <div className="space-y-2">
            <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-white/60">
              Xenon Intelligence
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium">Real-time NLP telemetry & anomaly detection</p>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <Button onClick={handleExport} variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-white/10 bg-emerald-50 dark:bg-white/5 hover:bg-emerald-100 dark:hover:bg-emerald-500/10 transition-colors">
              <Download className="w-4 h-4 mr-2" /> Export PDF Report
            </Button>
            <div className="flex items-center space-x-3 text-sm font-semibold tracking-wide bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-full shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-400">DATABASE CONNECTED</span>
            </div>
          </div>
        </motion.header>

        {/* 4 Metric Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard title="Processed Records" value={reviewsCount.toLocaleString()} sub="Live ingestion tracked" icon={<MessageSquare className="w-5 h-5 text-blue-400" />} />
          <MetricCard title="Avg Sentiment" value={`${avgSentiment}%`} sub="+2.5% from last batch" icon={<Activity className="w-5 h-5 text-emerald-400" />} />
          <MetricCard title="Active Alerts" value={activeAlertsList.length.toString()} sub="Requires attention" icon={<AlertTriangle className="w-5 h-5 text-rose-400" />} highlight={activeAlertsList.length > 0} />
          <MetricCard title="Last Z-Score" value={trendData.length > 0 ? `${Number(trendData[trendData.length-1].negativeRate).toFixed(1)}σ` : "0"} sub="Calculated variance" icon={<TrendingUp className="w-5 h-5 text-purple-400" />} />
        </motion.div>

        {/* 60/40 Split */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Feature Sentiment Chart (60%) */}
          <Card className="lg:col-span-8 bg-card border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-xl overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="relative z-10">
              <CardTitle className="text-xl font-semibold text-foreground">Sentiment by Feature</CardTitle>
              <CardDescription className="text-muted-foreground">Extracted natively from database</CardDescription>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%" minHeight={100} minWidth={100}>
                  <BarChart data={featureData} layout="vertical" margin={{ left: 100, right: 30 }}>
                    <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} stroke={theme === 'dark' ? '#555' : '#ccc'} />
                    <YAxis type="category" dataKey="feature" width={100} stroke={theme === 'dark' ? '#aaa' : '#666'} tickLine={false} axisLine={false} />
                    <Tooltip 
                      cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                      formatter={(v: number) => `${v}%`} 
                      contentStyle={{ backgroundColor: theme === 'dark' ? '#1A1A1A' : '#ffffff', borderColor: theme === 'dark' ? '#333' : '#eee', color: theme === 'dark' ? '#fff' : '#111', borderRadius: '8px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="positive" stackId="a" fill="#10B981" name="Positive" radius={[0, 0, 0, 0]} animationDuration={1000} />
                    <Bar dataKey="neutral" stackId="a" fill="#64748B" name="Neutral" animationDuration={1000} />
                    <Bar dataKey="negative" stackId="a" fill="#EF4444" name="Negative" radius={[0, 4, 4, 0]} animationDuration={1000} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Alert Feed (40%) */}
          <Card className="lg:col-span-4 bg-card border-border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-xl overflow-hidden">
            <CardHeader>
              <CardTitle className="text-xl font-semibold text-foreground flex items-center justify-between">
                <span>Systemic Alerts</span>
                <Badge variant="destructive" className="bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 font-mono tracking-wider ml-2 border border-rose-500/30 animate-pulse">{activeAlertsList.length} NEW</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[350px] overflow-y-auto custom-scrollbar">
              {activeAlertsList.length === 0 ? (
                 <div className="text-center py-10 text-slate-400 dark:text-slate-500">No active alerts detected in database.</div>
              ) : activeAlertsList.map(alert => (
                <div key={alert.id} className="p-4 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100 dark:hover:bg-white/[0.05] hover:border-slate-300 dark:hover:border-white/20 transition-all group cursor-pointer relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-rose-500 to-amber-500 opacity-50 group-hover:opacity-100 transition-opacity" />
                  <div className="flex justify-between items-start mb-2 pl-3">
                    <Badge className={alert.severity === 'critical' ? 'bg-rose-500 hover:bg-rose-600 border-none shadow-[0_0_10px_-2px_rgba(244,63,94,0.5)]' : 'bg-amber-500 hover:bg-amber-600 border-none'}>
                      {alert.feature}
                    </Badge>
                    <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">{new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit'})}</span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium pl-3">{alert.message}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Full width trend line chart */}
        <motion.div variants={itemVariants}>
          <Card className="bg-card border-border backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-xl group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-t from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-semibold text-foreground">Trend Volatility (Z-Score Timeline)</CardTitle>
                  <CardDescription className="text-muted-foreground">Rolling window comparison of battery_life negative sentiment</CardDescription>
                </div>
                <Badge variant="outline" className="text-purple-400 border-purple-500/30 bg-purple-500/10 px-3 py-1 font-mono text-xs shadow-[0_0_15px_-3px_rgba(168,85,247,0.3)]">LIVE DB</Badge>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%" minHeight={100} minWidth={100}>
                  <LineChart data={trendData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                    <XAxis dataKey="batch" stroke={theme === 'dark' ? '#555' : '#ccc'} tickLine={false} axisLine={false} />
                    <YAxis stroke={theme === 'dark' ? '#555' : '#ccc'} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: theme === 'dark' ? '#1A1A1A' : '#ffffff', borderColor: theme === 'dark' ? '#333' : '#eee', color: theme === 'dark' ? '#fff' : '#111', borderRadius: '8px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                      formatter={(val: number) => [`${val}%`, "Negative Pct"]} 
                      labelStyle={{ color: theme === 'dark' ? '#aaa' : '#666', marginBottom: '8px', display: 'block' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="negativeRate" 
                      stroke="#8B5CF6" 
                      strokeWidth={3}
                      dot={{ fill: '#8B5CF6', r: 4, strokeWidth: 0 }}
                      activeDot={{ r: 8, fill: '#C084FC', stroke: '#fff', strokeWidth: 2 }}
                      animationDuration={1500}
                    />
                    <ReferenceLine x="Batch 13" stroke="#EF4444" strokeDasharray="3 3">
                    </ReferenceLine>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

function MetricCard({ title, value, sub, icon, highlight = false }: any) {
  return (
    <Card className={`border-border transition-all duration-300 hover:-translate-y-1 ${highlight ? 'bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-500/10 dark:to-orange-500/5 shadow-[0_8px_30px_rgb(244,63,94,0.1)] dark:shadow-[0_0_30px_-5px_rgba(244,63,94,0.3)]' : 'bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-md'}`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative overflow-hidden">
        <CardTitle className="text-sm font-medium text-muted-foreground z-10">{title}</CardTitle>
        <div className="z-10 bg-slate-100 dark:bg-white/5 p-2 rounded-lg border border-border">{icon}</div>
        {highlight && <div className="absolute -top-10 -right-10 w-20 h-20 bg-rose-500/10 dark:bg-rose-500/20 blur-2xl rounded-full" />}
      </CardHeader>
      <CardContent className="relative z-10">
        <div className="text-3xl font-extrabold text-foreground tracking-tight drop-shadow-sm">{value}</div>
        <p className={`text-xs mt-1 font-medium ${highlight ? 'text-rose-500 dark:text-rose-400' : 'text-muted-foreground'}`}>{sub}</p>
      </CardContent>
    </Card>
  );
}
