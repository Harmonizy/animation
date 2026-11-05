import { fitAspect } from '../../core/framing';
import { PROJECT_FPS, type ProjectFps } from '../../core/timing';
import { Clock } from '../../playback/clock';
import type { Renderer } from '../../render/types';
import { el, panelSection, select } from '../../studio/dom';
import { createTransport } from '../../studio/transport';
import {
  LAB_DURATION,
  LAB_TABS,
  createLabScene,
  isLabTab,
  laneState,
  lanesForTab,
  posesPerSecond,
  type LabScene,
  type LabTab,
} from './model';

export interface TimingLabOptions {
  readonly createRenderer: () => Renderer;
  /** Initial tab and time, for reproducible links and screenshots. */
  readonly params: URLSearchParams;
}

const TAB_TEXT: Record<LabTab, { title: string; note: string }> = {
  fps: {
    title: 'FPS',
    note: 'Same motion and duration. Only the number of frames per second changes.',
  },
  exposure: {
    title: 'Exposure',
    note: 'Same frame rate. A longer hold shows fewer poses per second over the same distance.',
  },
  spacing: {
    title: 'Spacing',
    note: 'Same timing: every lane takes 2 s. Ticks mark each pose, so their gaps show the spacing.',
  },
  timing: {
    title: 'Timing',
    note: 'Same distance and even spacing. Fewer frames to cross the rail reads as faster.',
  },
};

const FPS_OPTIONS = PROJECT_FPS.map((fps) => [String(fps), `${fps} fps`] as const);

export async function createTimingLab(root: HTMLElement, options: TimingLabOptions): Promise<void> {
  const { params } = options;
  const initialTab = params.get('tab') ?? '';
  let tab: LabTab = isLabTab(initialTab) ? initialTab : 'fps';
  let exposureFps: ProjectFps = 24;
  let scene: LabScene = createLabScene(lanesForTab(tab, exposureFps));

  const preview = el('div', { id: 'preview', 'aria-label': 'Timing comparison', role: 'img' });
  const stage = el('main', { id: 'stage' }, preview);

  const clock = new Clock({ duration: LAB_DURATION, fps: 24, onChange: () => refresh() });
  const transport = createTransport(clock);

  const tabButtons = LAB_TABS.map((name) =>
    el('button', { type: 'button', 'data-tab': name }, TAB_TEXT[name].title),
  );
  const note = el('p', { id: 'lab-note' });
  const stepSelect = select('lab-step-fps', FPS_OPTIONS, '24', 'Step and frame counter rate');
  const exposureSelect = select('lab-fps', FPS_OPTIONS, '24', 'Exposure comparison frame rate');
  const exposureField = el(
    'div',
    { class: 'field-row', id: 'lab-fps-field' },
    el('label', { for: 'lab-fps' }, 'Lane rate'),
    exposureSelect,
  );
  const tableBody = el('tbody', { id: 'lanes' });
  const table = el(
    'table',
    { id: 'lane-table' },
    el(
      'thead',
      {},
      el(
        'tr',
        {},
        ...['Lane', 'FPS', 'Hold', 'Frame', 'Pose', 'Poses/s'].map((title) =>
          el('th', { scope: 'col' }, title),
        ),
      ),
    ),
    tableBody,
  );
  const panel = el(
    'aside',
    { id: 'panel' },
    panelSection(
      'Compare',
      el(
        'div',
        { class: 'segmented tabs', role: 'group', 'aria-label': 'Comparison' },
        ...tabButtons,
      ),
      note,
      exposureField,
    ),
    panelSection('Lanes', el('div', { class: 'table-scroll' }, table)),
    panelSection(
      'Stepping',
      el(
        'div',
        { class: 'field-row' },
        el('label', { for: 'lab-step-fps' }, 'Step by'),
        stepSelect,
      ),
    ),
  );
  const header = el(
    'header',
    { id: 'header' },
    el('h1', {}, 'Animation Timing Lab'),
    el('span', { id: 'project-label' }, 'Technical demo: neutral shapes'),
    el('a', { id: 'view-link', href: '?' }, 'Studio'),
  );
  root.classList.add('lab-view');
  root.replaceChildren(header, stage, panel, transport.element);

  const renderer = options.createRenderer();
  let mounted = false;
  let cells = new Map<string, { frame: HTMLElement; pose: HTMLElement }>();
  // Set after the state above exists, because changing it notifies refresh().
  clock.loop = true;

  function buildRows(): void {
    cells = new Map();
    tableBody.replaceChildren(
      ...scene.lanes.map((lane) => {
        const frame = el('td', { 'data-cell': 'frame' });
        const pose = el('td', { 'data-cell': 'pose' });
        cells.set(lane.id, { frame, pose });
        const chip = el('span', { class: 'lane-chip', style: `background:${lane.color}` });
        return el(
          'tr',
          { 'data-lane': lane.id },
          el('th', { scope: 'row' }, chip, lane.label),
          el('td', {}, String(lane.fps)),
          el('td', {}, String(lane.hold)),
          frame,
          pose,
          el('td', {}, String(posesPerSecond(lane))),
        );
      }),
    );
  }

  function refresh(): void {
    if (!mounted) return;
    const time = clock.time;
    renderer.render(scene.frameAt(time));
    transport.update();
    for (const lane of scene.lanes) {
      const state = laneState(lane, time);
      const row = cells.get(lane.id);
      if (row) {
        row.frame.textContent = String(state.frame);
        row.pose.textContent = String(state.pose);
      }
    }
    preview.dataset['time'] = String(time);
    preview.dataset['frame'] = String(clock.frame);
    preview.dataset['fps'] = String(clock.fps);
  }

  function applySize(): void {
    const size = fitAspect(
      { width: stage.clientWidth, height: stage.clientHeight },
      scene.aspectRatio,
    );
    preview.style.width = `${size.width}px`;
    preview.style.height = `${size.height}px`;
    renderer.resize(size);
  }

  function showTab(): void {
    scene = createLabScene(lanesForTab(tab, exposureFps));
    note.textContent = TAB_TEXT[tab].note;
    exposureField.hidden = tab !== 'exposure';
    for (const button of tabButtons) {
      button.setAttribute('aria-pressed', String(button.dataset['tab'] === tab));
    }
    buildRows();
    applySize();
    refresh();
  }

  for (const button of tabButtons) {
    button.addEventListener('click', () => {
      const name = button.dataset['tab'] ?? '';
      if (!isLabTab(name)) return;
      tab = name;
      showTab();
    });
  }
  exposureSelect.addEventListener('change', () => {
    exposureFps = Number(exposureSelect.value) as ProjectFps;
    showTab();
  });
  stepSelect.addEventListener('change', () => {
    clock.fps = Number(stepSelect.value);
  });

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
  if (params.has('t') && Number.isFinite(initialTime)) clock.seek(initialTime);

  showTab();
  new ResizeObserver(() => {
    applySize();
    refresh();
  }).observe(stage);
  preview.dataset['ready'] = 'true';
}
