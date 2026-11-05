# Review checklist

For reviewing any change, by a person or an AI assistant.

## Correctness

- [ ] The relevant commands were run, and their results are stated rather than assumed.
- [ ] New behavior has tests that would fail without the change.
- [ ] `evaluateScene` is still pure, and frames are still reproducible.
- [ ] Resources created by new code are released.

## Architecture

- [ ] Import boundaries still hold, with no lint rules disabled to get around them.
- [ ] Scene content is data. Technical demos are separate from production content.
- [ ] Schema changes update `docs/architecture/data-contracts.md` and handle `schemaVersion`.

## Honesty

- [ ] Every control does something real.
- [ ] Docs label features Implemented, Planned, Experimental, or as known limitations, accurately.
- [ ] Visual claims cite screenshots that someone actually looked at.
- [ ] No claim of matching a reference without a direct comparison.

## Visual

- [ ] Checked at 16:9, 9:16 and 1:1, and in landscape and portrait windows.
- [ ] Checked at several timestamps, including shot boundaries, and in motion.
- [ ] No unexpected clipping, broken layering or loading errors.

## Scope and safety

- [ ] Stays within the authorized phases, with no story, named character or lore unless authorized.
- [ ] No secrets, renders or archives committed. New assets have provenance.
- [ ] Sources in docs are real, and synthesized advice is not attributed to any studio.
- [ ] Nothing was pushed or published without the owner's approval.
