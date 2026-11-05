# Animation principles

**Status:** interpolation, easing, hierarchy and pivots are implemented. Rigging and presets are
**Planned**. Sources: [references](../REFERENCES.md), notably Thomas and Johnston.

## The twelve classic principles

| Principle                     | In practice                                           |
| ----------------------------- | ----------------------------------------------------- |
| Squash and stretch            | Shows mass and flexibility while preserving volume    |
| Anticipation                  | Prepares the viewer for an action                     |
| Staging                       | Presents one idea clearly                             |
| Straight ahead / pose to pose | Spontaneous drawing, or planned key poses             |
| Follow-through / overlapping  | Parts stop and start at different times               |
| Slow in and slow out          | Eased starts and stops                                |
| Arcs                          | Natural movement tends to follow curves               |
| Secondary action              | Supports the main action without competing with it    |
| Timing                        | Frame count conveys weight and mood                   |
| Exaggeration                  | Pushes clarity while staying believable for the style |
| Solid drawing                 | Form, weight and balance                              |
| Appeal                        | The design and motion are engaging to watch           |

## Implementation notes

- **Determinism:** values come from a pure function of time. Do not advance state per frame, or use
  unseeded randomness or scattered timers.
- **Easing:** a keyframe's easing covers the segment that starts there. `step` holds a value for poses.
- **Hierarchy:** transforms compose from parent to child, as a future rig would need.
- **Pivots:** a joint rotates around its pivot, which also needs to be correct in child space.
- **Layering:** children draw above their parent. Rigs that need an arm behind a torso will need a
  richer draw-order model (Phase 3).

## Checking motion

Stills cannot show timing. Watch the motion, scrub slowly through contact points, and check the frames
on either side of a cut.
