# R6Champs - Complete Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [File Structure](#file-structure)
3. [How to Use the Strategy System](#how-to-use-the-strategy-system)
4. [Adding Custom Icons](#adding-custom-icons)
5. [Code Documentation](#code-documentation)
6. [Technical Details](#technical-details)

---

## Project Overview

R6Champs is a tactical FPS map reference and strategy planning tool for Rainbow Six Siege. It allows players to:
- View map blueprints with floor switching
- Draw on maps to plan strategies
- Place operator icons on maps
- Save and load strategies locally

### Key Features
- **16 Maps** with blueprint views
- **Drawing Tools** - Pencil, eraser, adjustable brush size
- **Icon Placement** - Drag and drop operator icons
- **Strategy Saver** - Save/load drawings and icon placements
- **No Login Required** - Uses browser localStorage

---

## File Structure

```
/output/
├── index.html                    # Homepage with map grid
├── css/
│   └── styles.css               # All styling (dark theme, red accents)
├── js/
│   ├── main.js                  # Navigation, floor tabs, map cards
│   ├── drawing.js               # Canvas drawing functionality
│   └── strategies.js            # Strategy save/load and icon system
├── Images/
│   ├── MapCards/                # Map thumbnails for homepage
│   │   └── oregon.jpg
│   ├── MapBlueprints/           # Floor blueprint images
│   │   ├── oregon_basement.webp
│   │   ├── oregon_1f.webp
│   │   └── oregon_2f.webp
│   └── Icons/                   # YOUR CUSTOM ICONS GO HERE
│       └── (add your PNG files here)
├── Pages/
│   ├── oregon.html              # Map pages with strategy sidebar
│   ├── map2.html - map16.html   # Other map pages
│   ├── roadmap.html             # Development roadmap
│   ├── special-thanks.html      # Credits page
│   ├── submit-bug.html          # Bug report form
│   ├── submit-feature.html      # Feature request form
│   └── donate.html              # Support page
└── DOCUMENTATION.md             # This file
```

---

## How to Use the Strategy System

### Creating a New Strategy

1. Navigate to any map page (e.g., Oregon)
2. Click **"New Strategy"** button in the sidebar
3. Enter a name for your strategy
4. The page enters **Edit Mode** (red banner appears)

### Drawing on the Map

1. Select the **Pencil** tool (or press 'P')
2. Choose a color with the color picker
3. Adjust brush size with the slider
4. Click and drag on the map to draw
5. Use **Eraser** (press 'E') to remove strokes
6. Press **Ctrl+C** or click **Clear** to clear canvas

### Placing Icons

1. Make sure you're in **Edit Mode**
2. The icon toolbar appears below the map
3. Click an operator icon to select it
4. Click on the map where you want to place it
5. Icons can be dragged to reposition
6. Hover over an icon and click the **×** to delete it

### Saving a Strategy

1. After drawing and placing icons, click **"Save Strategy"**
2. Your strategy is saved to browser storage
3. It appears in the sidebar list

### Loading a Strategy

1. Click on any strategy name in the sidebar
2. The map switches to the correct floor
3. Your drawings and icons appear

### Editing a Strategy

1. Click the **"Edit"** button on a strategy
2. Make your changes (draw more, move icons)
3. Click **"Save Strategy"** to update

### Deleting a Strategy

1. Click the **"Delete"** button on a strategy
2. Confirm the deletion
3. Strategy is permanently removed

---

## Adding Custom Icons

### Step 1: Prepare Your Icons

- Create PNG images with **transparent backgrounds**
- Recommended size: **64x64 pixels** (displays at 32x32)
- Name them with the operator/role name (e.g., `ash.png`, `thermite.png`)

### Step 2: Add Icons to the Folder

1. Place your PNG files in: `/Images/Icons/`
2. No code changes needed - icons are auto-detected

### Step 3: Update the Icon List (Optional)

If you want icons to appear in a specific order, edit `js/strategies.js`:

```javascript
const AVAILABLE_ICONS = [
    'ash',        // Your custom icon names (without .png)
    'thermite',
    'sledge',
    // ... add more
];
```

### Icon Naming Convention

- Use lowercase
- No spaces (use hyphens: `valk-cam`)
- Keep it short for the tooltip

---

## Code Documentation

### main.js

**Purpose:** Core functionality for navigation and map display

**Key Functions:**

```javascript
// Initialize floor tabs for a map
initializeFloorTabs(mapName, floors)

// Switch between floors
switchFloor(floorId)

// Create map cards on homepage
createMapCard(map)
```

**Why this file exists:**
- Separates navigation logic from drawing/strategy code
- Handles floor switching without page reload
- Creates the homepage grid dynamically

---

### drawing.js

**Purpose:** Canvas drawing functionality

**Key Functions:**

```javascript
// Initialize canvas for a floor
initializeDrawingCanvas(floorId)

// Set drawing tool (pencil/eraser)
setTool(tool)

// Set brush size
setBrushSize(size)

// Set brush color
setBrushColor(color)

// Clear the canvas
clearCanvas()
```

**How it works:**
1. Creates a transparent canvas overlay on top of the map image
2. Tracks mouse/touch events for drawing
3. Uses HTML5 Canvas API for strokes
4. Saves canvas state per floor

**Why this approach:**
- Canvas is separate from map image (non-destructive)
- Each floor has its own canvas state
- Touch support for mobile devices

---

### strategies.js

**Purpose:** Strategy management system

**Key Functions:**

```javascript
// Initialize sidebar for a map
StrategyManager.initialize(mapId, floors)

// Create new strategy
StrategyManager.createNew()

// Load a strategy
StrategyManager.load(strategyId)

// Save current strategy
StrategyManager.save()

// Delete a strategy
StrategyManager.delete(strategyId)
```

**How Strategy Saving Works:**

1. **Data Collection:**
   - Canvas is converted to base64 image data
   - Icon positions are recorded as percentages (x%, y%)
   - Map ID and Floor ID are stored

2. **Storage:**
   ```javascript
   {
       id: "strat_1234567890_abc123",
       name: "My Strategy",
       mapId: "oregon",
       floorId: "basement",
       canvasData: "data:image/png;base64,...",
       icons: [
           { iconId: "ash", x: 45.2, y: 32.1 },
           { iconId: "thermite", x: 60.5, y: 48.3 }
       ],
       createdAt: 1234567890,
       updatedAt: 1234567890
   }
   ```

3. **localStorage:**
   - Key: `r6champs_strategy_[id]`
   - Value: JSON string of strategy object
   - Persists until user clears browser data

**Why localStorage:**
- No server required
- No login needed
- Instant access
- Data stays private to user's browser

---

## Technical Details

### CSS Architecture

**Variables (at top of styles.css):**
```css
:root {
    --bg-primary: #000000;      /* Main background */
    --bg-secondary: #0a0a0a;    /* Card backgrounds */
    --accent-primary: #e63946;  /* Red accent color */
    /* ... more variables */
}
```

**Why CSS Variables:**
- Easy theme changes
- Consistent colors throughout
- Single point of modification

### Responsive Design

**Breakpoints:**
- `1024px` - Tablets (sidebar moves below map)
- `768px` - Mobile (stacked layout)
- `480px` - Small phones (full width)

### Performance Considerations

1. **Lazy Loading:** Map card images use `loading="lazy"`
2. **Debounced Resize:** Canvas resize uses debouncing
3. **Efficient Storage:** Only saves when content exists
4. **Minimal DOM:** Icons are only created when needed

### Security

1. **XSS Prevention:** All user input is escaped with `escapeHtml()`
2. **No Server:** All data stays client-side
3. **No Cookies:** Uses localStorage only

---

## Troubleshooting

### Icons Not Appearing

1. Check file is in `/Images/Icons/`
2. Verify it's a PNG file
3. Check filename matches the list in `strategies.js`
4. Check browser console for 404 errors

### Strategies Not Saving

1. Check browser allows localStorage
2. Check if storage is full (5MB limit)
3. Try clearing old strategies

### Canvas Not Drawing

1. Refresh the page
2. Check if you're on the correct floor
3. Verify no JavaScript errors in console

---

## Future Enhancements

Planned features (see Roadmap page):
- Strategy sharing via export/import
- More drawing tools (shapes, text)
- Lineups and angle measurements
- Mobile app version

---

## Support

For bugs or feature requests:
- Use the Bug Report page
- Use the Feature Request page
- Or contact through the Donate page

---

*Last Updated: February 2025*
*R6Champs - Made for the Rainbow Six Siege Community*
