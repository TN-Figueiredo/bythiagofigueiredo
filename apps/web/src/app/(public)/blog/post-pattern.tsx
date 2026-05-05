export type PatternName = 'dots' | 'grid' | 'diag' | 'stripe' | 'blur';

interface PostPatternProps {
  pattern: PatternName;
  dark: boolean;
}

export function PostPattern({ pattern, dark }: PostPatternProps) {
  if (pattern === 'blur') return null;

  const color = dark ? '#F2EBDB' : '#1A1410';
  const patternId = `p${pattern}`;

  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="none"
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 block h-full w-full"
      style={{ opacity: 0.15 }}
    >
      <defs>{renderPattern(pattern, patternId, color)}</defs>
      <rect width="400" height="300" fill={`url(#${patternId})`} />
    </svg>
  );
}

function renderPattern(pattern: PatternName, id: string, color: string) {
  switch (pattern) {
    case 'dots':
      return (
        <pattern
          id={id}
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="10" cy="10" r="2" fill={color} />
        </pattern>
      );
    case 'grid':
      return (
        <pattern
          id={id}
          width="30"
          height="30"
          patternUnits="userSpaceOnUse"
        >
          <line
            x1="0"
            y1="15"
            x2="30"
            y2="15"
            stroke={color}
            strokeWidth="0.5"
          />
          <line
            x1="15"
            y1="0"
            x2="15"
            y2="30"
            stroke={color}
            strokeWidth="0.5"
          />
        </pattern>
      );
    case 'diag':
      return (
        <pattern
          id={id}
          width="16"
          height="16"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="16" stroke={color} strokeWidth="1" />
        </pattern>
      );
    case 'stripe':
      return (
        <pattern
          id={id}
          width="30"
          height="30"
          patternUnits="userSpaceOnUse"
        >
          <rect x="0" y="0" width="12" height="30" fill={color} />
        </pattern>
      );
  }
}
