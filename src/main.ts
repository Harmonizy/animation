import { Application, Graphics } from 'pixi.js';

// Temporary spike: proves Pixi renders under headless Chromium. Replaced by the studio.
const app = new Application();
await app.init({
  width: 640,
  height: 360,
  autoStart: false,
  preference: 'webgl',
  background: 0x101018,
});
document.querySelector('#app')?.append(app.canvas);
app.stage.addChild(new Graphics().rect(220, 80, 200, 200).fill(0xff5533));
app.render();
document.body.dataset['renderer'] = app.renderer.name;
document.body.dataset['ready'] = 'true';
