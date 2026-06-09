import { useCallback, useEffect, useRef } from "react";

/**
 * Optional rAF loop for animations (e.g. error glow pulse).
 * Pose-driven overlays should call `requestRender` directly instead.
 *
 * @param enabled When false, no rAF is scheduled.
 */
export const useRenderLoop = (callback: () => void, enabled = true) => {
  const requestRef = useRef<number>(0);
  const lastFrameTime = useRef<number>(0);

  const animate = useCallback(
    (time: number) => {
      const deltaTime = time - lastFrameTime.current;

      // Target 30 FPS for glow pulse — thermal budget
      if (deltaTime >= 33.33) {
        callback();
        lastFrameTime.current = time;
      }

      requestRef.current = requestAnimationFrame(animate);
    },
    [callback],
  );

  useEffect(() => {
    if (!enabled) return;
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate, enabled]);
};
