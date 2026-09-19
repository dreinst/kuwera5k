"use client";

import { useEffect, useState } from "react";
import { animate } from "framer-motion";

export default function Counter({ to, duration = 1.5 }: { to: number; duration?: number }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const controls = animate(0, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [to, duration]);

  return <>{value.toLocaleString("id-ID")}</>;
}
