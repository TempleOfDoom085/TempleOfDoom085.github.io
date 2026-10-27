# Shadow Keep

An 8-bit AI security quest themed around Cranium. Find the shadow AI hidden across the
kingdom, validate the vendor line, then red team the Rogue Model and the Supply Chain Hydra.

Designed and built by Brian Temple.

## Layout

```
shadow-keep/
  index.html        built game (what GitHub Pages serves; don't edit by hand)
  build.mjs         builds index.html (GitHub) and dist/claude/ (claude.ai artifact)
  src/              the actual source, concatenated in the order listed in src/ORDER
    head.html, body.html, styles.css   page shell
    00-setup.js     canvas + WebGL post-processing (CRT curve, bloom)
    01-intel.js     sourced industry stats shown in rooms
    02-sprites.js   all sprite art (16-bit style via hd())
    03-audio.js     sound effects + reactive chiptune
    04-world.js     rooms, maps, enemies, vendors, Cranium room facts
    05-state.js     new-game state
    06-input.js     keyboard, touch buttons, slide-to-aim D-pad
    07-helpers.js   collision, particles, text wrap
    07b-messages.js the single pop-up queue (facts, tips, announcements)
    08-player.js    movement, room changes, boss intros
    09-hydra.js     Supply Chain Hydra boss
    10-combat.js    damage, Rogue Model phases, attacks
    11-vendor.js    Vendor Gate mini-game
    12-update.js    main game loop logic
    13-score.js     scoring, progress scores, personal bests
    14-draw.js      all rendering (tiles cached per room, lighting, screens)
    15-online.js    leaderboard, lead capture, share card
    16-loop.js      frame loop + test hook
  tests/run.mjs     headless test suite (no browser needed)
```

## Commands

```
npm run build   # rebuild index.html and the claude.ai version
npm test        # build + run the test suite
```

## Leaderboard

The GitHub build posts to Supabase (`scores` and `leads` tables). The publishable key in
`build.mjs` is meant to be public: row-level security only allows reading/adding scores and
adding leads (leads can't be read back from the browser). Database triggers reject
implausible scores (too-fast clears, oversized progress scores, spam) and bad emails.
View leads in Supabase under Table Editor → leads.
