import { useCallback, useEffect, useRef } from "react";

/**
 * useRenderLoop
 *
 * Manages the high-performance requestAnimationFrame loop for WebGL rendering.
 * Implements 30 FPS frame throttling to optimize mobile thermal budget.
 *
 * @param callback The function to execute on every frame (33.33ms target).
 */
export const useRenderLoop = (callback: () => void) => {
  const requestRef = useRef<number>(0);
  const lastFrameTime = useRef<number>(0);

  const animate = useCallback(
    (time: number) => {
      const deltaTime = time - lastFrameTime.current;

      // Target 30 FPS (1000ms / 30 = 33.33ms)
      if (deltaTime >= 33.33) {
        callback();
        lastFrameTime.current = time;
      }

      requestRef.current = requestAnimationFrame(animate);
    },
    [callback],
  );

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);
};
