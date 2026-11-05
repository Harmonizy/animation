import { evaluateScene } from '../core/evaluate';
import { ASPECT_RATIOS, fitAspect, isAspectRatioName, type AspectRatioName } from '../core/framing';
import type { Project, Scene } from '../core/schema';
import { Clock } from '../playback/clock';
import type { Renderer } from '../render/types';

export interface StudioOptions {
  readonly project: Project;
  readonly scene: Scene;
  readonly createRenderer: () => Renderer;
  /** Initial time and aspect ratio, for reproducible links and screenshots. */
  readonly params: URLSearchParams;
}

export interface Studio {
  /** Destroys and recreates the renderer. Used to verify resource cleanup. */
  remountRenderer(): Promise<void>;
  destroy(): void;
}

type Attributes = Record<string, string>;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Attributes = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  element.append(...children);
  return element;
}

function slider(id: string, label: string, min: number, max: number, step: number, value: number) {
  const input = el('input', {
    id,
    type: 'range',
    min: String(min),
    max: String(max),
    step: String(step),
    value: String(value),
  });
  const output = el('output', { for: id });
  const row = el('div', { class: 'slider-row' }, el('label', { for: id }, label), input, output);
  return { input, output, row };
}

const CAMERA_PAN_RANGE = 400;

export async function createStudio(root: HTMLElement, options: StudioOptions): Promise<Studio> {
  const { project, scene, params } = options;

  const initialAspect = params.get('aspect') ?? '';
  let aspect: AspectRatioName = isAspectRatioName(initialAspect) ? initialAspect : '16:9';
  let cameraOffset = { x: 0, y: 0 };
  let zoomFactor = 1;
  /** Root nodes from back to front. */
  const defaultOrder = scene.nodes
    .filter((node) => node.parent === undefined)
    .map((node, index) => ({ node, index }))
    .sort((a, b) => a.node.layer - b.node.layer || a.index - b.index)
    .map(({ node }) => node.id);
  let order = [...defaultOrder];
  let layerOverrides: Record<string, number> = {};

  const preview = el('div', { id: 'preview', 'aria-label': 'Animation preview', role: 'img' });
  const stage = el('main', { id: 'stage' }, preview);

  const playButton = el('button', { id: 'play', type: 'button', class: 'primary' }, 'Play');
  const restartButton = el('button', { id: 'restart', type: 'button' }, 'Restart');
  const seek = el('input', {
    id: 'seek',
    type: 'range',
    min: '0',
    max: String(scene.duration),
    step: String(1 / scene.fps),
    value: '0',
    'aria-label': 'Seek',
  });
  const readout = el('output', { id: 'readout', for: 'seek' });
  const transport = el(
    'section',
    { id: 'transport', 'aria-label': 'Transport' },
    playButton,
    restartButton,
    seek,
    readout,
  );

  const aspectButtons = (Object.keys(ASPECT_RATIOS) as AspectRatioName[]).map((name) =>
    el('button', { type: 'button', 'data-aspect': name }, name),
  );
  const panX = slider('camera-x', 'Pan X', -CAMERA_PAN_RANGE, CAMERA_PAN_RANGE, 10, 0);
  const panY = slider('camera-y', 'Pan Y', -CAMERA_PAN_RANGE, CAMERA_PAN_RANGE, 10, 0);
  const zoom = slider('camera-zoom', 'Zoom', 0.5, 2, 0.05, 1);
  const cameraReset = el('button', { id: 'camera-reset', type: 'button' }, 'Reset camera');
  const layerList = el('ol', { id: 'layers' });
  const layersReset = el('button', { id: 'layers-reset', type: 'button' }, 'Reset layers');

  const section = (title: string, ...children: Node[]) =>
    el('section', { class: 'panel-section' }, el('h2', {}, title), ...children);
  const panel = el(
    'aside',
    { id: 'panel' },
    section(
      'Aspect ratio',
      el(
        'div',
        { class: 'segmented', role: 'group', 'aria-label': 'Aspect ratio' },
        ...aspectButtons,
      ),
    ),
    section('Camera offset', panX.row, panY.row, zoom.row, cameraReset),
    section('Layers (top first)', layerList, layersReset),
  );
  const header = el(
    'header',
    { id: 'header' },
    el('h1', {}, 'Cinematic Animation Studio'),
    el(
      'span',
      { id: 'project-label' },
      project.kind === 'technical-demo' ? `Technical demo: ${project.name}` : project.name,
    ),
  );
  root.replaceChildren(header, stage, panel, transport);

  const clock = new Clock({ duration: scene.duration, onChange: () => draw() });
  let renderer = options.createRenderer();
  let renderCount = 0;

  function draw(): void {
    const time = clock.time;
    const frame = evaluateScene(scene, time, {
      cameraOffset,
      zoomFactor,
      layers: layerOverrides,
    });
    renderer.render(frame);
    renderCount += 1;

    playButton.textContent = clock.playing ? 'Pause' : 'Play';
    seek.value = String(time);
    const frameNumber = Math.round(time * scene.fps);
    readout.textContent = `${time.toFixed(2)} / ${scene.duration.toFixed(2)} s · frame ${frameNumber} · ${frame.shotId}`;
    preview.dataset['time'] = String(time);
    preview.dataset['renders'] = String(renderCount);
  }

  function applySize(): void {
    const size = fitAspect(
      { width: stage.clientWidth, height: stage.clientHeight },
      ASPECT_RATIOS[aspect],
    );
    preview.style.width = `${size.width}px`;
    preview.style.height = `${size.height}px`;
    renderer.resize(size);
    for (const button of aspectButtons) {
      button.setAttribute('aria-pressed', String(button.dataset['aspect'] === aspect));
    }
  }

  function updateCameraReadouts(): void {
    panX.output.textContent = String(cameraOffset.x);
    panY.output.textContent = String(cameraOffset.y);
    zoom.output.textContent = `×${zoomFactor.toFixed(2)}`;
  }

  function moveLayer(id: string, delta: number): void {
    const from = order.indexOf(id);
    const to = from + delta;
    const other = order[to];
    if (from < 0 || other === undefined) return;
    order[to] = id;
    order[from] = other;
    layerOverrides = Object.fromEntries(order.map((nodeId, index) => [nodeId, index]));
    renderLayerList();
    draw();
  }

  function renderLayerList(): void {
    const topFirst = order.toReversed();
    layerList.replaceChildren(
      ...topFirst.map((id, index) => {
        const up = el(
          'button',
          { type: 'button', 'data-move': 'up', 'aria-label': `Move ${id} up` },
          '↑',
        );
        const down = el(
          'button',
          { type: 'button', 'data-move': 'down', 'aria-label': `Move ${id} down` },
          '↓',
        );
        up.disabled = index === 0;
        down.disabled = index === topFirst.length - 1;
        up.addEventListener('click', () => moveLayer(id, 1));
        down.addEventListener('click', () => moveLayer(id, -1));
        return el('li', { 'data-layer': id }, el('span', {}, id), up, down);
      }),
    );
  }

  playButton.addEventListener('click', () => (clock.playing ? clock.pause() : clock.play()));
  restartButton.addEventListener('click', () => clock.restart());
  seek.addEventListener('input', () => clock.seek(Number(seek.value)));

  for (const button of aspectButtons) {
    button.addEventListener('click', () => {
      const name = button.dataset['aspect'] ?? '';
      if (!isAspectRatioName(name)) return;
      aspect = name;
      applySize();
      draw();
    });
  }

  const onCameraInput = () => {
    cameraOffset = { x: Number(panX.input.value), y: Number(panY.input.value) };
    zoomFactor = Number(zoom.input.value);
    updateCameraReadouts();
    draw();
  };
  for (const input of [panX.input, panY.input, zoom.input]) {
    input.addEventListener('input', onCameraInput);
  }
  cameraReset.addEventListener('click', () => {
    panX.input.value = '0';
    panY.input.value = '0';
    zoom.input.value = '1';
    onCameraInput();
  });
  layersReset.addEventListener('click', () => {
    order = [...defaultOrder];
    layerOverrides = {};
    renderLayerList();
    draw();
  });

  updateCameraReadouts();
  renderLayerList();

  try {
    await renderer.mount(preview);
  } catch (error) {
    clock.destroy();
    const message = error instanceof Error ? error.message : String(error);
    preview.replaceChildren(
      el('p', { id: 'render-error', role: 'alert' }, `The renderer could not start: ${message}`),
    );
    throw error;
  }

  const initialTime = Number(params.get('t'));
  if (params.has('t') && Number.isFinite(initialTime)) clock.seek(initialTime);

  const observer = new ResizeObserver(() => {
    applySize();
    draw();
  });
  observer.observe(stage);
  applySize();
  draw();
  preview.dataset['ready'] = 'true';

  return {
    async remountRenderer() {
      renderer.destroy();
      renderer = options.createRenderer();
      await renderer.mount(preview);
      applySize();
      draw();
    },
    destroy() {
      observer.disconnect();
      clock.destroy();
      renderer.destroy();
    },
  };
}
