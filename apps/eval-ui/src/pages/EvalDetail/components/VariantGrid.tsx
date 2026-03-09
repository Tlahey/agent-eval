import { useRef, useState, useEffect } from "react";
import type { VariantStats } from "../useEvalDetail";
import { ScoreRing } from "../../../components/ScoreRing";
import { Clock, Bot, Zap, Plus, Minus } from "lucide-react";

interface Props {
  stats: VariantStats[];
  compareA: string;
  compareB: string;
  onCompare: (variant: string) => void;
}

export function VariantGrid({ stats, compareA, compareB, onCompare }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Responsive items per page logic
  const getItemsPerPage = () => {
    if (typeof window === "undefined") return 3;
    return window.innerWidth >= 768 ? 3 : 1;
  };

  const [itemsPerPage, setItemsPerPage] = useState(getItemsPerPage());

  useEffect(() => {
    const handleResize = () => setItemsPerPage(getItemsPerPage());
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Update active bullet based on scroll position
  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, clientWidth } = scrollRef.current;

    // Calculate index based on how many full pages (clientWidth) we've scrolled
    const index = Math.round(scrollLeft / clientWidth);
    setActiveIndex(index);
  };

  const scrollTo = (index: number) => {
    if (!scrollRef.current) return;
    const { clientWidth } = scrollRef.current;
    scrollRef.current.scrollTo({
      left: index * clientWidth,
      behavior: "smooth",
    });
  };

  const pageCount = Math.ceil(stats.length / itemsPerPage);

  return (
    <div className="space-y-6">
      {/* Horizontal Scroll Container */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory no-scrollbar"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {stats.map((v) => {
          const isSelected = v.variantName === compareA || v.variantName === compareB;
          const isA = v.variantName === compareA;

          return (
            <div
              key={v.variantName}
              className={`flex-shrink-0 w-[calc(100%-2rem)] md:w-[calc(33.333%-1rem)] snap-center glass-card p-5 transition-all duration-300 relative overflow-hidden group shadow-none ${
                isSelected
                  ? "ring-2 ring-primary border-primary/50 bg-primary/5"
                  : "hover:border-primary/20"
              }`}
            >
              {isSelected && (
                <div className="absolute top-0 right-0 px-3 py-1 bg-primary text-txt-onprimary text-[10px] font-black uppercase tracking-widest rounded-bl-xl z-10">
                  Variant {isA ? "A" : "B"}
                </div>
              )}

              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-txt-base tracking-tight truncate max-w-[150px]">
                    {v.variantName}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-bold text-txt-muted uppercase tracking-wider">
                      {v.runner}
                    </span>
                  </div>
                </div>
                <ScoreRing value={v.avgScore} size={44} strokeWidth={4} />
              </div>

              <div className="grid grid-cols-3 gap-2 mb-6 border-y border/30 py-4">
                <MetricItem
                  label="Speed"
                  val={`${(v.avgDurationMs / 1000).toFixed(1)}s`}
                  icon={<Clock size={10} />}
                />
                <MetricItem
                  label="Usage"
                  val={formatTokens(v.avgTokens)}
                  icon={<Bot size={10} />}
                />
                <MetricItem
                  label="Success"
                  val={`${(v.passRate * 100).toFixed(0)}%`}
                  icon={<Zap size={10} />}
                  color="text-ok"
                />
              </div>

              <button
                onClick={() => onCompare(v.variantName)}
                className={`w-full py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                  isSelected
                    ? "bg-err text-white"
                    : "bg-surface-2 text-txt-muted hover:bg-primary hover:text-white border border-line/20 shadow-none"
                }`}
              >
                {isSelected ? <Minus size={12} /> : <Plus size={12} />}
                {isSelected ? "Deselect" : "Select"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Pagination Bullets */}
      {pageCount > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pageCount }).map((_, i) => (
            <button
              key={i}
              onClick={() => scrollTo(i)}
              className={`h-1.5 transition-all duration-300 rounded-full border border-primary/10 ${
                activeIndex === i
                  ? "w-8 bg-primary shadow-lg shadow-primary/20"
                  : "w-1.5 bg-line/40 hover:bg-line/60"
              }`}
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MetricItem({
  label,
  val,
  icon,
  color = "text-primary",
}: {
  label: string;
  val: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[7px] font-black text-txt-muted uppercase tracking-widest">
        {label}
      </span>
      <div className={`flex items-center gap-1 text-[10px] font-black text-txt-base ${color}`}>
        <span className="opacity-50">{icon}</span>
        {val}
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(0);
}
