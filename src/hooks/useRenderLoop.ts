import { useCallback, useEffect, useRef } from "react";

/**
 * useRenderLoop
 *
 * Manages the high-performance requestAnimationFrame loop for WebGL rendering.
 * Provides a clean interface to start/stop the loop based on component lifecycle.
 *
 * @param callback The function to execute on every frame (33ms target).
 */
export const useRenderLoop = (callback: () => void) => {
  const requestRef = useRef<number>(0);

  const animate = useCallback(() => {
    callback();
    requestRef.current = requestAnimationFrame(animate);
  }, [callback]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, [animate]);
};
