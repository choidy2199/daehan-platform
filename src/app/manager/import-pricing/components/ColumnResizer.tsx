"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  colId: string;
  currentWidth: number;
  onDrag: (colId: string, width: number) => void;
  onCommit: (colId: string, width: number) => void;
}

export function ColumnResizer({ colId, currentWidth, onDrag, onCommit }: Props) {
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      onDrag(colId, startWidthRef.current + delta);
    };

    const handleUp = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      const final = startWidthRef.current + delta;
      onCommit(colId, final);
      setDragging(false);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);

    // 드래그 중 텍스트 선택 방지
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [dragging, colId, onDrag, onCommit]);

  const handleDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startXRef.current = e.clientX;
    startWidthRef.current = currentWidth;
    setDragging(true);
  };

  return (
    <div
      onMouseDown={handleDown}
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 6,
        height: "100%",
        cursor: "col-resize",
        background: dragging ? "#185FA5" : "transparent",
        zIndex: 30,
      }}
      onMouseEnter={e => {
        if (!dragging) (e.currentTarget as HTMLDivElement).style.background = "rgba(24, 95, 165, 0.3)";
      }}
      onMouseLeave={e => {
        if (!dragging) (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    />
  );
}
