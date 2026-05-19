'use client';

import { useRef, useCallback, useEffect } from 'react';

interface ResizableHeaderProps {
  columnKey: string;
  onResize: (px: number) => void;
  onAutoFit: () => void;
  minWidth: number;
  children: React.ReactNode;
  thProps?: React.ThHTMLAttributes<HTMLTableCellElement>;
}

export function ResizableHeader({
  onResize,
  onAutoFit,
  minWidth,
  children,
  thProps,
}: ResizableHeaderProps) {
  const thRef = useRef<HTMLTableCellElement>(null);
  const startXRef = useRef<number | null>(null);
  const startWidthRef = useRef<number>(0);
  const onResizeRef = useRef(onResize);
  const minWidthRef = useRef(minWidth);

  useEffect(() => { onResizeRef.current = onResize; }, [onResize]);
  useEffect(() => { minWidthRef.current = minWidth; }, [minWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (startXRef.current == null) return;
    const dx = e.clientX - startXRef.current;
    const next = Math.max(minWidthRef.current, startWidthRef.current + dx);
    onResizeRef.current(next);
  }, []);

  const handleMouseUp = useCallback(() => {
    startXRef.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, [handleMouseMove]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startXRef.current = e.clientX;
    startWidthRef.current = thRef.current?.getBoundingClientRect().width ?? 0;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [handleMouseMove, handleMouseUp]);

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onAutoFit();
  }, [onAutoFit]);

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  return (
    <th ref={thRef} {...thProps}>
      {children}
      <div
        className="al-resize-handle"
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        title="드래그: 너비 조절 / 더블클릭: 자동 맞춤"
      />
    </th>
  );
}
