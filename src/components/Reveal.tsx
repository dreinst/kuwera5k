"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const defaultVariants: Variants = {
  hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function Reveal({
  children,
  delay = 0,
  className,
  variants = defaultVariants,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  variants?: Variants;
}) {
  const mergedVariants: Variants = {
    hidden: variants.hidden,
    show: {
      ...(variants.show as object),
      transition: {
        ...((variants.show as { transition?: object })?.transition ?? {}),
        delay,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={mergedVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}
