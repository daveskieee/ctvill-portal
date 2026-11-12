/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { PRIMARY_LDM_LOGO } from '../utils/ldmAssets';
import { LdmCubeIcon } from './LdmLogo';

interface OptimizedLdmImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
  fetchPriority?: 'high' | 'low' | 'auto';
}

/**
 * High-performance image component with zero-lag lazy loading,
 * skeleton shimmer, content-visibility: auto, and graceful error fallback.
 */
export function OptimizedLdmImage({
  src,
  alt,
  className = '',
  fallbackIcon,
  fetchPriority,
  ...rest
}: OptimizedLdmImageProps) {
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  if (hasError || !src) {
    return (
      <div
        className={`bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 ${className}`}
        style={{ contentVisibility: 'auto' }}
      >
        {fallbackIcon || <LdmCubeIcon className="w-8 h-8 opacity-40" />}
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden bg-slate-950 ${className}`}
      style={{ contentVisibility: 'auto' }}
    >
      {/* Skeleton Shimmer */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-slate-900 animate-pulse flex items-center justify-center z-0">
          <LdmCubeIcon className="w-6 h-6 text-amber-500/20" />
        </div>
      )}

      <img
        src={src}
        alt={alt}
        loading={fetchPriority === 'high' ? 'eager' : 'lazy'}
        decoding="async"
        fetchPriority={fetchPriority}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`w-full h-full object-cover transition-opacity duration-500 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
        {...rest}
      />
    </div>
  );
}

interface LdmBrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'header';
  showText?: boolean;
  lightMode?: boolean;
}

/**
 * Official LDM Construction Brand Logo.
 * Renders the authentic `ldm logo.png` without squishing or cropping into a tiny square box,
 * falling back gracefully to the 3D isometric cube SVG mark.
 */
export function LdmBrandLogo({
  className = '',
  size = 'md',
  showText = false,
  lightMode = false,
}: LdmBrandLogoProps) {
  const [imgFailed, setImgFailed] = useState<boolean>(false);

  const imgHeight = {
    sm: 'h-7 max-w-[110px]',
    md: 'h-9 max-w-[140px]',
    header: 'h-9 max-w-[150px]',
    lg: 'h-10 max-w-[180px]',
  }[size];

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
    header: 'w-8 h-8',
    lg: 'w-9 h-9',
  }[size];

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {!imgFailed && PRIMARY_LDM_LOGO ? (
        <div className="bg-white rounded-lg p-1 shadow-sm border border-slate-200/80 flex items-center justify-center shrink-0">
          <img
            src={PRIMARY_LDM_LOGO}
            alt="LDM Construction"
            className={`${imgHeight} w-auto object-contain`}
            onError={() => setImgFailed(true)}
            decoding="async"
          />
        </div>
      ) : (
        <div className="w-9 h-9 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center shrink-0 shadow-sm">
          <LdmCubeIcon className={iconSizes} />
        </div>
      )}

      {showText && (
        <div className="shrink-0">
          <span
            className={`font-sans font-black text-sm sm:text-base tracking-tight block leading-tight ${
              lightMode ? 'text-slate-900' : 'text-white'
            }`}
          >
            LDM CONSTRUCTION
          </span>
          <span className="text-[9px] text-amber-500 font-mono tracking-widest block uppercase font-bold">
            ENGINEERS • ARCHITECTS • BUILDERS
          </span>
        </div>
      )}
    </div>
  );
}

