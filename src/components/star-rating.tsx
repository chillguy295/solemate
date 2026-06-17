import { Star } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function StarRating({ onRate, disabled }: { onRate: (n: number) => void; disabled?: boolean }) {
  const [hover, setHover] = useState(0);
  const [clicked, setClicked] = useState(0);
  return (
    <div className="flex items-center justify-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => { onRate(n); setClicked(n); setTimeout(() => setClicked(0), 300); }}
          className={cn(
            "p-1.5 rounded-full transition-all duration-150 disabled:opacity-50",
            hover >= n ? "scale-110" : "",
            clicked === n ? "animate-bounce" : "",
          )}
          aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
        >
          <Star
            className={cn(
              "size-10 transition-all duration-150 drop-shadow-sm",
              hover >= n ? "fill-[var(--star)] text-[var(--star)] scale-110" : "text-muted-foreground/40",
            )}
            strokeWidth={1.2}
          />
        </button>
      ))}
      {hover > 0 && (
        <span className="text-xs text-muted-foreground ml-2 animate-fade-in">
          {hover === 5 ? "Perfect!" : hover === 4 ? "Great!" : hover === 3 ? "OK" : hover === 2 ? "Meh" : "Nah"}
        </span>
      )}
    </div>
  );
}

export function StarDisplay({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <div className="inline-flex items-center gap-0.5 text-[var(--star)]">
      <Star className="fill-current" style={{ width: size, height: size }} strokeWidth={0} />
      <span className="text-xs font-semibold text-foreground tabular-nums">{value.toFixed(1)}</span>
    </div>
  );
}
