import {
  evaluateFrame,
  posePosition,
  resolveHold,
  type DisplayMode,
  type EvaluationOverrides,
} from '../core/evaluate';
import { ASPECT_RATIOS, fitAspect, isAspectRatioName, type AspectRatioName } from '../core/framing';
import type { Project, Scene } from '../core/schema';
import {
  EXPOSURE_PRESETS,
  PROJECT_FPS,
  TRACK_GROUPS,
  frameCount,
  frameToTime,
  type ProjectFps,
  type TrackGroup,
} from '../core/timing';
import { Clock } from '../playback/clock';
import type { Renderer } from '../render/types';
import { el, panelSection, select } from './dom';
import { createTransport } from './transport';
import { createViewNav } from './viewNav';

export interface StudioOptions {
  readonly project: Project;
  readonly scene: Scene;
  readonly createRenderer: () => Renderer;
  /** Initial time or frame, aspect ratio, display and palette, for reproducible links. */
  readonly params: URLSearchParams;
  /** The current page, for the view selector. */
  readonly view: string;
  /** Named palettes to choose between. Without these the scene's own palette is used. */
  readonly palettes?: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** An extra panel section, such as a sheet of reusable parts. */
  readonly extraPanel?: { readonly title: string; readonly content: HTMLElement };
}

export interface Studio {
  /** Destroys and recreates the renderer. Used to verify resource cleanup. */
  remountRenderer(): Promise<void>;
  destroy(): void;
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

const DISPLAY_OPTIONS = [
  ['normal', 'Normal'],
  ['silhouette', 'Silhouette (black fill)'],
  ['grayscale', 'Grayscale (values)'],
] as const;

function isDisplayMode(value: string | null): value is DisplayMode {
  return DISPLAY_OPTIONS.some(([mode]) => mode === value);
}

const CAMERA_PAN_RANGE = 400;
const MAX_CUSTOM_HOLD = 120;
const FPS_OPTIONS = PROJECT_FPS.map((fps) => [String(fps), `${fps} fps`] as const);
const EXPOSURE_OPTIONS = [
  [String(EXPOSURE_PRESETS.ones), 'Ones'],
  [String(EXPOSURE_PRESETS.twos), 'Twos'],
  [String(EXPOSURE_PRESETS.threes), 'Threes'],
  [String(EXPOSURE_PRESETS.fours), 'Fours'],
  ['custom', 'Custom'],
] as const;

export async function createStudio(root: HTMLElement, options: StudioOptions): Promise<Studio> {
  const { project, scene, params } = options;

  const initialAspect = params.get('aspect') ?? '';
  let aspect: AspectRatioName = isAspectRatioName(initialAspect) ? initialAspect : '16:9';
  let cameraOffset = { x: 0, y: 0 };
  let zoomFactor = 1;
  let fps: ProjectFps = scene.fps;
  let exportFps: ProjectFps = scene.exportFps;
  let exposure: Partial<Record<TrackGroup, number>> = {};
  const initialDisplay = params.get('display');
  let display: DisplayMode = isDisplayMode(initialDisplay) ? initialDisplay : 'normal';
  const paletteNames = Object.keys(options.palettes ?? {});
  const initialPalette = params.get('palette') ?? '';
  let paletteName = paletteNames.includes(initialPalette) ? initialPalette : null;
  /** Root nodes from back to front. */
  const defaultOrder = scene.nodes
    .filter((node) => node.parent === undefined)
    .map((node, index) => ({ node, index }))
    .sort((a, b) => a.node.layer - b.node.layer || a.index - b.index)
    .map(({ node }) => node.id);
  let order = [...defaultOrder];
  let layerOverrides: Record<string, number> = {};

  const overrides = (): EvaluationOverrides => ({
    cameraOffset,
    zoomFactor,
    layers: layerOverrides,
    fps,
    exposure,
    display,
    ...(paletteName === null ? {} : { palette: options.palettes?.[paletteName] ?? {} }),
  });

  const preview = el('div', { id: 'preview', 'aria-label': 'Animation preview', role: 'img' });
  const stage = el('main', { id: 'stage' }, preview);

  const clock = new Clock({
    duration: scene.duration,
    fps: scene.fps,
    onChange: () => refresh(),
  });
  let shotLabel = '';
  const transport = createTransport(clock, () => shotLabel);

  const aspectButtons = (Object.keys(ASPECT_RATIOS) as AspectRatioName[]).map((name) =>
    el('button', { type: 'button', 'data-aspect': name }, name),
  );
  const panX = slider('camera-x', 'Pan X', -CAMERA_PAN_RANGE, CAMERA_PAN_RANGE, 10, 0);
  const panY = slider('camera-y', 'Pan Y', -CAMERA_PAN_RANGE, CAMERA_PAN_RANGE, 10, 0);
  const zoom = slider('camera-zoom', 'Zoom', 0.5, 2, 0.05, 1);
  const cameraReset = el('button', { id: 'camera-reset', type: 'button' }, 'Reset camera');
  const layerList = el('ol', { id: 'layers' });
  const layersReset = el('button', { id: 'layers-reset', type: 'button' }, 'Reset layers');

  const fpsSelect = select('project-fps', FPS_OPTIONS, String(fps), 'Project frame rate');
  const exportSelect = select('export-fps', FPS_OPTIONS, String(exportFps), 'Export frame rate');
  const exportCount = el('output', { id: 'export-count', for: 'export-fps' });
  const timingReset = el('button', { id: 'timing-reset', type: 'button' }, 'Reset timing');

  const exposureControls = TRACK_GROUPS.map((group) => {
    const hold = resolveHold(scene, group);
    const isPreset = Object.values<number>(EXPOSURE_PRESETS).includes(hold);
    const choice = select(
      `exposure-${group}`,
      EXPOSURE_OPTIONS,
      isPreset ? String(hold) : 'custom',
      `${group} exposure`,
    );
    const custom = el('input', {
      id: `hold-${group}`,
      type: 'number',
      min: '1',
      max: String(MAX_CUSTOM_HOLD),
      step: '1',
      value: String(hold),
      'aria-label': `${group} custom hold frames`,
    });
    custom.hidden = isPreset;
    const pose = el('output', { id: `pose-${group}`, for: `exposure-${group}` });
    const row = el(
      'div',
      { class: 'exposure-row' },
      el('label', { for: `exposure-${group}` }, group),
      choice,
      custom,
      pose,
    );

    const apply = () => {
      custom.hidden = choice.value !== 'custom';
      const raw = choice.value === 'custom' ? custom.valueAsNumber : Number(choice.value);
      if (!Number.isInteger(raw) || raw < 1 || raw > MAX_CUSTOM_HOLD) {
        custom.setAttribute('aria-invalid', 'true');
        return;
      }
      custom.removeAttribute('aria-invalid');
      exposure = { ...exposure, [group]: raw };
      refresh(true);
    };
    choice.addEventListener('change', apply);
    custom.addEventListener('input', apply);

    const reset = () => {
      choice.value = isPreset ? String(hold) : 'custom';
      custom.value = String(hold);
      custom.hidden = isPreset;
      custom.removeAttribute('aria-invalid');
    };
    return { group, pose, reset, row };
  });

  const displaySelect = select('display', DISPLAY_OPTIONS, display, 'Display mode');
  const paletteSelect = select(
    'palette',
    [['', 'Scene palette'], ...paletteNames.map((name) => [name, name] as const)],
    paletteName ?? '',
    'Palette',
  );

  const panel = el(
    'aside',
    { id: 'panel' },
    panelSection(
      'Aspect ratio',
      el(
        'div',
        { class: 'segmented', role: 'group', 'aria-label': 'Aspect ratio' },
        ...aspectButtons,
      ),
    ),
    panelSection(
      'Look',
      el('div', { class: 'field-row' }, el('label', { for: 'display' }, 'Display'), displaySelect),
      ...(paletteNames.length > 0
        ? [
            el(
              'div',
              { class: 'field-row' },
              el('label', { for: 'palette' }, 'Palette'),
              paletteSelect,
            ),
          ]
        : []),
    ),
    panelSection(
      'Timing',
      el('div', { class: 'field-row' }, el('label', { for: 'project-fps' }, 'Project'), fpsSelect),
      el(
        'div',
        { class: 'field-row' },
        el('label', { for: 'export-fps' }, 'Export'),
        exportSelect,
        exportCount,
      ),
      el('h3', {}, 'Exposure'),
      ...exposureControls.map((control) => control.row),
      timingReset,
    ),
    panelSection('Camera offset', panX.row, panY.row, zoom.row, cameraReset),
    panelSection('Layers (top first)', layerList, layersReset),
    ...(options.extraPanel
      ? [panelSection(options.extraPanel.title, options.extraPanel.content)]
      : []),
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
    createViewNav(options.view),
  );
  root.replaceChildren(header, stage, panel, transport.element);

  let renderer = options.createRenderer();
  let mounted = false;
  let renderCount = 0;
  let drawnFrame = -1;

  /**
   * Updates the readouts, and draws only when the picture can differ. A fast display calls this
   * many times per project frame, so its refresh rate never adds renders.
   */
  function refresh(pictureChanged = false): void {
    const frame = clock.frame;
    if (!mounted) return;
    if (pictureChanged || frame !== drawnFrame) {
      const state = evaluateFrame(scene, frame, overrides());
      renderer.render(state);
      renderCount += 1;
      drawnFrame = frame;
      shotLabel = state.shotId;
    }
    transport.update();

    for (const { group, pose } of exposureControls) {
      pose.textContent = `pose ${posePosition(scene, group, frame, overrides())}`;
    }
    exportCount.textContent = `${frameCount(scene.duration, exportFps)} frames`;
    preview.dataset['frame'] = String(frame);
    preview.dataset['fps'] = String(clock.fps);
    preview.dataset['time'] = String(frameToTime(frame, clock.fps));
    preview.dataset['playhead'] = String(clock.time);
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
    refresh(true);
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

  for (const button of aspectButtons) {
    button.addEventListener('click', () => {
      const name = button.dataset['aspect'] ?? '';
      if (!isAspectRatioName(name)) return;
      aspect = name;
      applySize();
      refresh(true);
    });
  }

  fpsSelect.addEventListener('change', () => {
    fps = Number(fpsSelect.value) as ProjectFps;
    clock.fps = fps;
    refresh(true);
  });
  exportSelect.addEventListener('change', () => {
    exportFps = Number(exportSelect.value) as ProjectFps;
    refresh();
  });
  displaySelect.addEventListener('change', () => {
    display = isDisplayMode(displaySelect.value) ? displaySelect.value : 'normal';
    refresh(true);
  });
  paletteSelect.addEventListener('change', () => {
    paletteName = paletteSelect.value === '' ? null : paletteSelect.value;
    refresh(true);
  });
  timingReset.addEventListener('click', () => {
    fps = scene.fps;
    exportFps = scene.exportFps;
    exposure = {};
    fpsSelect.value = String(fps);
    exportSelect.value = String(exportFps);
    for (const control of exposureControls) control.reset();
    clock.fps = fps;
    refresh(true);
  });

  const onCameraInput = () => {
    cameraOffset = { x: Number(panX.input.value), y: Number(panY.input.value) };
    zoomFactor = Number(zoom.input.value);
    updateCameraReadouts();
    refresh(true);
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
    refresh(true);
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
  mounted = true;

  const initialTime = Number(params.get('t'));
  const initialFrame = Number(params.get('frame'));
  if (params.has('frame') && Number.isFinite(initialFrame)) clock.seekFrame(initialFrame);
  else if (params.has('t') && Number.isFinite(initialTime)) clock.seek(initialTime);

  const observer = new ResizeObserver(() => {
    applySize();
    refresh(true);
  });
  observer.observe(stage);
  applySize();
  refresh(true);
  preview.dataset['ready'] = 'true';

  return {
    async remountRenderer() {
      renderer.destroy();
      renderer = options.createRenderer();
      await renderer.mount(preview);
      applySize();
      refresh(true);
    },
    destroy() {
      observer.disconnect();
      clock.destroy();
      renderer.destroy();
    },
  };
}
