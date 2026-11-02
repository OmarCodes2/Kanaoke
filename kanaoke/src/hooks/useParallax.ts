import { useEffect, useRef, useCallback } from 'react';

/**
 * Configuration options for the parallax effect
 */
export interface UseParallaxOptions {
  /** Maximum parallax movement in pixels (default: 18px) */
  maxPx?: number;
  /** Lerp factor for smooth motion (0-1, lower = smoother, default: 0.1) */
  lerpFactor?: number;
  /** Scroll container ref to track scroll delta (optional) */
  scrollContainerRef?: React.RefObject<HTMLElement>;
  /** Scroll coupling strength (0-1, default: 0.3) */
  scrollCoupling?: number;
  /** Enable/disable parallax (default: true) */
  enabled?: boolean;
  /** Scale factor for image bleed (default: 1.05) */
  scale?: number;
}

/**
 * Reusable parallax hook for smooth, performance-friendly background image movement.
 * 
 * Features:
 * - Tracks pointer movement (mouse/trackpad) and scroll
 * - Uses requestAnimationFrame for batched updates
 * - Smooth easing via low-pass filter (lerp)
 * - Respects prefers-reduced-motion
 * - Disables on coarse pointer (touch) devices
 * - CSS transforms only (translate3d) for GPU acceleration
 * 
 * @param elementRef - Ref to the element that should receive parallax transform
 * @param options - Configuration options
 * @returns Object with current transform values (for debugging/monitoring)
 */
export function useParallax(
  elementRef: React.RefObject<HTMLElement>,
  options: UseParallaxOptions = {}
): { x: number; y: number } {
  const {
    maxPx = 18,
    lerpFactor = 0.1,
    scrollContainerRef,
    scrollCoupling = 0.3,
    enabled = true,
    scale = 1.05,
  } = options;

  // Current smoothed position (what's actually applied)
  const currentPosRef = useRef({ x: 0, y: 0 });
  // Target position (where we want to go)
  const targetPosRef = useRef({ x: 0, y: 0 });
  // Pointer-based offset (from mouse movement)
  const pointerOffsetRef = useRef({ x: 0, y: 0 });
  // Scroll offset accumulator
  const scrollOffsetRef = useRef({ x: 0, y: 0 });
  // Last scroll position for delta calculation
  const lastScrollTopRef = useRef(0);
  // Animation frame ID
  const rafIdRef = useRef<number | null>(null);
  // Check if reduced motion is preferred
  const prefersReducedMotionRef = useRef(
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  // Check if device has fine pointer (mouse/trackpad)
  const hasFinePointerRef = useRef(
    window.matchMedia('(pointer: fine)').matches
  );

  /**
   * Clamp a value between -max and +max
   */
  const clamp = useCallback(
    (value: number, max: number): number => {
      return Math.max(-max, Math.min(max, value));
    },
    []
  );

  /**
   * Linear interpolation (lerp) for smooth motion
   * Moves current toward target by lerpFactor amount
   */
  const lerp = useCallback(
    (current: number, target: number, factor: number): number => {
      return current + (target - current) * factor;
    },
    []
  );

  /**
   * Update the element's transform using translate3d and scale
   * Scale ensures enough bleed so edges never show when translated
   */
  const updateTransform = useCallback(() => {
    const element = elementRef.current;
    if (!element) return;

    const { x, y } = currentPosRef.current;
    const transform = `translate3d(${x}px, ${y}px, 0) scale(${scale})`;

    // Use translate3d for GPU acceleration and to avoid layout thrash
    // Include scale for image bleed (ensures edges never show)
    // Use !important to override any CSS animations/transitions on transform
    element.style.setProperty('transform', transform, 'important');
  }, [elementRef, scale]);

  /**
   * Animation loop: lerp current position toward target, then update transform
   * Also decays scroll offset toward zero when not actively scrolling
   */
  const animate = useCallback(() => {
    // Skip if element is not available yet
    if (!elementRef.current) {
      rafIdRef.current = null;
      return;
    }

    const { x: currentX, y: currentY } = currentPosRef.current;
    const { x: targetX, y: targetY } = targetPosRef.current;

    // Decay scroll offset toward zero (for smooth return when scrolling stops)
    scrollOffsetRef.current.y = lerp(scrollOffsetRef.current.y, 0, 0.05);
    scrollOffsetRef.current.x = lerp(scrollOffsetRef.current.x, 0, 0.05);

    // Update target position with decayed scroll offset
    const updatedTarget = {
      x: pointerOffsetRef.current.x + scrollOffsetRef.current.x,
      y: pointerOffsetRef.current.y + scrollOffsetRef.current.y,
    };
    updatedTarget.x = clamp(updatedTarget.x, maxPx);
    updatedTarget.y = clamp(updatedTarget.y, maxPx);
    targetPosRef.current = updatedTarget;

    // Lerp toward target for smooth easing
    const newX = lerp(currentX, targetX, lerpFactor);
    const newY = lerp(currentY, targetY, lerpFactor);

    // Update current position
    currentPosRef.current = { x: newX, y: newY };

    // Apply transform
    updateTransform();

    // Continue animation if we're not at the target (or close enough)
    const threshold = 0.01;
    if (
      Math.abs(newX - targetX) > threshold ||
      Math.abs(newY - targetY) > threshold ||
      Math.abs(scrollOffsetRef.current.y) > threshold ||
      Math.abs(scrollOffsetRef.current.x) > threshold
    ) {
      rafIdRef.current = requestAnimationFrame(animate);
    } else {
      rafIdRef.current = null;
    }
  }, [lerpFactor, lerp, updateTransform, maxPx, clamp, elementRef]);

  /**
   * Start animation loop if not already running
   */
  const startAnimation = useCallback(() => {
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(animate);
    }
  }, [animate]);

  /**
   * Handle mouse/trackpad movement
   * Calculates target offset based on pointer position relative to viewport center
   */
  const handlePointerMove = useCallback(
    (e: MouseEvent) => {
      // Skip if disabled, reduced motion, or no fine pointer
      if (
        !enabled ||
        prefersReducedMotionRef.current ||
        !hasFinePointerRef.current
      ) {
        return;
      }

      // Skip if element ref is not available yet
      if (!elementRef.current) return;

      // Calculate normalized position (-0.5 to 0.5) relative to viewport center
      const normalizedX = e.clientX / window.innerWidth - 0.5;
      const normalizedY = e.clientY / window.innerHeight - 0.5;

      // Calculate pointer-based offset: moving right -> positive X, moving up -> negative Y
      // Clamp to maxPx range
      pointerOffsetRef.current = {
        x: clamp(normalizedX * maxPx * 2, maxPx),
        y: clamp(normalizedY * maxPx * 2, maxPx),
      };

      // Combine pointer and scroll offsets
      targetPosRef.current = {
        x: pointerOffsetRef.current.x + scrollOffsetRef.current.x,
        y: pointerOffsetRef.current.y + scrollOffsetRef.current.y,
      };

      // Clamp final target to ensure we don't exceed maxPx in any direction
      targetPosRef.current.x = clamp(targetPosRef.current.x, maxPx);
      targetPosRef.current.y = clamp(targetPosRef.current.y, maxPx);

      startAnimation();
    },
    [enabled, maxPx, clamp, startAnimation, elementRef]
  );

  /**
   * Handle scroll on the song list container
   * Applies vertical offset proportional to scroll delta
   */
  const handleScroll = useCallback(() => {
    // Skip if disabled or reduced motion
    if (!enabled || prefersReducedMotionRef.current) {
      return;
    }

    const scrollContainer = scrollContainerRef?.current;
    if (!scrollContainer) return;

    const currentScrollTop = scrollContainer.scrollTop;
    const scrollDelta = currentScrollTop - lastScrollTopRef.current;
    lastScrollTopRef.current = currentScrollTop;

    // Calculate scroll-based offset (proportional to scroll delta, clamped)
    // Scrolling down -> positive Y offset, scrolling up -> negative Y offset
    const scrollYOffset = clamp(
      scrollDelta * scrollCoupling,
      maxPx * scrollCoupling
    );

    // Add scroll delta to scroll offset accumulator
    // The animation loop will decay this toward zero when scrolling stops
    scrollOffsetRef.current.y += scrollYOffset;

    // Clamp scroll offset to maxPx
    scrollOffsetRef.current.y = clamp(scrollOffsetRef.current.y, maxPx);

    // Update target position by combining current pointer offset with scroll offset
    // This preserves the pointer position while adding scroll movement
    targetPosRef.current = {
      x: pointerOffsetRef.current.x + scrollOffsetRef.current.x,
      y: pointerOffsetRef.current.y + scrollOffsetRef.current.y,
    };

    // Clamp final target to ensure we don't exceed maxPx in any direction
    targetPosRef.current.x = clamp(targetPosRef.current.x, maxPx);
    targetPosRef.current.y = clamp(targetPosRef.current.y, maxPx);

    startAnimation();
  }, [enabled, scrollContainerRef, scrollCoupling, maxPx, clamp, lerp, startAnimation]);

  // Set up event listeners
  useEffect(() => {

    // Check preferences on mount and when they change
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointerQuery = window.matchMedia('(pointer: fine)');

    const updatePreferences = () => {
      prefersReducedMotionRef.current = reducedMotionQuery.matches;
      hasFinePointerRef.current = pointerQuery.matches;

      // If reduced motion or no fine pointer, reset to center
      if (prefersReducedMotionRef.current || !hasFinePointerRef.current) {
        pointerOffsetRef.current = { x: 0, y: 0 };
        scrollOffsetRef.current = { x: 0, y: 0 };
        targetPosRef.current = { x: 0, y: 0 };
        startAnimation();
      }
    };

    // Initial preference check
    updatePreferences();

    // Listen for preference changes
    reducedMotionQuery.addEventListener('change', updatePreferences);
    pointerQuery.addEventListener('change', updatePreferences);

    // Set up mouse move listener (only if enabled and has fine pointer)
    // Note: element ref might be null initially, but will be available after render
    if (enabled && hasFinePointerRef.current && !prefersReducedMotionRef.current) {
      window.addEventListener('mousemove', handlePointerMove, { passive: true });
    }

    // Set up scroll listener on scroll container
    const scrollContainer = scrollContainerRef?.current;
    if (scrollContainer && enabled && !prefersReducedMotionRef.current) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    }

    // If element becomes available later, start animation
    // Use a small delay to check after render, and also check periodically
    let checkCount = 0;
    const maxChecks = 10; // Check for up to 1 second
    const checkElement = () => {
      checkCount++;
      if (elementRef.current && enabled && !prefersReducedMotionRef.current && hasFinePointerRef.current) {
        startAnimation();
      } else if (checkCount < maxChecks) {
        // Keep checking if element is not available yet
        setTimeout(checkElement, 100);
      }
    };
    const timeoutId = setTimeout(checkElement, 100);

    // Cleanup
    return () => {
      clearTimeout(timeoutId);
      reducedMotionQuery.removeEventListener('change', updatePreferences);
      pointerQuery.removeEventListener('change', updatePreferences);
      window.removeEventListener('mousemove', handlePointerMove);
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [enabled, handlePointerMove, handleScroll, scrollContainerRef, startAnimation]);

  // Reset position when element changes or parallax is disabled
  useEffect(() => {
    if (!enabled || prefersReducedMotionRef.current || !hasFinePointerRef.current) {
      pointerOffsetRef.current = { x: 0, y: 0 };
      scrollOffsetRef.current = { x: 0, y: 0 };
      targetPosRef.current = { x: 0, y: 0 };
      startAnimation();
    }
  }, [enabled, startAnimation]);

  // Return current position for debugging/monitoring
  return currentPosRef.current;
}

