import React, { useState, useEffect } from 'react';

interface DelayedLoaderProps {
  delayMs?: number;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const DelayedLoader: React.FC<DelayedLoaderProps> = ({
  delayMs = 180,
  children,
  fallback = null,
}) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs]);

  if (!show) return <>{fallback}</>;
  return <>{children}</>;
};
