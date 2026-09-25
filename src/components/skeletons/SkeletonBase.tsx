import React from 'react';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  variant?: 'rectangular' | 'rounded' | 'circular';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  variant = 'rounded',
  style,
  ...props
}) => {
  const variantClass = 
    variant === 'circular'
      ? 'rounded-full'
      : variant === 'rectangular'
      ? 'rounded-none'
      : 'rounded-xl';

  return (
    <div
      className={`skeleton-shimmer animate-pulse bg-slate-800/70 border border-slate-700/40 dark:bg-slate-800/70 dark:border-slate-700/40 ${variantClass} ${className}`}
      style={style}
      aria-hidden="true"
      {...props}
    />
  );
};

export default Skeleton;
