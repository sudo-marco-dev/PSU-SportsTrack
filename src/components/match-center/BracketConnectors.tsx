import React from 'react';

interface BracketForkProps {
  height: number;
  topY: number;
  bottomY: number;
  centerY: number;
  width?: number;
}

export const BracketFork: React.FC<BracketForkProps> = ({
  height,
  topY,
  bottomY,
  centerY,
  width = 48
}) => {
  const midX = width / 2;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      fill="none"
      className="overflow-visible pointer-events-none select-none"
      aria-hidden="true"
    >
      {/* Top match horizontal feeder branch */}
      <path
        d={`M 0,${topY} L ${midX},${topY}`}
        stroke="rgba(255, 255, 255, 0.22)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Bottom match horizontal feeder branch */}
      <path
        d={`M 0,${bottomY} L ${midX},${bottomY}`}
        stroke="rgba(255, 255, 255, 0.22)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Vertical bridge uniting the two branches */}
      <path
        d={`M ${midX},${topY} L ${midX},${bottomY}`}
        stroke="rgba(255, 255, 255, 0.22)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Output feeder into the subsequent round match node */}
      <path
        d={`M ${midX},${centerY} L ${width},${centerY}`}
        stroke="rgba(255, 255, 255, 0.22)"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
};
