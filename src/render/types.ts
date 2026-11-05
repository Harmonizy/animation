import type { FrameState } from '../core/evaluate';
import type { Size } from '../core/framing';

/** What the studio needs from any renderer. No implementation types cross this boundary. */
export interface Renderer {
  /** Creates the drawing surface inside `host`. Rejects if the renderer is unavailable. */
  mount(host: HTMLElement): Promise<void>;
  /** Sets the output size in CSS pixels. */
  resize(size: Size): void;
  /** Draws one frame immediately. */
  render(frame: FrameState): void;
  /** Releases all resources and removes the drawing surface. */
  destroy(): void;
}
