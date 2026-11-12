/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface LdmLogoProps {
  className?: string;
}

/**
 * Geometric 3D isometric cube mark for LDM Construction (Engineers • Architects • Builders).
 */
export function LdmCubeIcon({ className = 'w-7 h-7' }: LdmLogoProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="LDM Construction Isometric Cube Logo"
    >
      {/* Top Face */}
      <polygon
        points="32,6 56,19 32,32 8,19"
        fill="#f59e0b"
        stroke="#0f172a"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Left Face */}
      <polygon
        points="8,19 32,32 32,58 8,45"
        fill="#b45309"
        stroke="#0f172a"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Right Face */}
      <polygon
        points="56,19 32,32 32,58 56,45"
        fill="#fbbf24"
        stroke="#0f172a"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      {/* Inner Isometric Architectural Cutout */}
      <polyline
        points="20,25.5 32,19 44,25.5"
        stroke="#0f172a"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
      <line
        x1="32"
        y1="32"
        x2="32"
        y2="46"
        stroke="#0f172a"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

