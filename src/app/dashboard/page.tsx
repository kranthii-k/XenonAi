"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, ReferenceLine, AreaChart, Area, CartesianGrid, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import {
  Activity, AlertTriangle, MessageSquare, TrendingUp, Download,
  Smartphone, Headphones, Laptop2, Flame, Refrigerator, Microwave
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { generateReport } from "@/lib/utils/export";
import { ThemeToggle } from "@/components/ThemeToggle";

// ─────────────────────────────────────────────────────────────────────────────
// Product catalog (static — matches seed data)
// ─────────────────────────────────────────────────────────────────────────────
const PRODUCT_CATALOG = [
  {
    id: "smartphones", name: "Smartphones", category: "Electronics",
    icon: Smartphone, color: "from-blue-500 to-indigo-600", accent: "#6366F1"
  },
  {
    id: "earbuds", name: "Earbuds", category: "Electronics",
    icon: Headphones, color: "from-purple-500 to-fuchsia-600", accent: "#A855F7"
  },
  {
    id: "laptops", name: "Laptops", category: "Electronics",
    icon: Laptop2, color: "from-cyan-500 to-blue-600", accent: "#06B6D4"
  },
  {
    id: "geyser", name: "Geyser", category: "Home Appliances",
    icon: Flame, color: "from-orange-500 to-rose-600", accent: "#F97316"
  },
  {
    id: "refrigerator", name: "Refrigerator", category: "Home Appliances",
    icon: Refrigerator, color: "from-teal-400 to-emerald-600", accent: "#14B8A6"
  },
  {
    id: "microwave-oven", name: "Microwave Oven", category: "Home Appliances",
    icon: Microwave, color: "from-amber-500 to-orange-600", accent: "#F59E0B"
  },
];

const CATEGORIES = ["All", "Electronics", "Home Appliances"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Fallback data
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_FEATURE_DATA = [
  { feature: "No Data Yet", positive: 0, neutral: 100, negative: 0 }
];
const EMPTY_TREND_DATA = Array.from({ length: 5 }, (_, i) => ({
  batch: `B-${i + 1}`, negativeRate: 0, isAnomaly: false
}));

// ─────────────────────────────────────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
};
const item = {
  hidden: { y: 16, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: "spring" as const, stiffness: 120 } }
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(true);

  // Product/category selection
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);

  // API data
  const [featureData, setFeatureData] = useState<any[]>(EMPTY_FEATURE_DATA);
  const [trendData, setTrendData] = useState<any[]>(EMPTY_TREND_DATA);
  const [activeAlertsList, setActiveAlertsList] = useState<any[]>([]);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [avgSentiment, setAvgSentiment] = useState(0);
  const [forecastData, setForecastData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ── Dark mode observer ────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    setIsDark(document.documentElement.classList.contains('dark'));
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains('dark'))
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  // ── Fetch data for selected product ──────────────────────────────────────
  const fetchData = useCallback(async (productId: string | null) => {
    setIsLoading(true);
    try {
      const qs = productId ? `?product_id=${productId}` : '';
      const fcQs = productId ? `?product_id=${productId}&feature=battery_life` : '';

      const [fRes, tRes, aRes, fcRes] = await Promise.all([
        fetch(`/api/features${qs}`),
        fetch(`/api/trends${qs}`),
        fetch(`/api/alerts${qs}`),
        productId ? fetch(`/api/forecasts${fcQs}`) : Promise.resolve(null),
      ]);

      const fData = await fRes.json();
      const tData = await tRes.json();
      const aData = await aRes.json();
      const fcData = fcRes ? await fcRes.json() : [];

      if (fData?.features) {
        setFeatureData(fData.features.length > 0 ? fData.features : EMPTY_FEATURE_DATA);
        if (fData.total_records !== undefined) setReviewsCount(fData.total_records);
        if (fData.global_sentiment_score !== undefined) setAvgSentiment(fData.global_sentiment_score);
      } else {
        setFeatureData(EMPTY_FEATURE_DATA);
        setReviewsCount(0);
        setAvgSentiment(0);
      }

      if (Array.isArray(tData) && tData.length > 0) {
        setTrendData(tData.map((t: any) => ({
          batch: `B-${String(t.batchIndex).slice(-4)}`,
          negativeRate: Number(t.negativePct).toFixed(1),
          isAnomaly: t.isAnomaly,
        })));
      } else {
        setTrendData(EMPTY_TREND_DATA);
      }

      setActiveAlertsList(Array.isArray(aData) ? aData : []);
      setForecastData(Array.isArray(fcData) && fcData[0]?.data ? fcData[0].data : []);
    } catch (err) {
      console.error('[dashboard] fetch error', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch on mount and re-fetch when product changes
  useEffect(() => {
    fetchData(selectedProductId);
    const id = setInterval(() => fetchData(selectedProductId), 10000);
    return () => clearInterval(id);
  }, [selectedProductId, fetchData]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const filteredProducts = activeCategory === "All"
    ? PRODUCT_CATALOG
    : PRODUCT_CATALOG.filter(p => p.category === activeCategory);

  const selectedProduct = PRODUCT_CATALOG.find(p => p.id === selectedProductId) ?? null;

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    // Only clear selection if the selected product doesn't belong to new category
    if (cat !== "All" && selectedProduct && selectedProduct.category !== cat) {
      setSelectedProductId(null);
    }
  };

  const handleExport = () => {
    generateReport(selectedProduct?.name ?? "All Products", {
      features: featureData.map(f => ({
        feature: f.feature, positive_pct: f.positive,
        negative_pct: f.negative, avg_confidence: 0.95
      })),
      alerts: activeAlertsList,
    });
  };

  const lastZScore = trendData.length > 0
    ? Number(trendData[trendData.length - 1].negativeRate).toFixed(1)
    : "0";

  const accentColor = selectedProduct?.accent ?? "#8B5CF6";

  if (!mounted) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground text-sm">Loading Xenon Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 lg:p-8 font-sans overflow-x-hidden">
      <motion.div
        className="max-w-[1600px] mx-auto space-y-6"
        variants={container}
        initial="hidden"
        animate="visible"
      >

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.header
          variants={item}
          className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 pb-5 border-b border-slate-200 dark:border-white/5 relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-emerald-500/5 dark:from-purple-500/10 dark:to-blue-500/10 blur-[80px] -z-10" />
          <div className="space-y-1">
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-white/60">
              Xenon Intelligence
            </h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
              Real-time NLP telemetry &amp; anomaly detection
              {selectedProduct && (
                <span className="ml-2 font-semibold" style={{ color: accentColor }}>
                  · {selectedProduct.name}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <ThemeToggle />
            <Button
              onClick={handleExport}
              variant="outline"
              size="sm"
              className="text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-white/10 bg-emerald-50 dark:bg-white/5 hover:bg-emerald-100 dark:hover:bg-emerald-500/10"
            >
              <Download className="w-4 h-4 mr-1.5" /> Export PDF
            </Button>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wide bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              </span>
              <span className="text-emerald-400">LIVE</span>
            </div>
          </div>
        </motion.header>

        {/* ── Category + Product Selector ────────────────────────────────── */}
        <motion.div variants={item} className="space-y-3">
          {/* Category row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mr-1">Category</span>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                id={`cat-${cat.replace(/\s/g, '-').toLowerCase()}`}
                onClick={() => handleCategoryChange(cat)}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                  activeCategory === cat
                    ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-500/20'
                    : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Product pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mr-1">Product</span>
            <button
              id="product-all"
              onClick={() => setSelectedProductId(null)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                selectedProductId === null
                  ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-md'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
              }`}
            >
              All Products
            </button>
            {filteredProducts.map(p => {
              const Icon = p.icon;
              const isActive = selectedProductId === p.id;
              return (
                <button
                  key={p.id}
                  id={`product-${p.id}`}
                  onClick={() => setSelectedProductId(p.id)}
                  className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${
                    isActive
                      ? `bg-gradient-to-r ${p.color} text-white shadow-lg`
                      : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {p.name}
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* ── Loading indicator ──────────────────────────────────────────── */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 text-sm text-slate-400"
            >
              <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Fetching live data...
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── 4 Metric Cards ─────────────────────────────────────────────── */}
        <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Analyzed Reviews"
            value={reviewsCount.toLocaleString()}
            sub={selectedProduct ? `For ${selectedProduct.name}` : "All products"}
            icon={<MessageSquare className="w-4 h-4 text-blue-400" />}
            accent={accentColor}
          />
          <MetricCard
            title="Avg Sentiment"
            value={reviewsCount > 0 ? `${avgSentiment}%` : "—"}
            sub={reviewsCount > 0 ? "Positive signal" : "Run NLP pipeline"}
            icon={<Activity className="w-4 h-4 text-emerald-400" />}
            accent="#10B981"
          />
          <MetricCard
            title="Active Alerts"
            value={activeAlertsList.length.toString()}
            sub="Requires attention"
            icon={<AlertTriangle className="w-4 h-4 text-rose-400" />}
            highlight={activeAlertsList.length > 0}
            accent="#F43F5E"
          />
          <MetricCard
            title="Neg. Rate"
            value={trendData.some(d => Number(d.negativeRate) > 0) ? `${lastZScore}%` : "—"}
            sub="Last captured batch"
            icon={<TrendingUp className="w-4 h-4 text-purple-400" />}
            accent="#8B5CF6"
          />
        </motion.div>

        {/* ── Feature Sentiment + Alerts 60/40 ───────────────────────────── */}
        <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-12 gap-5">

          {/* Feature Sentiment Bar Chart */}
          <Card className="lg:col-span-8 bg-card border-border shadow-sm dark:shadow-xl overflow-hidden group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="relative z-10 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-foreground">Sentiment by Feature</CardTitle>
                  <CardDescription className="text-muted-foreground text-xs mt-0.5">
                    {selectedProduct ? selectedProduct.name : "All products"} · from real NLP analysis
                  </CardDescription>
                </div>
                {selectedProduct && (
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${selectedProduct.color} flex items-center justify-center`}>
                    {<selectedProduct.icon className="w-4 h-4 text-white" />}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              {featureData.length === 0 || featureData[0]?.feature === "No Data Yet" ? (
                <EmptyState message="No feature data yet — trigger NLP analysis on the Ingestion page." />
              ) : (
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <BarChart data={featureData.slice(0, 8)} layout="vertical" margin={{ left: 110, right: 30 }}>
                      <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} stroke={isDark ? '#555' : '#ccc'} fontSize={11} />
                      <YAxis type="category" dataKey="feature" width={110} stroke={isDark ? '#aaa' : '#666'} tickLine={false} axisLine={false} fontSize={11} />
                      <Tooltip
                        cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}
                        formatter={(v: number) => [`${v}%`]}
                        contentStyle={{ backgroundColor: isDark ? '#1a1a1a' : '#fff', borderColor: isDark ? '#333' : '#eee', color: isDark ? '#fff' : '#111', borderRadius: '10px', fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ paddingTop: '16px', fontSize: 12 }} />
                      <Bar dataKey="positive" stackId="a" fill="#10B981" name="Positive" animationDuration={800} />
                      <Bar dataKey="neutral" stackId="a" fill="#64748B" name="Neutral" animationDuration={800} />
                      <Bar dataKey="negative" stackId="a" fill="#F43F5E" name="Negative" radius={[0, 4, 4, 0]} animationDuration={800} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Alert Feed */}
          <Card className="lg:col-span-4 bg-card border-border shadow-sm dark:shadow-xl overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold text-foreground flex items-center justify-between">
                <span>Systemic Alerts</span>
                <Badge
                  variant="destructive"
                  className={`font-mono text-xs border ${
                    activeAlertsList.length > 0
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse'
                      : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                  }`}
                >
                  {activeAlertsList.length} NEW
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[360px] overflow-y-auto custom-scrollbar">
              {activeAlertsList.length === 0 ? (
                <EmptyState message={selectedProduct ? `No alerts for ${selectedProduct.name}.` : "No active alerts across any product."} compact />
              ) : (
                activeAlertsList.map(alert => (
                  <div
                    key={alert.id}
                    className="p-3 rounded-xl border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/20 transition-all group cursor-pointer relative overflow-hidden"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-rose-500 to-amber-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                    <div className="flex justify-between items-start mb-1.5 pl-3">
                      <Badge className={`text-xs ${alert.severity === 'critical' ? 'bg-rose-500 text-white border-none' : 'bg-amber-500 text-white border-none'}`}>
                        {alert.feature?.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">
                        {new Date(alert.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed pl-3 line-clamp-3">{alert.message}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Trend Line ─────────────────────────────────────────────────── */}
        <motion.div variants={item}>
          <Card className="bg-card border-border shadow-sm dark:shadow-xl group overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-t from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="relative z-10 pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold text-foreground">Negative Sentiment Trend</CardTitle>
                  <CardDescription className="text-muted-foreground text-xs mt-0.5">
                    Rolling batch analysis · {selectedProduct?.name ?? "all products"}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-purple-400 border-purple-500/30 bg-purple-500/10 font-mono text-xs">
                  LIVE DB
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="relative z-10">
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <LineChart data={trendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <XAxis dataKey="batch" stroke={isDark ? '#444' : '#ccc'} tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis stroke={isDark ? '#444' : '#ccc'} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} fontSize={11} />
                    <Tooltip
                      contentStyle={{ backgroundColor: isDark ? '#1a1a1a' : '#fff', borderColor: isDark ? '#333' : '#eee', color: isDark ? '#fff' : '#111', borderRadius: '10px', fontSize: 12 }}
                      formatter={(val: number) => [`${val}%`, "Negative %"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="negativeRate"
                      stroke={accentColor}
                      strokeWidth={2.5}
                      dot={{ fill: accentColor, r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 6, fill: accentColor, stroke: '#fff', strokeWidth: 2 }}
                      animationDuration={1200}
                    />
                    <ReferenceLine y={30} stroke="#F43F5E" strokeDasharray="4 4" label={{ value: "Alert threshold", fill: '#F43F5E', fontSize: 10, position: 'insideTopRight' }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Forecast Chart ─────────────────────────────────────────────── */}
        {selectedProductId && (
          <motion.div variants={item}>
            <Card className="bg-card border-border shadow-sm dark:shadow-xl group overflow-hidden relative">
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-emerald-500/0 via-emerald-500/50 to-emerald-500/0" />
              <CardHeader className="relative z-10 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold text-foreground">Lifecycle Forecast (M24)</CardTitle>
                    <CardDescription className="text-muted-foreground text-xs mt-0.5">
                      ARIMA-powered sentiment stability projection · {selectedProduct?.name}
                    </CardDescription>
                  </div>
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 flex items-center gap-1.5 text-xs">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    PREDICTIVE
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="relative z-10">
                {forecastData.length === 0 ? (
                  <EmptyState message="Forecast data not yet generated. Trigger NLP analysis to enable forecasting." />
                ) : (
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <AreaChart data={forecastData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gActual" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gPred" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="cohort" stroke={isDark ? '#444' : '#ccc'} tickLine={false} axisLine={false} fontSize={11} />
                        <YAxis stroke={isDark ? '#444' : '#ccc'} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={v => `${v}%`} fontSize={11} />
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#ffffff08' : '#00000008'} vertical={false} />
                        <Tooltip
                          contentStyle={{ backgroundColor: isDark ? '#1a1a1a' : '#fff', borderColor: isDark ? '#333' : '#eee', color: isDark ? '#fff' : '#111', borderRadius: '10px', fontSize: 12 }}
                          formatter={(v: any) => [`${v}%`, "Sentiment"]}
                        />
                        <Legend verticalAlign="top" height={32} iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                        <Area type="monotone" dataKey="actual" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#gActual)" name="Actual" connectNulls={false} />
                        <Area type="monotone" dataKey="predicted" stroke="#8B5CF6" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#gPred)" name="Forecast" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* ── Product Overview Grid ──────────────────────────────────────── */}
        {!selectedProductId && (
          <motion.div variants={item}>
            <h2 className="text-base font-semibold text-foreground mb-3">Product Overview</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {PRODUCT_CATALOG.map(p => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    id={`overview-${p.id}`}
                    onClick={() => setSelectedProductId(p.id)}
                    className="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-card border border-border hover:border-transparent hover:shadow-lg transition-all duration-300 cursor-pointer text-center"
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${p.color} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs font-semibold text-foreground leading-tight">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground">{p.category}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}

      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

function MetricCard({ title, value, sub, icon, highlight = false, accent }: {
  title: string; value: string; sub: string; icon: React.ReactNode; highlight?: boolean; accent?: string;
}) {
  return (
    <Card className={`border-border transition-all duration-300 hover:-translate-y-0.5 ${
      highlight
        ? 'bg-gradient-to-br from-rose-50 to-orange-50 dark:from-rose-500/10 dark:to-orange-500/5 shadow-[0_0_20px_-5px_rgba(244,63,94,0.3)]'
        : 'bg-card shadow-sm dark:shadow-md'
    }`}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 relative overflow-hidden pt-4 px-4">
        <CardTitle className="text-xs font-semibold text-muted-foreground z-10 uppercase tracking-wide">{title}</CardTitle>
        <div className="z-10 bg-slate-100 dark:bg-white/5 p-1.5 rounded-lg border border-border">{icon}</div>
        {highlight && <div className="absolute -top-8 -right-8 w-16 h-16 bg-rose-500/15 dark:bg-rose-500/20 blur-2xl rounded-full" />}
      </CardHeader>
      <CardContent className="relative z-10 px-4 pb-4">
        <div className="text-2xl font-extrabold text-foreground tracking-tight">{value}</div>
        <p className={`text-xs mt-0.5 font-medium ${highlight ? 'text-rose-500 dark:text-rose-400' : 'text-muted-foreground'}`}>{sub}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message, compact = false }: { message: string; compact?: boolean }) {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'h-[280px]'} space-y-2`}>
      <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
        <Activity className="w-5 h-5 text-slate-400" />
      </div>
      <p className="text-sm text-slate-400 dark:text-slate-500 max-w-[240px] leading-snug">{message}</p>
    </div>
  );
}
