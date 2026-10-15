import { cn } from "@/lib/utils";

const LEAF = "M0 86C-22 54-18 18 0 0c18 18 22 54 0 86Z";
const VEIN = "M0 74C-1 46 0 20 0 8";
const INNER = "M0 66C-11 42-9 20 0 10c9 10 11 32 0 56Z";

const FILLS = ["#f3c4c2", "#e8b4a0", "#d9899a", "#c45d7c", "#9a3d58", "#6b2d42"] as const;

function Leaf({
  fill,
  x,
  y,
  rotate,
  scale = 1,
}: {
  fill: string;
  x: number;
  y: number;
  rotate: number;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate} 0 43) scale(${scale})`}>
      <path d={LEAF} fill={fill} />
      <path d={INNER} fill="#fff7f4" opacity="0.38" />
      <path d={VEIN} stroke="#5c1a2e" strokeWidth="1.15" strokeLinecap="round" opacity="0.28" />
    </g>
  );
}

function Bud({ cx, cy, fill = "#6b2d42" }: { cx: number; cy: number; fill?: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r="7" fill={fill} />
      <circle cx={cx} cy={cy - 1} r="2.4" fill="#f8e4df" />
    </g>
  );
}

export function FloralSprig({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 160 260" fill="none" className={cn("text-[#c45d7c]", className)}>
      <path d="M82 248C90 190 78 140 70 92c-6-36 8-70 22-98" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <Leaf fill="#e8b4a0" x={78} y={168} rotate={-58} scale={0.72} />
      <Leaf fill="#f3c4c2" x={86} y={132} rotate={42} scale={0.78} />
      <Leaf fill="#c45d7c" x={64} y={108} rotate={-36} scale={0.62} />
      <Leaf fill="#9a3d58" x={92} y={78} rotate={28} scale={0.7} />
      <Leaf fill="#e8b4a0" x={70} y={52} rotate={-18} scale={0.55} />
      <Leaf fill="#6b2d42" x={84} y={28} rotate={8} scale={0.48} />
      <Bud cx={96} cy={18} />
    </svg>
  );
}

export function FloralBranch({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 300 380" fill="none" className={cn(className)}>
      <path
        d="M36 360c42-78 48-150 28-214 18-48 62-92 118-124"
        stroke="#c45d7c"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M78 250c-8-36 6-62 28-78"
        stroke="#e8b4a0"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <Leaf fill="#e8b4a0" x={70} y={268} rotate={-72} scale={1.05} />
      <Leaf fill="#f3c4c2" x={118} y={228} rotate={38} scale={1.15} />
      <Leaf fill="#c45d7c" x={92} y={196} rotate={-28} scale={0.82} />
      <Leaf fill="#9a3d58" x={156} y={168} rotate={52} scale={0.95} />
      <Leaf fill="#e8b4a0" x={128} y={132} rotate={-18} scale={0.78} />
      <Leaf fill="#d9899a" x={176} y={108} rotate={24} scale={0.88} />
      <Leaf fill="#6b2d42" x={148} y={78} rotate={-8} scale={0.62} />
      <Leaf fill="#f3c4c2" x={198} y={58} rotate={16} scale={0.7} />
      <Leaf fill="#c45d7c" x={214} y={36} rotate={-40} scale={0.5} />
      <Bud cx={228} cy={22} fill="#5c1a2e" />
    </svg>
  );
}

export function FloralCorner({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 240 190" fill="none" className={cn(className)}>
      <path d="M8 168c48-16 86-18 128-4 32 10 62 6 92-22" stroke="#e8b4a0" strokeWidth="1.5" strokeLinecap="round" />
      <Leaf fill="#e8b4a0" x={48} y={132} rotate={-40} scale={0.85} />
      <Leaf fill="#f3c4c2" x={96} y={118} rotate={18} scale={0.95} />
      <Leaf fill="#c45d7c" x={142} y={108} rotate={-12} scale={0.72} />
      <Leaf fill="#9a3d58" x={58} y={86} rotate={-70} scale={0.58} />
      <Leaf fill="#d9899a" x={176} y={92} rotate={36} scale={0.66} />
      <Bud cx={198} cy={78} />
    </svg>
  );
}

export function FloralCluster({ className }: { className?: string }) {
  const leaves = [
    { fill: FILLS[1], x: 118, y: 36, rotate: -8, scale: 0.9 },
    { fill: FILLS[3], x: 168, y: 58, rotate: 32, scale: 0.82 },
    { fill: FILLS[0], x: 196, y: 108, rotate: 70, scale: 0.78 },
    { fill: FILLS[4], x: 188, y: 162, rotate: 110, scale: 0.86 },
    { fill: FILLS[2], x: 146, y: 198, rotate: 150, scale: 0.74 },
    { fill: FILLS[5], x: 92, y: 188, rotate: 190, scale: 0.7 },
    { fill: FILLS[1], x: 48, y: 150, rotate: 230, scale: 0.84 },
    { fill: FILLS[0], x: 36, y: 96, rotate: 270, scale: 0.76 },
    { fill: FILLS[3], x: 62, y: 48, rotate: 310, scale: 0.8 },
  ];

  return (
    <svg aria-hidden="true" viewBox="0 0 240 240" fill="none" className={cn(className)}>
      <circle cx="120" cy="120" r="86" fill="#f8e4df" opacity="0.55" />
      {leaves.map((leaf) => (
        <Leaf key={`${leaf.x}-${leaf.y}-${leaf.rotate}`} {...leaf} />
      ))}
      <Bud cx={168} cy={42} />
      <Bud cx={206} cy={132} fill="#9a3d58" />
      <Bud cx={78} cy={196} fill="#c45d7c" />
    </svg>
  );
}

export function FloralWreath({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 360 360" fill="none" className={cn(className)}>
      <Leaf fill="#e8b4a0" x={180} y={18} rotate={0} scale={0.7} />
      <Leaf fill="#f3c4c2" x={248} y={42} rotate={32} scale={0.78} />
      <Leaf fill="#c45d7c" x={304} y={96} rotate={68} scale={0.66} />
      <Leaf fill="#9a3d58" x={324} y={168} rotate={100} scale={0.74} />
      <Leaf fill="#e8b4a0" x={300} y={236} rotate={140} scale={0.7} />
      <Leaf fill="#d9899a" x={246} y={286} rotate={168} scale={0.62} />
      <Leaf fill="#6b2d42" x={176} y={312} rotate={200} scale={0.58} />
      <Leaf fill="#f3c4c2" x={104} y={292} rotate={228} scale={0.72} />
      <Leaf fill="#c45d7c" x={52} y={236} rotate={260} scale={0.68} />
      <Leaf fill="#e8b4a0" x={28} y={164} rotate={292} scale={0.76} />
      <Leaf fill="#9a3d58" x={46} y={92} rotate={324} scale={0.64} />
      <Leaf fill="#f3c4c2" x={104} y={40} rotate={348} scale={0.7} />
      <Bud cx={286} cy={58} />
      <Bud cx={332} cy={196} fill="#5c1a2e" />
      <Bud cx={64} cy={78} fill="#c45d7c" />
    </svg>
  );
}
