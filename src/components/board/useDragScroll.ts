"use client";

import { useRef } from "react";

// Lets a scroll container be dragged anywhere in its body to scroll — not just
// by the scrollbar. Real touchscreens scroll natively, so we skip pointerType
// "touch" and only drive it for mouse/pen (which is how many kiosk panels and
// desktops report input). A small move threshold distinguishes a drag from a
// tap, and clicks are cancelled after a drag so dragging never fires a button.
export function useDragScroll(axis: "x" | "y" = "y") {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, start: 0, startScroll: 0, moved: false });
  const client = (e: React.PointerEvent<HTMLDivElement>) => (axis === "x" ? e.clientX : e.clientY);

  return {
    ref,
    style: { cursor: "grab" as const },
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === "touch") return;
      const el = ref.current;
      if (!el) return;
      // Note: do NOT capture the pointer here — capturing on pointer-down
      // retargets the pointer-up to this container, which stops clicks on
      // buttons inside from firing (e.g. "Claim"). We only capture once an
      // actual drag begins (past the threshold, in onPointerMove).
      drag.current = {
        active: true,
        start: client(e),
        startScroll: axis === "x" ? el.scrollLeft : el.scrollTop,
        moved: false,
      };
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (!drag.current.active) return;
      const el = ref.current;
      if (!el) return;
      const delta = client(e) - drag.current.start;
      if (!drag.current.moved && Math.abs(delta) > 5) {
        drag.current.moved = true;
        try {
          el.setPointerCapture(e.pointerId); // now it's a real drag — capture it
        } catch {
          // ignore; scrolling still works while the pointer stays over the list
        }
      }
      if (drag.current.moved) {
        if (axis === "x") el.scrollLeft = drag.current.startScroll - delta;
        else el.scrollTop = drag.current.startScroll - delta;
      }
    },
    onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => {
      drag.current.active = false;
      try {
        ref.current?.releasePointerCapture(e.pointerId);
      } catch {
        // no capture was taken
      }
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
