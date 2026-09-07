Map artwork lives in these two folders:

1) Map Thumbnails  → used for the icons on the home page grid
   Naming: <Map Name>.<ext>, exactly as the map's display name
   Example: assets/Map Thumbnails/Kafe Dostoyevsky.webp

2) Map Blueprints  → floor images on each map's detail page
   One subfolder per map, one image per floor/tab. Tab names come from the
   image names.
   Example: assets/Map Blueprints/Oregon/Basement.webp → "Basement" tab
            assets/Map Blueprints/Oregon/Tower.webp    → "Tower" tab

Supported extensions (tried in order): .jpg, .png, .webp, .jpeg

The map names come from src/data/maps.js (current ranked rotation):
  Calypso Casino, Chalet, Bank, Kafe Dostoyevsky, Border, Clubhouse,
  Lair, Nighthaven Labs, Consulate, Fortress, Kanal, Oregon,
  Theme Park, Villa

Notes:
- File names must match the map's display name exactly (e.g. "Theme Park",
  not "theme park" or "ThemePark").
- Folder names contain spaces — the app URL-encodes them automatically.
- Recommended thumbnail size: 800×450 (16:9), .jpg for photos, .webp for
  smaller files.
- No image yet? The site shows a monogram fallback tile — nothing breaks.
