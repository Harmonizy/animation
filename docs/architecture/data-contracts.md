# Data contracts

The source of truth is `src/core/schema.ts`. This page explains intent.

## Conventions

- Time is in seconds. Rotation is in degrees. Distances are in world units.
- Unknown fields are rejected, so typos fail loudly.
- `+y` points down, matching screen coordinates.

## Implemented (`schemaVersion: 3`)

```text
Project  { schemaVersion, id, name, kind: technical-demo | production, scenes[] }
Scene    { id, duration, fps, exportFps, exposure, background, palette, planes[], poses, poseTracks[],
           safeArea, nodes[], tracks[], shots[] }
Plane    { id, parallax }                                                        back to front
Poses    { poseName: { nodeId: { x?, y?, rotation?, scaleX?, scaleY? } } }
PoseTrack{ group, hold?, keyframes: [{ time, pose, easing }] }                   scene time
Exposure { character, camera, background, secondary }                            hold frames
Node     { id, parent?, layer, depth, plane?, subject, shape, transform }
Shape    group | rect | ellipse | polygon | path
Transform{ x, y, rotation, scaleX, scaleY, pivotX, pivotY, opacity }
Track    { target, property: x|y|rotation|scaleX|scaleY|opacity,
           group: character|background|secondary, hold?, keyframes[] }           scene time
Shot     { id, start, duration, camera, tracks[] }
Camera   { x, y, zoom, rotation }
CameraTrack { property: x|y|zoom|rotation, hold?, keyframes[] }                  shot-local time
Keyframe { time, value, easing: linear|easeIn|easeOut|easeInOut|step }
```

Shapes are centered on their local origin. A keyframe's easing applies to the segment that starts at
that keyframe. Before the first and after the last keyframe, a track holds its end value.

`fps` and `exportFps` accept 12, 24, 25, 30 or 60. Holds are whole numbers of at least 1. Older
projects upgrade automatically in `parseProject`; version 1 exports at its project rate. Timing rules are in
[timing architecture](timing.md).

### Colors, paths and planes

- Fills and the background accept `#rrggbb` or `token:<name>`, from the scene's `palette`.
- `path` shapes use SVG path data limited to M, L, H, V, C, Q and Z, absolute or relative.
- Root nodes have a `plane` when a scene has planes. Descendants inherit it through their parent.
- `subject` marks a node and its descendants for silhouette review.
- Applied in order: node defaults, then pose tracks, then node tracks.

### Validation rules

- Node ids are unique, parents exist and there are no parent cycles.
- Track targets exist, with at most one track per target and property.
- Keyframe times strictly increase and stay within the scene or shot.
- Shots start at 0, leave no gaps or overlaps, and end exactly at the scene duration.
- Colors are `#rrggbb`.

### Draw order

Siblings sort by `layer`, with ties in declaration order. Children draw above their parent. `layer`
orders siblings only, so a child cannot move behind its parent's siblings. A negative `layer` draws
the child behind its parent. Root nodes sort by plane first, then by layer.

`depth` (default 0) then reorders the drawn nodes **within each root**, independent of the hierarchy.
Equal depths keep the order above, so a tree that sets no depth draws exactly as before, and depth
never moves a node in front of or behind another root. Character rigs use it, because a cloak that
hangs from the torso must still draw behind the legs. See [Harmonie](../creative/harmonie.md#rig).

## Planned contracts (not implemented)

These are descriptive notes. There is intentionally no code for them yet.

| Contract        | Expected fields                                          | Phase |
| --------------- | -------------------------------------------------------- | ----- |
| Shot metadata   | shot size, angle, movement, composition intent           | 2     |
| Events          | time, name, payload                                      | 2     |
| Assets          | id, type, path, source, license, author                  | 3     |
| Rig templates   | reusable rig definitions in data, beyond the lab builder | 3     |
| Character bible | see [character design](../creative/character-design.md)  | 4     |
| World bible     | see [worldbuilding](../creative/worldbuilding.md)        | 4     |
| Story plan      | see [screenwriting](../creative/screenwriting.md)        | 4     |
| Light and color | key/fill/rim, color script                               | 2-3   |
| Audio cues      | ambience, foley, dialogue, music, time, gain             | 5     |
