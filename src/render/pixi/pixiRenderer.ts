import { Application, Container, Graphics, Matrix } from 'pixi.js';
import type { FrameState } from '../../core/evaluate';
import { viewTransform, type Size } from '../../core/framing';
import type { Mat2D } from '../../core/matrix';
import type { Shape } from '../../core/schema';
import { parseSvgPath } from '../../core/svgPath';
import type { Renderer } from '../types';

/** Keeps previews sharp on dense screens without paying for every physical pixel. */
const MAX_RESOLUTION = 2;

interface DrawnNode {
  readonly graphics: Graphics;
  shape: Shape;
  fill: string | null;
}

function tracePath(graphics: Graphics, d: string): void {
  for (const command of parseSvgPath(d)) {
    switch (command.type) {
      case 'move':
        graphics.moveTo(command.x, command.y);
        break;
      case 'line':
        graphics.lineTo(command.x, command.y);
        break;
      case 'cubic':
        graphics.bezierCurveTo(
          command.x1,
          command.y1,
          command.x2,
          command.y2,
          command.x,
          command.y,
        );
        break;
      case 'quadratic':
        graphics.quadraticCurveTo(command.x1, command.y1, command.x, command.y);
        break;
      case 'close':
        graphics.closePath();
        break;
    }
  }
}

function drawShape(graphics: Graphics, shape: Shape, fill: string | null): void {
  graphics.clear();
  if (fill === null) return;
  switch (shape.kind) {
    case 'group':
      break;
    case 'rect':
      graphics.rect(-shape.width / 2, -shape.height / 2, shape.width, shape.height).fill(fill);
      break;
    case 'ellipse':
      graphics.ellipse(0, 0, shape.radiusX, shape.radiusY).fill(fill);
      break;
    case 'polygon':
      graphics.poly(shape.points.flatMap((point) => [point.x, point.y])).fill(fill);
      break;
    case 'path':
      tracePath(graphics, shape.d);
      graphics.fill(fill);
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
        entry = { graphics: new Graphics(), shape: node.shape, fill: node.fill };
        drawShape(entry.graphics, node.shape, node.fill);
        this.world.addChild(entry.graphics);
        this.drawn.set(node.id, entry);
      } else if (entry.shape !== node.shape || entry.fill !== node.fill) {
        entry.shape = node.shape;
        entry.fill = node.fill;
        drawShape(entry.graphics, node.shape, node.fill);
      }
      this.applyMatrix(entry.graphics, node.worldMatrix);
      entry.graphics.alpha = node.worldOpacity;
      entry.graphics.zIndex = drawIndex;
    });

    if (this.drawn.size > frame.nodes.length) this.removeNodesMissingFrom(frame);
    this.app.render();
  }

  destroy(): void {
    if (!this.mounted) return;
    this.mounted = false;
    this.drawn.clear();
    this.app.destroy({ removeView: true }, { children: true });
  }

  private removeNodesMissingFrom(frame: FrameState): void {
    const present = new Set(frame.nodes.map((node) => node.id));
    for (const [id, entry] of this.drawn) {
      if (present.has(id)) continue;
      entry.graphics.destroy();
      this.drawn.delete(id);
    }
  }

  private applyMatrix(target: Container, m: Mat2D): void {
    target.setFromMatrix(this.scratch.set(m[0], m[1], m[2], m[3], m[4], m[5]));
  }
}
