import { evaluateFrame } from '../core/evaluate';
import type { Scene } from '../core/schema';
import type { Renderer } from '../render/types';

/**
 * A bare page that draws one frame on request, with no studio interface, at exactly the window
 * size. The export script sizes the window to 1080 x 1920 and asks for each frame in turn.
 */

declare global {
  interface Window {
    __episode?: {
      readonly frames: number;
      render(frame: number): Promise<number>;
    };
  }
}

export async function mountEpisodeRender(
  root: HTMLElement,
  scene: Scene,
  createRenderer: () => Renderer,
): Promise<void> {
  document.body.style.margin = '0';
  document.body.style.background = '#000';
  root.replaceChildren();
  const renderer = createRenderer();
  await renderer.mount(root);
  renderer.resize({ width: window.innerWidth, height: window.innerHeight });
  const frames = Math.round(scene.duration * scene.fps);
  window.__episode = {
    frames,
    async render(frame: number) {
      renderer.render(evaluateFrame(scene, frame));
      // Wait for the browser to present the frame before it is captured.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      return frame;
    },
  };
  root.dataset['ready'] = 'true';
}
