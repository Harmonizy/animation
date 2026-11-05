export const EASING_NAMES = ['linear', 'easeIn', 'easeOut', 'easeInOut', 'step'] as const;
export type EasingName = (typeof EASING_NAMES)[number];

/** Each easing maps normalized progress in [0, 1] to eased progress, with f(0)=0. */
const EASINGS: Record<EasingName, (u: number) => number> = {
  linear: (u) => u,
  easeIn: (u) => u * u * u,
  easeOut: (u) => 1 - (1 - u) ** 3,
  easeInOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2),
  // Holds the current value until the next keyframe is reached.
  step: (u) => (u < 1 ? 0 : 1),
};

export function applyEasing(name: EasingName, progress: number): number {
  return EASINGS[name](Math.min(1, Math.max(0, progress)));
}
