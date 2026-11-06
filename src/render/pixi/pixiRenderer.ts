import { Application, Container, FillGradient, Graphics, Matrix, Text } from 'pixi.js';
import type { EvaluatedNode, FrameState, GradientStop } from '../../core/evaluate';
import { viewTransform, type Size } from '../../core/framing';
import type { Mat2D } from '../../core/matrix';
import type { Shape } from '../../core/schema';
import { parseSvgPath } from '../../core/svgPath';
import type { Renderer } from '../types';

/** Keeps previews sharp on dense screens without paying for every physical pixel. */
const MAX_RESOLUTION = 2;

/** The studio typeface. Loaded by the page before anything with text is drawn. */
export const STUDIO_FONT = '"Noto Sans Thai", "Noto Sans", sans-serif';
/** For text set only in Latin script. */
export const LATIN_FONT = '"Noto Sans", "Noto Sans Thai", sans-serif';

/** Text is rasterised at this multiple, so it stays sharp when a camera move scales it up. */
const TEXT_RESOLUTION = 2;

interface DrawnNode {
  readonly display: Graphics | Text;
  shape: Shape;
  /** Everything that decides how the node looks, so it is only redrawn when that changes. */
  key: string;
}

const alphaHex = (opacity: number) =>
  Math.round(Math.min(1, Math.max(0, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');

function gradientFill(
  type: 'vertical' | 'horizontal' | 'radial',
  stops: readonly GradientStop[],
): FillGradient {
  const colorStops = stops.map((stop) => ({
    offset: stop.offset,
    color: `${stop.color}${alphaHex(stop.opacity)}`,
  }));
  if (type === 'radial') {
    return new FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.5 },
      innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 },
      outerRadius: 0.5,
      colorStops,
      textureSpace: 'local',
    });
  }
  return new FillGradient({
    type: 'linear',
    start: { x: 0, y: 0 },
    end: type === 'vertical' ? { x: 0, y: 1 } : { x: 1, y: 0 },
    colorStops,
    textureSpace: 'local',
  });
}

function createDisplay(node: EvaluatedNode): Graphics | Text {
  return node.shape.kind === 'text'
    ? new Text({ text: '', resolution: TEXT_RESOLUTION })
    : new Graphics();
}

function drawText(text: Text, shape: Extract<Shape, { kind: 'text' }>, fill: string | null): void {
  text.text = shape.content;
  text.style = {
    fontFamily: shape.font === 'latin' ? LATIN_FONT : STUDIO_FONT,
    fontSize: shape.fontSize,
    fontWeight: String(shape.fontWeight) as '400',
    fill: fill ?? '#000000',
    align: shape.align,
    lineHeight: shape.fontSize * shape.lineHeight,
    letterSpacing: shape.letterSpacing,
    padding: Math.ceil(shape.fontSize * 0.3),
  };
  text.anchor.set(shape.align === 'left' ? 0 : shape.align === 'right' ? 1 : 0.5, 0.5);
}

function drawNode(display: Graphics | Text, node: EvaluatedNode): void {
  if (display instanceof Text) {
    if (node.shape.kind === 'text') drawText(display, node.shape, node.fill);
    return;
  }
  if (node.shape.kind === 'gradient') {
    display.clear();
    const { width, height } = node.shape;
    const fill = gradientFill(node.shape.type, node.gradient ?? []);
    if (node.shape.type === 'radial') display.ellipse(0, 0, width / 2, height / 2).fill(fill);
    else display.rect(-width / 2, -height / 2, width, height).fill(fill);
    return;
  }
  drawShape(display, node.shape, node.fill);
}

const lookKey = (node: EvaluatedNode) =>
  node.gradient ? `${node.fill}|${JSON.stringify(node.gradient)}` : String(node.fill);

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
    case 'text':
    case 'gradient':
      // Drawn by drawNode, which needs more than one fill color.
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
      const key = lookKey(node);
      if (!entry) {
        entry = { display: createDisplay(node), shape: node.shape, key };
        drawNode(entry.display, node);
        this.world.addChild(entry.display);
        this.drawn.set(node.id, entry);
      } else if (entry.shape !== node.shape || entry.key !== key) {
        entry.shape = node.shape;
        entry.key = key;
        drawNode(entry.display, node);
      }
      this.applyMatrix(entry.display, node.worldMatrix);
      entry.display.alpha = node.worldOpacity;
      // Fully transparent nodes are skipped, which keeps scenes with many hidden shots fast.
      entry.display.visible = node.worldOpacity > 0;
      entry.display.zIndex = drawIndex;
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
      entry.display.destroy();
      this.drawn.delete(id);
    }
  }

  private applyMatrix(target: Container, m: Mat2D): void {
    target.setFromMatrix(this.scratch.set(m[0], m[1], m[2], m[3], m[4], m[5]));
  }
}
