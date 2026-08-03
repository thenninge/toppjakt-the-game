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
 * Fits {@link children} to the slot width with uniform scale (mil FOV stays
 * true). Layout box matches the *visual* size so the stage stays centered on
 * narrow screens instead of overflowing off to one side.
 */
export function ScopeOpticFit({ children, className }: ScopeOpticFitProps) {
  const slotRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [natural, setNatural] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const slot = slotRef.current;
    const inner = innerRef.current;
    if (!slot || !inner) return;

    const measure = () => {
      // offset* = pre-transform layout size (transform does not affect it).
      const needW = inner.offsetWidth;
      const needH = inner.offsetHeight;
      const avail = slot.clientWidth;
      const next =
        needW > 0 && avail > 0 ? Math.min(1, avail / needW) : 1;
      setNatural({ w: needW, h: needH });
      setScale(next);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(slot);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  const scaled = scale < 0.999;
  const boxW = scaled && natural.w > 0 ? natural.w * scale : undefined;
  const boxH = scaled && natural.h > 0 ? natural.h * scale : undefined;

  return (
    <div
      ref={slotRef}
      className={
        className ? `scope-optic-fit ${className}` : "scope-optic-fit"
      }
    >
      <div
        className="scope-optic-fit-scale"
        style={
          boxW != null && boxH != null
            ? { width: boxW, height: boxH }
            : undefined
        }
      >
        <div
          ref={innerRef}
          className="scope-optic-fit-inner"
          style={{
            transform: scaled ? `scale(${scale})` : undefined,
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
