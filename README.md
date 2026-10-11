# Carom

Carom is a browser paddle duel about angles. Move your paddle as you strike to put spin on the ball, then use two central obstacles for bank shots. Play against the AI or share a keyboard in local Versus. First to 11 points wins with a lead of two.

## Run

Install with `npm ci`, then start a development server with `npm run dev`. Run `npm run build` to create the self-contained static site in `dist/`; serve that directory from the root of any static server. `npm run preview` previews the build locally.

## Controls

| Action | Keys |
| --- | --- |
| Left paddle | W / S |
| Right paddle | Up / Down arrows |
| Menu selection | W / S or arrows, Enter or Space; pointer or touch |
| Pause or resume | P or Escape |
| Mute | M |

In Solo, either paddle key pair moves your left paddle. On touchscreens, the game displays virtual controls. A paddle's movement at impact bends the ball's later flight. The amber bars bounce it without removing spin.

## Checks

`npm run typecheck`, `npm run lint`, `npm run format`, and `npm test` run the repository's checks.
