import { el, select } from './dom';

/** Every page of the app. The empty id is the Studio's default demo. */
const VIEWS = [
  ['', 'Geometric demo'],
  ['timing', 'Timing Lab'],
  ['geometric', 'Lab: Geometric minimalism'],
  ['articulated', 'Lab: Articulated silhouette'],
  ['atmospheric', 'Lab: Layered atmospheric'],
] as const;

export function createViewNav(current: string): HTMLElement {
  const nav = select('view-select', VIEWS, current, 'Open view');
  nav.addEventListener('change', () => {
    window.location.search = nav.value === '' ? '' : `?view=${nav.value}`;
  });
  return el('nav', { id: 'view-nav' }, nav);
}
