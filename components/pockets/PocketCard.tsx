import { useId, type CSSProperties } from "react";
import { Wallet, PiggyBank, TrendingUp } from "lucide-react";
import type { PocketType } from "@/lib/supabase/types";

const ICONS: Record<PocketType, typeof Wallet> = {
  spend: Wallet,
  savings: PiggyBank,
  investments: TrendingUp,
};

// Only two decorative hues app-wide: blue and teal. Spend and Investments
// are both blue (a mid tone vs. a near-black navy) so they read as a
// family, distinguished by lightness rather than hue; Savings is the one
// teal pocket. Dark enough on their own that white text over them holds
// good contrast without needing a dark scrim behind it.
const GRADIENTS: Record<PocketType, [string, string]> = {
  spend: ["#3b82f6", "#1d4ed8"],
  savings: ["#0d9488", "#115e59"],
  investments: ["#1e3a8a", "#0b1330"],
};

// Tinted glow behind each pocket, matching its own color rather than a
// generic gray shadow.
const GLOW: Record<PocketType, string> = {
  spend: "rgba(29,78,216,0.45)",
  savings: "rgba(17,94,89,0.45)",
  investments: "rgba(11,19,48,0.55)",
};

// Rounded pentagon "back pocket" silhouette: flat top, bulging sides,
// curved point at the bottom. viewBox is 100x118; the <svg> stretches to
// the card's real size via preserveAspectRatio="none".
const POCKET_PATH = "M8 2 H92 L100 74 Q76 118 50 118 Q24 118 0 74 Z";
const SEAM_PATH = "M18 22 Q50 34 82 22";

export function PocketCard({
  type,
  label,
  balance,
  pending,
  pendingLabel,
  currency = "₪",
}: {
  type: PocketType;
  label: string;
  balance: number;
  pending?: number;
  pendingLabel?: string;
  currency?: string;
}) {
  const Icon = ICONS[type];
  const gradientId = useId();
  const shineId = useId();
  const [from, to] = GRADIENTS[type];
  const available = pending ? balance - pending : balance;
  const glowStyle: CSSProperties = {
    filter: `drop-shadow(0 6px 14px ${GLOW[type]})`,
  };

  return (
    <div className="relative min-h-36 text-white" style={glowStyle}>
      <svg
        viewBox="0 0 100 118"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
        aria-hidden
      >
        <path
          d={POCKET_PATH}
          fill={`url(#${gradientId})`}
          stroke="rgba(250,246,238,0.4)"
          strokeWidth={2}
        />
        <path d={POCKET_PATH} fill={`url(#${shineId})`} opacity={0.5} />
        <path
          d={SEAM_PATH}
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={from} />
            <stop offset="1" stopColor={to} />
          </linearGradient>
          <radialGradient id={shineId} cx="30%" cy="12%" r="55%">
            <stop offset="0" stopColor="#ffffff" stopOpacity={0.55} />
            <stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </radialGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-end gap-1 px-2 pt-2 pb-4 text-center">
        <Icon className="h-6 w-6 opacity-95" aria-hidden />
        <span className="text-xs font-semibold opacity-90">{label}</span>
        <span className="text-lg font-bold tracking-tight tabular-nums">
          {currency}
          {available.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </span>
        {!!pending && (
          <span className="text-[0.65rem] opacity-80">
            {pendingLabel}: {currency}
            {pending.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </span>
        )}
      </div>
    </div>
  );
}
