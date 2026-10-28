# Snake HUD Layout — Design

## Intent

Give score and powerup inventory a stable, compact home beside the profile photo, and reshape the playfield into a taller, narrower board.

## Scope and constraints

- Desktop layout has three columns: profile photo, vertical fruit inventory, then the game board.
- Inventory is directly right of the photo and left of the board. Its nine fixed fruit slots use a 3×3 grid; each fruit keeps its identity and active label/count.
- Put score, countdown, and short status messages at the top of the inventory panel; remove the HUD from above the board.
- The board becomes taller and narrower, with grid dimensions derived from the resized canvas.
- On narrow screens, stack inventory above the board and preserve the 3×3 grid, usable controls and readable labels.
- Keep the existing canvas game, fruit effects, visual palette, and static-site stack.

## Approaches

1. **Three columns (selected):** photo, inventory, board. This matches the requested left-to-right order and gives the board its own taller column.
2. **Photo plus inventory sidebar:** combine both in a left sidebar with the board to its right. This gives the board width but places inventory below rather than beside the photo.
3. **Inventory rail inside the game frame:** keep the photo position and split the frame between inventory and board. This visually groups game UI but narrows the canvas within the existing footprint.

## Implementation calls

Use responsive CSS grid around the existing profile/game row. Create the inventory panel beside the profile photo and keep it in normal layout flow. Resize the canvas to the board column so collision and spawn bounds follow its dimensions. On small screens, stack the profile, inventory and board, with the inventory immediately above the board.

## Acceptance

At desktop widths, the photo, compact 3×3 inventory and taller board read as distinct adjacent columns without overlap. At mobile widths they stack cleanly; all nine fruit retain fixed order, active labels/counts, and their existing effect behavior.
