import { useEffect, type ReactNode } from "react";
import { BottomNav } from "./bottom-nav";

export function AppShell({ children, hideNav = false }: { children: ReactNode; hideNav?: boolean }) {
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark" || (!saved && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[oklch(0.99_0.005_50)] to-[oklch(0.97_0.01_30)] dark:from-[oklch(0.15_0.01_270)] dark:to-[oklch(0.1_0.01_270)]">
      <div className="mx-auto w-full max-w-[480px] min-h-screen bg-background/80 relative pb-24">
        {children}
        {!hideNav && <BottomNav />}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-lg border-b border-border/50 px-5 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-xl font-heading font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
