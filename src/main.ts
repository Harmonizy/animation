import { parseProject } from './core/schema';
import { geometricDemo } from './demos/geometricDemo';
import { PixiRenderer } from './render/pixi/pixiRenderer';
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

const project = parseProject(geometricDemo);
const scene = project.scenes[0];
if (!scene) throw new Error('The project has no scenes');

const params = new URLSearchParams(window.location.search);
const studio = await createStudio(root, {
  project,
  scene,
  params,
  createRenderer: () => new PixiRenderer(),
});

if (params.get('debug') === '1') window.__studioDebug = studio;
