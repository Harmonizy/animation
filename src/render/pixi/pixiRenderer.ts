import { Application, Container, Graphics, Matrix } from 'pixi.js';
import type { FrameState } from '../../core/evaluate';
import { viewTransform, type Size } from '../../core/framing';
import type { Mat2D } from '../../core/matrix';
import type { Shape } from '../../core/schema';
import type { Renderer } from '../types';

/** Keeps previews sharp on dense screens without paying for every physical pixel. */
const MAX_RESOLUTION = 2;

interface DrawnNode {
  readonly graphics: Graphics;
  shape: Shape;
}

function drawShape(graphics: Graphics, shape: Shape): void {
  graphics.clear();
  switch (shape.kind) {
    case 'group':
      break;
    case 'rect':
      graphics
        .rect(-shape.width / 2, -shape.height / 2, shape.width, shape.height)
        .fill(shape.fill);
      break;
    case 'ellipse':
      graphics.ellipse(0, 0, shape.radiusX, shape.radiusY).fill(shape.fill);
      break;
    case 'polygon':
      graphics.poly(shape.points.flatMap((point) => [point.x, point.y])).fill(shape.fill);
      break;
  }
}

export class PixiRenderer implements Renderer {
  private readonly app = new Application();
  private readonly world = new Container({ sortableChildren: true });
  private readonly drawn = new Map<string, DrawnNode>();
  private readonly scratch = new Matrix();
  private size: Size = { width: 1, height: 1 };
  private mounted = false;

  async mount(host: HTMLElement): Promise<void> {
    await this.app.init({
      width: this.size.width,
      height: this.size.height,
      autoStart: false,
      sharedTicker: false,
      preference: 'webgl',
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, MAX_RESOLUTION),
    });
    this.mounted = true;
    this.app.stage.addChild(this.world);
    host.append(this.app.canvas);
  }

  resize(size: Size): void {
    this.size = size;
    if (this.mounted) this.app.renderer.resize(size.width, size.height);
  }

  render(frame: FrameState): void {
    if (!this.mounted) return;
    this.app.renderer.background.color = frame.background;
    this.applyMatrix(this.world, viewTransform(frame.camera, frame.safeArea, this.size));

    frame.nodes.forEach((node, drawIndex) => {
      let entry = this.drawn.get(node.id);
      if (!entry) {
        entry = { graphics: new Graphics(), shape: node.shape };
        drawShape(entry.graphics, node.shape);
        this.world.addChild(entry.graphics);
        this.drawn.set(node.id, entry);
      } else if (entry.shape !== node.shape) {
        entry.shape = node.shape;
        drawShape(entry.graphics, node.shape);
      }
      this.applyMatrix(entry.graphics, node.worldMatrix);
      entry.graphics.alpha = node.worldOpacity;
      entry.graphics.zIndex = drawIndex;
    });

    this.app.render();
  }

  destroy(): void {
    if (!this.mounted) return;
    this.mounted = false;
    this.drawn.clear();
    this.app.destroy({ removeView: true }, { children: true });
  }

  private applyMatrix(target: Container, m: Mat2D): void {
    target.setFromMatrix(this.scratch.set(m[0], m[1], m[2], m[3], m[4], m[5]));
  }
}
