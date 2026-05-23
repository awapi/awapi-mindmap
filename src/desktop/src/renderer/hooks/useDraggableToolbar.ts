import { useCallback, useEffect, useRef, useState } from 'react';

interface Point {
  x: number;
  y: number;
}

interface DragState {
  pointerId: number;
  startClient: Point;
  startOffset: Point;
}

export function useDraggableToolbar(resetKey: string) {
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const dragRef = useRef<DragState | null>(null);

  useEffect(() => {
    setOffset({ x: 0, y: 0 });
  }, [resetKey]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      event.preventDefault();
      setOffset({
        x: drag.startOffset.x + event.clientX - drag.startClient.x,
        y: drag.startOffset.y + event.clientY - drag.startClient.y,
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragRef.current = null;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, []);

  const onDragPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      dragRef.current = {
        pointerId: event.pointerId,
        startClient: { x: event.clientX, y: event.clientY },
        startOffset: offset,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [offset],
  );

  return {
    offset,
    dragHandleProps: {
      onPointerDown: onDragPointerDown,
    },
  };
}
