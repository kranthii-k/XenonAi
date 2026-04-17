"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, UploadCloud, AlertTriangle, UserCheck, Settings } from "lucide-react";
import { motion } from "framer-motion";

const navItems = [
  { href: "/", label: "Dashboard", icon: <LayoutDashboard size={20} /> },
  { href: "/upload", label: "Ingestion", icon: <UploadCloud size={20} /> },
  { href: "/alerts", label: "Active Alerts", icon: <AlertTriangle size={20} /> },
  { href: "/review-queue", label: "Review Queue", icon: <UserCheck size={20} /> },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 border-r border-white/5 bg-[#050505] flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-white/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl -z-10 rounded-full" />
        <Link href="/">
          <div className="flex items-center space-x-2 cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-bold text-lg">X</span>
            </div>
            <span className="font-extrabold text-xl tracking-tight text-white/90">Xenon AI</span>
          </div>
        </Link>
      </div>

      <div className="flex-1 px-4 py-6 space-y-2">
        <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Telemetry</p>
        
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div className={`relative flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-colors group cursor-pointer ${isActive ? 'text-white' : 'text-slate-400 hover:text-white'}`}>
                {isActive && (
                  <motion.div 
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-white/[0.06] border border-white/10 rounded-lg -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                {isActive && <div className="absolute left-0 top-[20%] bottom-[20%] w-0.5 bg-purple-500 rounded-r-md shadow-[0_0_10px_0_rgba(168,85,247,0.5)]" />}
                
                <span className={`transition-colors ${isActive ? 'text-purple-400' : 'text-slate-500 group-hover:text-slate-300'}`}>
                   {item.icon}
                </span>
                <span className="font-medium text-sm">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-white/5">
        <div className="flex items-center space-x-3 px-3 py-2.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
          <Settings size={20} />
          <span className="font-medium text-sm">Settings</span>
        </div>
      </div>
    </aside>
  );
}
