const pins = [
  { left: "15%", top: "22%", tone: "bg-amber-300" },
  { left: "72%", top: "18%", tone: "bg-emerald-300" },
  { left: "83%", top: "58%", tone: "bg-cyan-300" },
  { left: "28%", top: "68%", tone: "bg-rose-300" },
  { left: "54%", top: "78%", tone: "bg-amber-300" },
];

const routeLines = [
  "M60 190 C180 140 255 205 385 150 S610 112 760 178",
  "M95 390 C220 340 320 410 460 354 S670 318 820 372",
  "M140 95 L265 95 L265 220 L432 220 L432 315 L710 315",
];

export default function CivicSenseBackdrop({ children, className = "" }) {
  return (
    <div className={`relative min-h-screen overflow-hidden bg-[#0d1117] text-zinc-100 ${className}`}>
      <style>
        {`
          @keyframes civic-scan {
            0% { transform: translateX(-24%); opacity: 0; }
            20% { opacity: 0.35; }
            70% { opacity: 0.18; }
            100% { transform: translateX(124%); opacity: 0; }
          }

          @media (prefers-reduced-motion: reduce) {
            .civic-scan-line {
              animation: none !important;
              opacity: 0.08 !important;
            }
          }
        `}
      </style>

      <div aria-hidden="true" className="absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_18%,rgba(16,185,129,0.12),transparent_24%),radial-gradient(circle_at_78%_12%,rgba(34,211,238,0.1),transparent_22%),linear-gradient(180deg,#0d1117_0%,#101214_52%,#0b0f12_100%)]" />
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.18)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute inset-0 opacity-[0.08] [background-image:linear-gradient(30deg,transparent_0_47%,rgba(255,255,255,0.16)_48%_52%,transparent_53%_100%)] [background-size:180px_120px]" />

        <svg
          className="absolute left-1/2 top-8 h-[620px] w-[980px] -translate-x-1/2 text-cyan-200/25"
          viewBox="0 0 900 520"
          fill="none"
        >
          {routeLines.map((line) => (
            <path
              key={line}
              d={line}
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeDasharray="8 14"
            />
          ))}
          <path
            d="M710 74 L782 74 L782 160 L850 160"
            stroke="rgba(251,191,36,0.38)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M120 250 L220 250 L220 302 L340 302 L340 442"
            stroke="rgba(16,185,129,0.34)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>

        <div className="absolute left-[8%] top-[30%] h-40 w-40 rounded-full border border-emerald-300/15 bg-emerald-300/5" />
        <div className="absolute right-[10%] top-[18%] h-56 w-56 rounded-full border border-cyan-300/15 bg-cyan-300/5" />
        <div className="absolute bottom-[8%] left-[42%] h-48 w-48 rounded-full border border-amber-300/15 bg-amber-300/5" />

        {pins.map((pin) => (
          <span
            key={`${pin.left}-${pin.top}`}
            className="absolute flex h-5 w-5 items-center justify-center"
            style={{ left: pin.left, top: pin.top }}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${pin.tone}`} />
            <span className="absolute h-5 w-5 rounded-full border border-white/20" />
          </span>
        ))}

        <div className="civic-scan-line absolute top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-cyan-200/10 to-transparent blur-sm [animation:civic-scan_10s_ease-in-out_infinite]" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#0d1117] to-transparent" />
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
