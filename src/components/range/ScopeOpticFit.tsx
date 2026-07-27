"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

type ScopeOpticFitProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Keeps scope glass at design size ({@code SCOPE_VIEWPORT_REF_PX}); when the
 * slot is narrower, scales the whole optic row uniformly so mil FOV stays
 * identical to admin / hunt / range.
 */
export function ScopeOpticFit({ children, className }: ScopeOpticFitProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerH, setInnerH] = useState(0);

  useEffect(() => {
    const slot = slotRef.current;
    const inner = innerRef.current;
    if (!slot || !inner) return;

    const measure = () => {
      const need = inner.offsetWidth;
      const avail = slot.clientWidth;
      const next =
        need > 0 && avail > 0 ? Math.min(1, avail / need) : 1;
      setScale(next);
      setInnerH(inner.offsetHeight);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(slot);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={slotRef}
      className={
        className ? `scope-optic-fit ${className}` : "scope-optic-fit"
      }
      style={
        innerH > 0 && scale < 1
          ? { height: innerH * scale }
          : undefined
      }
    >
      <div
        ref={innerRef}
        className="scope-optic-fit-inner"
        style={{
          transform: scale < 0.999 ? `scale(${scale})` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}
