import { PawPrint } from "lucide-react";

interface BarkLogoProps {
  compact?: boolean;
  inverse?: boolean;
}

export function BarkLogo({ compact = false, inverse = false }: BarkLogoProps) {
  return (
    <div className="flex items-center gap-3">
      {compact ? (
        <span
          role="img"
          aria-label="Bark by Supertails"
          className={`grid size-10 shrink-0 place-items-center rounded-[var(--radius-md)] ${
            inverse ? "bg-white/14 text-white" : "bg-brand-soft text-brand"
          }`}
          aria-hidden="true"
        >
          <PawPrint size={21} strokeWidth={2.2} />
        </span>
      ) : (
        <span className="relative block h-16 w-[140px] shrink-0 overflow-hidden">
          <img
            src="/brand/bark-by-supertails.png"
            alt="Bark by Supertails"
            className={`absolute left-1/2 top-1/2 w-[154px] max-w-none -translate-x-1/2 -translate-y-1/2 ${inverse ? "brightness-0 invert" : ""}`}
          />
        </span>
      )}
    </div>
  );
}
