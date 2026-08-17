type LogoProps = {
  className?: string;
  withWordmark?: boolean;
};

/**
 * Pocket silhouette with a rising coin — reads as "money that grows",
 * without leaning on childish iconography.
 */
export function Logo({ className, withWordmark = false }: LogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className ?? ""}`}>
      <svg
        viewBox="0 0 48 48"
        width="32"
        height="32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="My Pockets"
      >
        <path
          d="M8 14C8 10.6863 10.6863 8 14 8H34C37.3137 8 40 10.6863 40 14V32C40 36.4183 36.4183 40 32 40H16C11.5817 40 8 36.4183 8 32V14Z"
          fill="url(#pm-pocket)"
        />
        <path
          d="M8 16H40"
          stroke="white"
          strokeOpacity="0.35"
          strokeWidth="1.5"
        />
        <circle cx="24" cy="26" r="8" fill="#14B8A6" />
        <path
          d="M24 21.5V30.5M21.3 28.4C21.3 29.7 22.5 30.5 24 30.5C25.5 30.5 26.7 29.7 26.7 28.5C26.7 27 25.2 26.6 24 26.3C22.8 26 21.3 25.6 21.3 24.1C21.3 22.9 22.5 22.1 24 22.1C25.3 22.1 26.4 22.7 26.7 23.7"
          stroke="#0F3E3A"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        <path
          d="M17 30L14 41M31 30L34 41"
          stroke="url(#pm-pocket)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <defs>
          <linearGradient
            id="pm-pocket"
            x1="8"
            y1="8"
            x2="40"
            y2="40"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#3B82F6" />
            <stop offset="1" stopColor="#1D4ED8" />
          </linearGradient>
        </defs>
      </svg>
      {withWordmark && (
        <span className="hidden whitespace-nowrap text-lg font-semibold tracking-tight text-foreground xs:inline-block">
          My Pockets
        </span>
      )}
    </span>
  );
}
