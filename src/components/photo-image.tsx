import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/signed-url";
import { cn } from "@/lib/utils";

export function PhotoImage({ path, className, alt }: { path: string; className?: string; alt?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getSignedUrl(path).then((u) => { if (alive) setUrl(u); });
    return () => { alive = false; };
  }, [path]);
  if (!url) return <div className={cn("bg-muted animate-pulse", className)} />;
  return <img src={url} alt={alt ?? ""} className={className} loading="lazy" draggable={false} />;
}
