R6Legends Overlay
=================

A small always-on-top desktop window (Electron) that floats the map
blueprints over your game — great on a second monitor or pinned over
Siege in windowed/borderless mode.

First-time setup (from this folder):
    npm install
    (If node_modules/electron/dist is missing the binary, run:
        node node_modules/electron/install.js )

Run it:
    npm start            (loads the live site's overlay mode)

Or point it at a local dev server:
    OVERLAY_URL=http://localhost:5173/?view=overlay npm start

Features
--------
- Always on top of the game (sticks over fullscreen/borderless windows)
- Drag anywhere by the top bar; resize from any edge
- Pick any map from the dropdown; floor tabs inside
- Opacity slider to make the window translucent over the game
- Global hotkeys (work even while the game is focused):
    Ctrl+Shift+O   pin / unpin always-on-top
    Ctrl+Shift+H   hide / show the overlay
- Close with the X button in the overlay bar

The overlay loads the live website in compact "overlay mode"
(?view=overlay), so new maps and blueprints appear automatically
with no app updates.
