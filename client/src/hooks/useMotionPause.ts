import { useEffect } from 'react';
import { gsap } from 'gsap';

/**
 * Stops GSAP while the phone is backgrounded or the player pauses.
 * Sleeping the ticker avoids a catch-up jump and idle frame work.
 */
export function useMotionPause(paused: boolean): void {
  useEffect(() => {
    if (!paused) {
      gsap.ticker.wake();
      gsap.globalTimeline.resume();
      return;
    }
    gsap.globalTimeline.pause();
    gsap.ticker.sleep();
    return () => {
      gsap.ticker.wake();
      gsap.globalTimeline.resume();
    };
  }, [paused]);
}
