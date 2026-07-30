import { cn } from "@/lib/utils";

export interface Pattern {
  id: string;
  label: string;
}

export interface PatternNavProps {
  patterns: Pattern[];
  current: string;
  onSelect: (id: string) => void;
}

export function PatternNav({ patterns, current, onSelect }: PatternNavProps) {
  return (
    <aside className="bg-zinc-950 w-56 p-4 flex flex-col gap-1 flex-shrink-0 hidden md:flex">
      <div className="flex items-center gap-2.5 mb-4 px-1">
        <div className="w-6 h-6 rounded-full bg-green-400 flex items-center justify-center">
          <span className="text-zinc-950 text-xs font-medium">C</span>
        </div>
        <span className="text-sm font-medium text-zinc-50 tracking-tight">Craft</span>
      </div>
      <nav className="flex flex-col gap-0.5">
        {patterns.map((pattern) => (
          <button
            key={pattern.id}
            onClick={() => onSelect(pattern.id)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors",
              current === pattern.id
                ? "bg-zinc-900 text-zinc-50"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
            )}
          >
            <span className="text-sm font-light">{pattern.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
