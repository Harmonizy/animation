import { formatTimecode } from '../core/timing';
import { PLAYBACK_SPEEDS, type Clock } from '../playback/clock';
import { el, select } from './dom';

export interface Transport {
  readonly element: HTMLElement;
  /** Refreshes the controls and readouts from the clock. */
  update(): void;
}

/** Playback controls for a clock, shared by the Studio and the labs. */
export function createTransport(clock: Clock, extraReadout?: () => string): Transport {
  const play = el('button', { id: 'play', type: 'button', class: 'primary' }, 'Play');
  const restart = el('button', { id: 'restart', type: 'button' }, 'Restart');
  const stepBack = el(
    'button',
    { id: 'step-back', type: 'button', 'aria-label': 'Step back one frame' },
    '◀ 1',
  );
  const stepForward = el(
    'button',
    { id: 'step-forward', type: 'button', 'aria-label': 'Step forward one frame' },
    '1 ▶',
  );
  const loop = el('button', { id: 'loop', type: 'button' }, 'Loop');
  const speed = select(
    'speed',
    PLAYBACK_SPEEDS.map((value) => [String(value), `${value}×`] as const),
    String(clock.speed),
    'Playback speed',
  );
  const seek = el('input', {
    id: 'seek',
    type: 'range',
    min: '0',
    step: '1',
    value: '0',
    'aria-label': 'Seek frame',
  });
  const timecode = el('span', { id: 'timecode' });
  const frameCounter = el('span', { id: 'frame-counter' });
  const extra = el('span', { id: 'readout-extra' });
  const readout = el('output', { id: 'readout', for: 'seek' }, timecode, frameCounter, extra);
  const buttons = el(
    'div',
    { id: 'transport-buttons' },
    play,
    restart,
    stepBack,
    stepForward,
    loop,
    speed,
  );
  const element = el(
    'section',
    { id: 'transport', 'aria-label': 'Transport' },
    buttons,
    readout,
    seek,
  );

  play.addEventListener('click', () => (clock.playing ? clock.pause() : clock.play()));
  restart.addEventListener('click', () => clock.restart());
  stepBack.addEventListener('click', () => clock.stepBackward());
  stepForward.addEventListener('click', () => clock.stepForward());
  loop.addEventListener('click', () => {
    clock.loop = !clock.loop;
  });
  speed.addEventListener('change', () => {
    clock.speed = Number(speed.value);
  });
  seek.addEventListener('input', () => clock.seekFrame(Number(seek.value)));

  return {
    element,
    update() {
      const frame = clock.frame;
      play.textContent = clock.playing ? 'Pause' : 'Play';
      loop.setAttribute('aria-pressed', String(clock.loop));
      seek.max = String(clock.frameCount - 1);
      seek.value = String(frame);
      timecode.textContent = formatTimecode(frame, clock.fps);
      frameCounter.textContent = `frame ${frame} / ${clock.frameCount}`;
      extra.textContent = extraReadout?.() ?? '';
    },
  };
}
