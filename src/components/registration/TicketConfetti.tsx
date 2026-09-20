"use client";

import { useEffect } from "react";
import confetti from "canvas-confetti";

export default function TicketConfetti() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    confetti({ particleCount: 90, spread: 70, origin: { y: 0.3 }, colors: ["#FFBB00", "#F4E71D", "#64A322", "#FDFBF5"] });
  }, []);
  return null;
}
