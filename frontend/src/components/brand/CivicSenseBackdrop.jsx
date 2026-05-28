const pins = [
  { left: "13%", top: "24%", tone: "bg-amber-300" },
  { left: "76%", top: "20%", tone: "bg-emerald-300" },
  { left: "24%", top: "72%", tone: "bg-rose-300" },
  { left: "64%", top: "78%", tone: "bg-cyan-300" },
];

const routeLines = [
  "M60 190 C180 140 255 205 385 150 S610 112 760 178",
  "M95 390 C220 340 320 410 460 354 S670 318 820 372",
  "M140 95 L265 95 L265 220 L432 220 L432 315 L710 315",
];

export default function CivicSenseBackdrop({ children, className = "" }) {
  return (
    <div className={`relative min-h-screen overflow-hidden overflow-x-hidden bg-[#0d1117] text-zinc-100 ${className}`}>
      <style>
        {`
          @keyframes civic-scan {
            0% { transform: translateX(-24%); opacity: 0; }
            20% { opacity: 0.16; }
            70% { opacity: 0.08; }
            100% { transform: translateX(124%); opacity: 0; }
          }

          @media (prefers-reduced-motion: reduce) {
            .civic-scan-line {
              animation: none !important;
              opacity: 0.06 !important;
            }
          }
        `}
      </style>

      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0d1117_0%,#101214_52%,#0b0f12_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_24%_18%,rgba(16,185,129,0.075),transparent_30%),radial-gradient(circle_at_80%_12%,rgba(34,211,238,0.055),transparent_28%)]" />
        <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(rgba(255,255,255,0.16)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.16)_1px,transparent_1px)] [background-size:52px_52px]" />
        <div className="absolute inset-0 opacity-[0.014] [background-image:linear-gradient(30deg,transparent_0_48%,rgba(255,255,255,0.16)_49%_51%,transparent_52%_100%)] [background-size:260px_180px]" />

        <svg
          className="absolute left-1/2 top-8 h-[620px] w-[980px] max-w-none -translate-x-1/2 text-cyan-200/[0.13]"
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
            stroke="rgba(251,191,36,0.22)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M120 250 L220 250 L220 302 L340 302 L340 442"
            stroke="rgba(16,185,129,0.22)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>

        {pins.map((pin) => (
          <span
            key={`${pin.left}-${pin.top}`}
            className="absolute flex h-5 w-5 items-center justify-center opacity-70"
            style={{ left: pin.left, top: pin.top }}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${pin.tone}`} />
            <span className="absolute h-5 w-5 rounded-full border border-white/[0.18]" />
          </span>
        ))}

        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-[#0d1117]/80 to-transparent" />
        <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-[#0b0f12]/88 via-[#0b0f12]/42 to-transparent" />
        <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-[#0d1117]/68 to-transparent" />
        <div className="civic-scan-line absolute top-0 h-full w-1/3 bg-gradient-to-r from-transparent via-cyan-200/[0.03] to-transparent blur-sm [animation:civic-scan_16s_ease-in-out_infinite]" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-[#0d1117] to-transparent" />
      </div>

      <div className="relative z-10">{children}</div>
    </div>
  );
}
