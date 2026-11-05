# Data contracts

The source of truth is `src/core/schema.ts`. This page explains intent.

## Conventions

- Time is in seconds. Rotation is in degrees. Distances are in world units.
- Unknown fields are rejected, so typos fail loudly.
- `+y` points down, matching screen coordinates.

## Implemented (`schemaVersion: 1`)

```text
Project  { schemaVersion, id, name, kind: technical-demo | production, scenes[] }
Scene    { id, duration, fps, background, safeArea, nodes[], tracks[], shots[] }
Node     { id, parent?, layer, shape, transform }
Shape    group | rect | ellipse | polygon
Transform{ x, y, rotation, scaleX, scaleY, pivotX, pivotY, opacity }
Track    { target, property: x|y|rotation|scaleX|scaleY|opacity, keyframes[] }   scene time
Shot     { id, start, duration, camera, tracks[] }
Camera   { x, y, zoom, rotation }
CameraTrack { property: x|y|zoom|rotation, keyframes[] }                         shot-local time
Keyframe { time, value, easing: linear|easeIn|easeOut|easeInOut|step }
```

Shapes are centered on their local origin. A keyframe's easing applies to the segment that starts at
that keyframe. Before the first and after the last keyframe, a track holds its end value.

### Validation rules

- Node ids are unique, parents exist and there are no parent cycles.
- Track targets exist, with at most one track per target and property.
- Keyframe times strictly increase and stay within the scene or shot.
- Shots start at 0, leave no gaps or overlaps, and end exactly at the scene duration.
- Colors are `#rrggbb`.

### Draw order

Siblings sort by `layer`, with ties in declaration order. Children draw above their parent. `layer`
orders siblings only, so a child cannot move behind its parent's siblings.

## Planned contracts (not implemented)

These are descriptive notes. There is intentionally no code for them yet.

| Contract        | Expected fields                                         | Phase |
| --------------- | ------------------------------------------------------- | ----- |
| Shot metadata   | shot size, angle, movement, composition intent          | 2     |
| Depth planes    | foreground/midground/background, parallax factor        | 2     |
| Events          | time, name, payload                                     | 2     |
| Assets          | id, type, path, source, license, author                 | 3     |
| Rig and pose    | bone hierarchy, named poses, pose tracks                | 3     |
| Character bible | see [character design](../creative/character-design.md) | 4     |
| World bible     | see [worldbuilding](../creative/worldbuilding.md)       | 4     |
| Story plan      | see [screenwriting](../creative/screenwriting.md)       | 4     |
| Light and color | key/fill/rim, color script                              | 2-3   |
| Audio cues      | ambience, foley, dialogue, music, time, gain            | 5     |
