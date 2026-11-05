import { parseProject } from './core/schema';
import { geometricDemo } from './demos/geometricDemo';
import { STYLE_LABS, isStyleLabId } from './labs/silhouette/labs';
import { createPartSheet } from './labs/silhouette/partSheet';
import { createTimingLab } from './labs/timing/timingLab';
import { PixiRenderer } from './render/pixi/pixiRenderer';
import { STYLE_PALETTES } from './style/cinematicMinimalist';
import { createStudio, type Studio } from './studio/studio';
import './studio/studio.css';

declare global {
  interface Window {
    /** Only present with ?debug=1. */
    __studioDebug?: Pick<Studio, 'remountRenderer'>;
  }
}

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('Missing #app element');

const params = new URLSearchParams(window.location.search);
const view = params.get('view') ?? '';
const createRenderer = () => new PixiRenderer();

if (view === 'timing') {
  await createTimingLab(root, { params, createRenderer });
} else if (isStyleLabId(view)) {
  const lab = STYLE_LABS[view];
  const project = parseProject(lab.build());
  const scene = project.scenes[0];
  if (!scene) throw new Error('The lab has no scenes');

  const studio = await createStudio(root, {
    project,
    scene,
    params,
    createRenderer,
    view,
    palettes: STYLE_PALETTES,
    ...(lab.showParts ? { extraPanel: { title: 'Vector parts', content: createPartSheet() } } : {}),
  });
  if (params.get('debug') === '1') window.__studioDebug = studio;
} else {
  const project = parseProject(geometricDemo);
  const scene = project.scenes[0];
  if (!scene) throw new Error('The project has no scenes');

  const studio = await createStudio(root, { project, scene, params, createRenderer, view: '' });
  if (params.get('debug') === '1') window.__studioDebug = studio;
}
