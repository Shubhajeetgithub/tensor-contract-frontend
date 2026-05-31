'use client';

import React, { useEffect, useRef } from 'react';
import katex from 'katex';

interface KaTeXProps {
  math: string;
  block?: boolean;
  className?: string;
}

export default function KaTeX({ math, block = false, className = '' }: KaTeXProps) {
  const containerRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      try {
        katex.render(math, containerRef.current, {
          displayMode: block,
          throwOnError: false,
          strict: 'ignore',
        });
      } catch (err) {
        console.error('KaTeX rendering error:', err);
        containerRef.current.textContent = math;
      }
    }
  }, [math, block]);

  return <span ref={containerRef} className={className} />;
}
