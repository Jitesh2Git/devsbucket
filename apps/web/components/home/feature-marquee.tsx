import {
  Bell,
  BellOff,
  Code,
  Copy,
  Crown,
  Download,
  Eye,
  FolderUp,
  Gauge,
  History,
  KeyRound,
  LayoutGrid,
  Link2,
  LogIn,
  type LucideIcon,
  Moon,
  Move,
  Search,
  Upload,
} from "lucide-react";

type Feature = { icon: LucideIcon; label: string };

const ROWS: Feature[][] = [
  [
    { icon: FolderUp, label: "Drag and drop folders" },
    { icon: Upload, label: "Big files upload in parts" },
    { icon: Download, label: "Download a folder as a ZIP" },
    { icon: Copy, label: "Make a copy" },
    { icon: Move, label: "Move and rename" },
    { icon: Link2, label: "Share links with expiry" },
    { icon: KeyRound, label: "Ask for access" },
    { icon: Crown, label: "Hand over ownership" },
    { icon: LayoutGrid, label: "Grid or table view" },
  ],
  [
    { icon: BellOff, label: "Mute a folder" },
    { icon: Bell, label: "Choose your notifications" },
    { icon: Eye, label: "Read-only for viewers" },
    { icon: Code, label: "Syntax colours for every language" },
    { icon: History, label: "Restore any version" },
    { icon: Moon, label: "Light and dark" },
    { icon: LogIn, label: "Sign in with GitHub" },
    { icon: Search, label: "Typo-tolerant search" },
    { icon: Gauge, label: "Storage meter and alerts" },
  ],
];

const Pill = ({ feature }: { feature: Feature }) => (
  <li className="flex shrink-0 items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm whitespace-nowrap">
    <feature.icon className="size-3.5 text-primary-text" aria-hidden />
    {feature.label}
  </li>
);

// Everything else the app does, as two rows of pills sliding sideways in
// opposite directions (each row twice, so the loop has no seam; the copy
// is hidden from screen readers). With "reduce motion" they stand still
// and wrap.
const FeatureMarquee = () => {
  return (
    <div className="home-marquee-mask flex flex-col gap-2.5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)] motion-reduce:[mask-image:none]">
      {ROWS.map((row, index) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: two fixed rows
          key={index}
          data-reverse={index === 1 || undefined}
          className="home-marquee flex w-max gap-2.5 motion-reduce:w-full"
        >
          <ul
            aria-label="More features"
            className="flex gap-2.5 motion-reduce:flex-wrap motion-reduce:justify-center"
          >
            {row.map((feature) => (
              <Pill key={feature.label} feature={feature} />
            ))}
          </ul>
          <ul aria-hidden className="flex gap-2.5 motion-reduce:hidden">
            {row.map((feature) => (
              <Pill key={feature.label} feature={feature} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

export default FeatureMarquee;
