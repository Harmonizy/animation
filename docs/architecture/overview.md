# Architecture overview

## Data flow

```text
project data -> Zod schema -> evaluateScene(scene, t, overrides) -> FrameState -> Renderer -> pixels
                                            ^
                                   Clock and Studio UI
```

| Module                | Responsibility                                       | May import                   |
| --------------------- | ---------------------------------------------------- | ---------------------------- |
| `src/core`            | Schema, easing, evaluation, framing, matrices (pure) | `zod`                        |
| `src/demos`           | Technical demonstration data                         | core types                   |
| `src/playback`        | Transport (current time, playing state)              | `gsap`                       |
| `src/render/types.ts` | Renderer interface                                   | core types                   |
| `src/render/pixi`     | PixiJS implementation                                | `pixi.js`, core              |
| `src/studio`          | Workspace UI                                         | core, playback, render types |
| `src/labs/timing`     | Timing Lab (`model.ts` is pure)                      | core, playback, render types |
| `src/main.ts`         | Wires the pieces together                            | all except `pixi.js`, `gsap` |

ESLint `no-restricted-imports` enforces these boundaries.

## Key decisions

**Timing.** Display refresh, playhead, pose exposure and export sampling are separate. See
[timing architecture](timing.md).

**Pure evaluation.** `evaluateScene` depends only on its arguments, so any timestamp can be rendered
directly and playing to a time matches seeking to it. Browser tests compare screenshots to confirm
this. Frame export (Phase 5) can use the same function.

**Renderer-neutral frames.** `FrameState` holds world matrices, opacity, shape data and draw order,
with no Pixi types. A later Three.js renderer would implement the same interface. A `z` axis would be
an additive schema change, using `schemaVersion` for migration. It has not been built or tested.

**Resolution independence.** A scene declares a world-space `safeArea`. At zoom 1 it always fits:
`scale = min(viewportWidth / safeWidth, viewportHeight / safeHeight) * zoom`. Other aspect ratios
reveal more of the world rather than stretching it.

**Independent camera and object tracks.** Node tracks use scene time. Camera tracks belong to shots
and use shot-local time, so objects continue uninterrupted across a cut.

**Non-destructive viewing controls.** Camera and layer changes in the UI are overrides passed to
`evaluateScene`. Scene data is never modified, so results stay reproducible and resets are exact.

**On-demand rendering.** Pixi's ticker is disabled. The Studio draws when the clock or a control
changes, not continuously.

## GSAP

The owner's Phase 1 brief specifies a deterministic timeline with GSAP. A paused GSAP timeline is the
transport in `src/playback/clock.ts`, providing play, pause, seek and the time source. Keyframe
values and easing are **not** computed by GSAP, because `core` must stay pure and testable.

**License risk.** GSAP is free but not open source. Reports of its
[standard license](https://gsap.com/standard-license/) describe a restriction on products that let
users create visual animations without code in competition with Webflow. Private and code-driven use
looks unproblematic, but the owner should read the license itself before distributing this studio as
a tool. This is a project note, not legal advice. Removing GSAP only requires replacing `clock.ts`.

## Implemented, planned, experimental

| Area                                                       | State          |
| ---------------------------------------------------------- | -------------- |
| Schema validation, keyframes, easing, hierarchy, pivots    | Implemented    |
| Layer order, opacity, shots, camera position/zoom/rotation | Implemented    |
| Play, pause, seek, restart, frame step, loop, speed        | Implemented    |
| Project and export FPS (12, 24, 25, 30, 60)                | Implemented    |
| Per-group and per-track exposure, custom holds             | Implemented    |
| Frame counter and timecode                                 | Implemented    |
| Export frame sampling (selecting frames, no encoding)      | Implemented    |
| Animation Timing Lab                                       | Implemented    |
| 16:9, 9:16, 1:1 preview; responsive workspace              | Implemented    |
| Camera rotation control in the UI                          | Planned        |
| Reverse playback                                           | Planned        |
| Palette tokens, SVG path parts, depth planes, parallax     | Implemented    |
| Poses, pose tracks, silhouette and grayscale review        | Implemented    |
| Three style laboratories and test mannequin                | Implemented    |
| Transitions, animation events, presets                     | Planned        |
| Cinematography metadata (shot size, angle, movement)       | Planned        |
| External SVG file import, advanced character rigging       | Planned        |
| Scene authoring, storyboards                               | Planned        |
| Audio, frame rendering, video export                       | Planned        |
| Three.js renderer                                          | Planned        |
| Experimental features                                      | None currently |

## Roadmap

1. **Phase 0:** architecture and planning (done).
2. **Phase 1:** minimal working studio (see status).
3. **Phase 2:** cinematography, composition and animation laboratory.
4. **Phase 3:** character rigging and visual asset pipeline.
5. **Phase 4:** scene authoring and storyboard workflow.
6. **Phase 5:** frame rendering, audio synchronization and video export.
7. **Phase 6:** production optimization and collaboration features.

Authorized so far: Phases 0 and 1, plus the timing engine, Timing Lab and Cinematic Minimalist
Silhouette foundation from Phases 2 and 3. The rest of
Phase 2 and later phases need approval.
