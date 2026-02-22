# Salty-crackers (v1)

`v1` is the advanced version of **salty-crackers**, a 2D platform game built with plain HTML, CSS, and JavaScript.

## Game Overview

You play as a pregnant woman collecting salty crackers (`galletitas saladas`) across platform levels.

- The game has **9 levels**.
- Each level is **time-based**: collect all crackers as fast as possible.
- At each new level, the belly grows, reducing movement speed and jump height.
- Double jump is enabled.
- Stamina drains while moving, recovers while resting or eating crackers.
- If stamina hits zero, the character freezes until stamina fully recovers.
- Finish a level to earn **100 coins** and open the shop.
- Finish level 9, to see the baby being born.

## Controls

- Desktop:
  - `Arrow Left`: Move left
  - `Arrow Right`: Move right
  - `Arrow Up`: Jump
  - `1`: Use stamina pill
  - `2`: Use speed pill
  - `3`: Use no-stamina pill
- Phone:
  - `Left` button: Move left
  - `Right` button: Move right
  - `Jump` button: Jump
  - `Pill 1/2/3`: Use items

## Gameplay Rules

- Collect every cracker in the level as fast as possible.

## Items & Shop

- Stamina Pill (50 coins): restores stamina.
- Speed Pill (125 coins): removes belly speed penalty for 5 seconds.
- No-Stamina Pill (150 coins): no stamina drain for 5 seconds.

## UI & Flow

- Main menu with Play, Help, and About.
- In-game buttons: Restart and Main Menu.
- HUD shows level, crackers, coins, time, best time, belly growth, stamina bar, and item inventory.

## Tools and Technologies Used

- **HTML5**: Game page structure and canvas element
- **CSS3**: Layout and visual styling
- **JavaScript (Vanilla)**: Game loop, physics, collisions, input handling, level progression, rendering
- **Canvas API**: Drawing player, platforms, collectibles, and final scene

## Project Files (v1)

- `index.html`
- `style.css`
- `game.js`
