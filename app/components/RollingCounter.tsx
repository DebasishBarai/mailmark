"use client";

import { useEffect, useRef, useState } from "react";

const DIGIT_HEIGHT = 1; // in em

function RollingDigit({
  digit,
  delay,
}: {
  digit: string;
  delay: number;
}) {
  const [animated, setAnimated] = useState(false);
  const numericDigit = parseInt(digit, 10);
  const isNumber = !isNaN(numericDigit);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!isNumber) {
    return (
      <span className="inline-block" style={{ width: "0.35em" }}>
        {digit}
      </span>
    );
  }

  return (
    <span
      className="relative inline-block overflow-hidden"
      style={{ height: `${DIGIT_HEIGHT}em`, width: "0.65em" }}
    >
      <span
        className="absolute left-0 flex flex-col items-center transition-transform duration-[1200ms]"
        style={{
          transform: animated
            ? `translateY(-${numericDigit * DIGIT_HEIGHT}em)`
            : `translateY(-${10 * DIGIT_HEIGHT}em)`,
          transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
          width: "100%",
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span
            key={n}
            className="flex items-center justify-center"
            style={{ height: `${DIGIT_HEIGHT}em` }}
          >
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

export default function RollingCounter({
  value,
  suffix = "",
  className = "",
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const formatted = value.toLocaleString();
  const chars = formatted.split("");

  return (
    <span ref={ref} className={`inline-flex items-baseline leading-none ${className}`}>
      {visible ? (
        <>
          {chars.map((char, i) => (
            <RollingDigit key={i} digit={char} delay={i * 80} />
          ))}
          {suffix && <span>{suffix}</span>}
        </>
      ) : (
        <span style={{ visibility: "hidden" }}>
          {formatted}
          {suffix}
        </span>
      )}
    </span>
  );
}
