# Visual style: Cinematic Minimalist Silhouette

**Status: implemented as a technical foundation, with three neutral laboratories.** There is no story,
named character or world lore. The figure is an anonymous test mannequin, and all colors are test
values. Treat these guidelines as tested starting points rather than rules.

Open the labs with `?view=geometric`, `?view=articulated` or `?view=atmospheric`.

## Art-direction guidelines

### Silhouette first

- **Black-fill test:** a pose must read with every part in one color. Use **Display: Silhouette**.
- **Negative space:** keep gaps between limbs and body in key poses. The first neutral pose in the
  Articulated lab failed this and read as a single column, until its arms and feet moved apart.
- **Line of action:** aim for one clear curve through the body per key pose.
- **Phone size:** check poses in 9:16 on a phone-sized window.

### Figure construction

- Build from few simple shapes, with parts drawn from their joint at the local origin.
- No eyes, mouth or painted expression. The head reads through tilt and direction.
- Shape associations are conventions that context can change, not fixed meanings.

### Emotion without a face

| Channel  | What can vary                                                 |
| -------- | ------------------------------------------------------------- |
| Posture  | Spine curve, shoulder height, head angle, weight distribution |
| Movement | Speed, hesitation, and what leads the motion                  |
| Spacing  | Distance to other shapes and to the frame edge                |
| Scale    | Size relative to the environment                              |
| Timing   | Holds, pauses and rhythm                                      |

The labs show the mechanics for these channels. They do not test whether any pose conveys a particular
emotion to an audience.

### Color and value

- **Flat fills only.** Depth comes from layered values.
- **Value first:** a frame should read in grayscale. Use **Display: Grayscale**.
- **Atmospheric perspective:** farther layers move toward the `atmosphere` token.
- **One restrained accent:** used sparingly.
- **Give every role its own token.** Using `subject` for foreground shapes looked correct in dark-subject
  palettes, but in `inverted` it made foreground shapes as bright as the figure. `foreground` now exists.

| Token        | Role                                |
| ------------ | ----------------------------------- |
| `sky`        | Furthest background                 |
| `atmosphere` | Fog and light sources               |
| `far`, `mid` | Receding layers                     |
| `near`       | Ground the subject stands on        |
| `foreground` | Shapes in front of the subject      |
| `subject`    | The main figure                     |
| `subjectFar` | Limbs on the far side of the figure |
| `accent`     | The first place to look             |

### Depth and light

- Use three or more planes. Parallax: 0 is infinitely far, 1 is the subject's plane, above 1 is nearer.
- Fog is stacked translucent flat bands between planes, so no shader is needed.
- **Foreground must not hide the subject for long.** Slow, wide pillars covered the figure for seconds
  at a time. Faster, narrower, rarer ones work better, and a unit test now limits this to under 12% of
  frames.

### Camera

- Compose empty space on purpose, and use scale to relate the figure to the environment.
- Keep camera moves slow and motivated. Parallax should reveal depth, not call attention to itself.
- Check every aspect ratio. A shared camera keeps the subject in frame but does not make a good
  composition: in 9:16 the Atmospheric lab has a large empty ground area.

## Technical summary

| Requirement              | Implementation                                                   |
| ------------------------ | ---------------------------------------------------------------- |
| SVG vector parts         | `path` shapes using an SVG path subset (`src/core/svgPath.ts`)   |
| Reusable parts           | `MANNEQUIN_PARTS` in `src/labs/silhouette/mannequin.ts`          |
| Hierarchy and pivots     | Node hierarchy, with joints at each part's origin                |
| Behind-parent limbs      | A negative `layer` draws a child behind its parent               |
| Poses without faces      | `poses` and `poseTracks`, blended by the pure evaluator          |
| Planted feet             | Two-bone inverse kinematics, solved when poses are built         |
| Palette tokens           | Scene `palette`, `token:<name>` colors, palette override in UI   |
| Foreground to background | Scene `planes`, ordered back to front                            |
| Parallax                 | `planeMatrix`, baked into world matrices, so renderers ignore it |
| Atmospheric effects      | Flat translucent fog bands, drifting via `background` tracks     |
| Camera and timelines     | Existing shots, camera tracks, exposure and transport            |
| Review modes             | `display: silhouette` and `display: grayscale` overrides         |

## Laboratories

| Lab                        | Shows                                                                        |
| -------------------------- | ---------------------------------------------------------------------------- |
| Geometric minimalism       | Primitive shapes: lean from a base pivot, squash and stretch, a hop, spacing |
| Articulated silhouette     | Mannequin: neutral, lean, reach, crouch and walk, plus the sheet of parts    |
| Layered atmospheric cutout | Figure walking through five planes with parallax, fog and two camera shots   |

All three share posture and movement, palette choice, silhouette and grayscale review, multiple shots,
and full timeline scrubbing with exposure control.

## Known limitations

- Reviewed by one AI reviewer from stills, not by an art director, and not against a reference.
- The walk was judged from stills of consecutive poses, not live motion. It is a mechanical cycle, and
  has not been tuned for weight or personality.
- The figure is in profile only, with no turnaround.
- Feet are solved only at pose keys. Between keys, a planted foot can slide slightly, with the test limit
  at 25 world units across a stance.
- Mannequin part proportions and palettes are placeholders.
- Fog is banded by design and can read as strata rather than soft mist.
- There is no per-aspect camera framing.
- Parallax ignores camera rotation differences between planes.
- SVG support is limited to M, L, H, V, C, Q and Z. Arcs and fill rules are not supported.
- Importing external `.svg` files is not implemented. Parts are path data in TypeScript.
