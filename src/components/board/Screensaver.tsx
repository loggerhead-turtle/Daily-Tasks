"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock } from "./bits";

// Idle mode: the board becomes a family photo frame with a clock.
// Any touch wakes it back up (handled by the parent shell).
export function Screensaver({ photos }: { photos: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (photos.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % photos.length), 12_000);
    return () => clearInterval(id);
  }, [photos.length]);

  return (
    <div className="fixed inset-0 z-40 bg-slate-950">
      <AnimatePresence>
        {photos.length > 0 && (
          <motion.img
            key={photos[index % photos.length]}
            src={photos[index % photos.length]}
            alt=""
            draggable={false}
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: 1, scale: 1.06 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 1.5 }, scale: { duration: 13, ease: "linear" } }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
      </AnimatePresence>
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <div className="absolute bottom-10 left-10 text-white [&_*]:!text-white [&_.text-slate-400]:!text-white/70 [&_.text-slate-500]:!text-white/70">
        <Clock big />
      </div>
      {photos.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <span className="animate-float text-7xl">🌙</span>
          <p className="font-display text-2xl font-bold text-white/60">Touch anywhere to wake up</p>
        </div>
      )}
    </div>
  );
}
