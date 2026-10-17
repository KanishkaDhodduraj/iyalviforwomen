import {
  useRef,
  type DragEvent as ReactDragEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

export function useDragScroll() {
  const startX = useRef(0);
  const startScroll = useRef(0);
  const moved = useRef(false);
  const dragging = useRef(false);

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || event.button !== 0) return;
    startX.current = event.clientX;
    startScroll.current = event.currentTarget.scrollLeft;
    moved.current = false;
    dragging.current = false;
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType !== "mouse" || !(event.buttons & 1)) return;
    const distance = event.clientX - startX.current;
    if (!dragging.current && Math.abs(distance) > 5) {
      dragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (dragging.current) {
      event.preventDefault();
      event.currentTarget.scrollLeft = startScroll.current - distance;
      moved.current = true;
    }
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (dragging.current && event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragging.current = false;
    if (moved.current && typeof window !== "undefined")
      window.setTimeout(() => {
        moved.current = false;
      }, 0);
  };

  const onClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (!moved.current) return;
    event.preventDefault();
    event.stopPropagation();
    moved.current = false;
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onClickCapture,
    onDragStart: (event: ReactDragEvent<HTMLElement>) => event.preventDefault(),
  };
}
