# Proposal: Cinematic Minimalist Silhouette

**Status: awaiting owner approval. Nothing here is implemented.** It overlaps Phases 2 and 3, which are
not yet authorized beyond the timing engine. It comes after the timing engine and builds on it.

## Goal

A reusable visual style foundation, proven by three neutral laboratories and judged from rendered
output. There is no narrative, no named character and no lore. The figure in the labs is an anonymous
test mannequin.

## Art-direction guidelines

These are starting hypotheses to test in the labs, not rules.

### Silhouette first

- **Black-fill test:** a pose must read when every part is one flat color.
- **Negative space:** keep gaps between limbs and torso for key poses. Overlapping limbs lose the read.
- **Line of action:** one clear curve through the whole body per key pose.
- **Phone-size test:** key poses must read in the 9:16 preview at 390 px wide.

### Figure construction

- Build from few simple shapes, with deliberately exaggerated proportions.
- Faceless: no eyes, mouth or painted expression. The head reads through tilt and direction.
- Vary shape language by design, while treating its associations as conventions, not fixed meanings.

### Emotion without a face

| Channel  | What can vary                                                  |
| -------- | -------------------------------------------------------------- |
| Posture  | Spine curve, shoulder height, head angle, weight distribution  |
| Movement | Speed, hesitation, and whether motion leads with head or chest |
| Spacing  | Distance to other shapes and to the frame edge                 |
| Scale    | Figure size relative to the environment                        |
| Timing   | Holds, pauses and rhythm between actions                       |

### Color and value

- **Flat fills only.** Depth comes from layered value, not rendered shading.
- **Value first:** a frame should read in grayscale. Limit it to about 3-5 main values.
- **Semantic tokens:** `sky`, `atmosphere`, `far`, `mid`, `near`, `subject`, `accent`.
- **Restrained accent:** one accent color, used sparingly, is the first place the eye should go.
- **Atmospheric perspective:** farther layers move toward the `atmosphere` token.

### Depth and light

- Three or more planes: foreground, midground, background.
- Foreground is usually darkest and may frame the subject. Background is usually closest to the fog
  color. Backlit scenes are a useful default for strong silhouettes.
- Light is suggested with flat shapes and soft gradients, without shaders.

### Camera

- Compose with empty space on purpose, using scale to set a relationship with the environment.
- Slow, motivated moves. Parallax should reveal depth rather than call attention to itself.
- Compose separately for 16:9, 9:16 and 1:1 where needed. Do not only crop.

## Technical plan

### What gets added

| Requirement          | Approach                                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| SVG parts            | New `path` shape holding SVG path data, authored as data or an `.svg` part file                                    |
| Hierarchy and pivots | Already implemented. Add part pivots in the part definition                                                        |
| Poses                | A pose is a named map of part to local transform. New `pose` track blends between poses using the pure evaluator   |
| Palette tokens       | `palette` on the scene. Shape fills accept `token:<name>` or a hex color, resolved at evaluation                   |
| Depth planes         | Scene `planes` with a `parallax` factor. Root nodes belong to a plane, and `FrameState` carries a matrix per plane |
| Atmosphere           | Fog as full-frame flat or gradient layers between planes. Moving haze is a keyframed transform. No shaders         |
| Draw order           | Per-part order within a rig, so an arm can pass behind a torso (children currently always draw on top)             |
| Labs                 | Lab selector in the Studio, plus `?lab=` for reproducible captures                                                 |

The pure-evaluation rule still applies: pose, parallax and palette all resolve inside `evaluateScene`.
Fog "drift" comes from tracks rather than random noise.

`schemaVersion` moves to 3, with a tested migration from version 2.

### What the timing engine provides

- Pose tracks join the `character` group, so On Ones and On Twos can be compared directly.
- Backgrounds and fog use the `background` group, and the camera keeps its own hold.
- All labs share the existing transport: step, loop, speed, timecode and frame counter.
- Lab screenshots can target exact frames with `?frame=`.

### Three laboratories

| Lab                        | Tests                                                                                  |
| -------------------------- | -------------------------------------------------------------------------------------- |
| Geometric minimalism       | Primitive shapes as abstract figures, weight and timing, value hierarchy               |
| Articulated silhouette     | Mannequin rig with SVG parts: neutral stance, lean, reach, walk cycle, black-fill test |
| Layered atmospheric cutout | Figure in 3+ planes with parallax, fog between planes, and a camera move               |

Each lab shows posture and movement, color and contrast, silhouette readability, camera composition
and timeline scrubbing. The existing transport and aspect controls are shared.

### Increments

1. Schema v3 and migration: palette tokens, `path` shape, draw order, with unit tests.
2. Depth planes and parallax, with exact-math unit tests and pixel tests.
3. SVG path rendering in Pixi, and a bounds calculation for paths.
4. Poses and pose tracks.
5. Lab selector, then Lab 1, with a screenshot review.
6. Mannequin parts, then Lab 2, with a screenshot and black-fill review.
7. Fog layers, then Lab 3, with a screenshot and motion review.
8. Art-direction guide updated with what the labs actually showed, plus the visual QA report.

### Verification

- Unit tests for every new evaluation rule.
- `npm run capture` at 0/25/50/75/100% and shot boundaries, in all aspect ratios and for each lab.
- **Automated black-fill mode:** renders every part in one color, so silhouette review uses real output.
- **Grayscale capture:** to review value structure.
- Reports distinguish measured facts from subjective judgment. With no reference image, nothing is
  claimed to match a target.

### Risks

| Risk                                                  | Mitigation                                                                 |
| ----------------------------------------------------- | -------------------------------------------------------------------------- |
| Pixi's SVG support may not cover all path features    | Spike first. Restrict parts to a documented subset, with validation        |
| Bounds for curved paths are harder than for polygons  | Flatten paths for bounds using a small tested routine                      |
| Soft fog may band in 8-bit color                      | Inspect captures. Prefer flat stepped layers if it does                    |
| Evaluation cost grows with rigs                       | Measure with Playwright, then cache only if needed                         |
| The result may look generic even if technically sound | Treat lab results as evidence, and iterate with owner review               |
| GSAP license limits on no-code visual tools           | Owner reads the license before any distribution of a visual authoring tool |

## Decisions needed

1. Approve this scope as an early part of Phases 2-3?
2. Mannequin parts: authored by Claude as simple SVG paths, or supplied by the owner?
3. Starting palette: use neutral test tokens and let the owner choose later, or does the owner have a
   reference?
