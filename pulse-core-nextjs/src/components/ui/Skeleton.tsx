import { cn } from '@/lib/utils';

/**
 * Skeleton — shimmer placeholder for loading states.
 *
 * Uses a CSS shimmer animation (not just pulse) for a more polished,
 * modern loading experience. Composes easily into rows, cards, and tables.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded bg-content-border/60",
        "before:absolute before:inset-0",
        "before:-translate-x-full",
        "before:animate-[shimmer_1.5s_infinite]",
        "before:bg-gradient-to-r before:from-transparent before:via-content-surface/40 before:to-transparent",
        className
      )}
    />
  );
}

/** Skeleton text line — mimics a paragraph line. */
export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-4", i === lines - 1 && lines > 1 ? "w-3/4" : "w-full")}
        />
      ))}
    </div>
  );
}

/** Skeleton avatar — mimics a profile picture. */
export function SkeletonAvatar({ size = "md", className }: { size?: "sm" | "md" | "lg"; className?: string }) {
  const sizeMap = { sm: "h-8 w-8", md: "h-10 w-10", lg: "h-16 w-16" };
  return <Skeleton className={cn("rounded-full", sizeMap[size], className)} />;
}

/** Skeleton card — mimics a content card. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-card border border-content-border bg-content-bg p-4 space-y-3", className)}>
      <div className="flex items-center gap-3">
        <SkeletonAvatar size="sm" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-1/4" />
        </div>
      </div>
      <SkeletonText lines={2} />
    </div>
  );
}
