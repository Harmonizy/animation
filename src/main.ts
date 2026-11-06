import '@fontsource/noto-sans-thai/400.css';
import '@fontsource/noto-sans-thai/500.css';
import '@fontsource/noto-sans-thai/600.css';
import '@fontsource/noto-sans-thai/700.css';
import '@fontsource/noto-sans/400.css';
import '@fontsource/noto-sans/600.css';
import { harmoniePreviewProject } from './characters/harmonie/harmonie-scene';
import { parseProject } from './core/schema';
import { geometricDemo } from './demos/geometricDemo';
import { STYLE_LABS, isStyleLabId } from './labs/silhouette/labs';
import { createPartSheet } from './labs/silhouette/partSheet';
import { createTimingLab } from './labs/timing/timingLab';
import { PixiRenderer } from './render/pixi/pixiRenderer';
import { STYLE_PALETTES } from './style/cinematicMinimalist';
import { hollowBellCryptProject } from './episodes/hollow-bell-crypt/scene';
import { taDontLookBackProject } from './episodes/ta-dont-look-back/scene';
import { mountEpisodeRender } from './studio/episodeRender';
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

/** Text is drawn by the renderer, so the typeface must be ready before the first frame. */
async function loadFonts(): Promise<void> {
  await Promise.all(
    [400, 500, 600, 700].flatMap((weight) => [
      document.fonts.load(`${weight} 40px "Noto Sans Thai"`, 'ก'),
      document.fonts.load(`${weight} 40px "Noto Sans Thai"`, 'A'),
      document.fonts.load(
        `${weight === 700 ? 600 : weight === 500 ? 400 : weight} 40px "Noto Sans"`,
        'A',
      ),
    ]),
  );
}

const render = params.get('render');

/** Episodes, by id: each can be watched in the studio or rendered frame by frame. */
const EPISODES: Record<string, () => ReturnType<typeof hollowBellCryptProject>> = {
  'hollow-bell-crypt': hollowBellCryptProject,
  'ta-dont-look-back': taDontLookBackProject,
};
const episode = EPISODES[render ?? ''] ?? EPISODES[view];

if (render && EPISODES[render]) {
  await loadFonts();
  const scene = parseProject(EPISODES[render]()).scenes[0];
  if (!scene) throw new Error('The episode has no scenes');
  await mountEpisodeRender(root, scene, createRenderer);
} else if (episode) {
  await loadFonts();
  const project = parseProject(episode());
  const scene = project.scenes[0];
  if (!scene) throw new Error('The episode has no scenes');
  if (!params.has('aspect')) params.set('aspect', '9:16');
  const studio = await createStudio(root, { project, scene, params, createRenderer, view });
  if (params.get('debug') === '1') window.__studioDebug = studio;
} else if (view === 'timing') {
  await createTimingLab(root, { params, createRenderer });
} else if (view === 'harmonie') {
  const project = parseProject(harmoniePreviewProject());
  const scene = project.scenes[0];
  if (!scene) throw new Error('The Harmonie preview has no scenes');
  const studio = await createStudio(root, { project, scene, params, createRenderer, view });
  if (params.get('debug') === '1') window.__studioDebug = studio;
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
