"use client";

import { useRef } from "react";

// Lets a scroll container be dragged anywhere in its body to scroll — not just
// by the scrollbar. Real touchscreens scroll natively, so we skip pointerType
// "touch" and only drive it for mouse/pen (which is how many kiosk panels and
// desktops report input). A small move threshold distinguishes a drag from a
// tap, and clicks are cancelled after a drag so dragging never fires a button.
export function useDragScroll() {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startY: 0, startTop: 0, moved: false });

  return {
    ref,
    style: { cursor: "grab" as const },
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "touch") return;
      const el = ref.current;
      if (!el) return;
      drag.current = { active: true, startY: e.clientY, startTop: el.scrollTop, moved: false };
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // setPointerCapture can throw on some inputs; drag still works.
      }
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!drag.current.active) return;
      const el = ref.current;
      if (!el) return;
      const dy = e.clientY - drag.current.startY;
      if (Math.abs(dy) > 5) drag.current.moved = true;
      el.scrollTop = drag.current.startTop - dy;
    },
    onPointerUp: () => {
      drag.current.active = false;
    },
    onPointerCancel: () => {
      drag.current.active = false;
    },
    onClickCapture: (e: React.MouseEvent<HTMLDivElement>) => {
      // Swallow the click that ends a drag so we don't complete a chore etc.
      if (drag.current.moved) {
        e.preventDefault();
        e.stopPropagation();
        drag.current.moved = false;
      }
    },
  };
}
