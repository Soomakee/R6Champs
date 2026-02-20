/**
 * ============================================
 * TACTICAL FPS MAP REFERENCE TOOL - MAIN.JS
 * ============================================
 * 
 * Handles:
 * - Floor tab switching
 * - Image loading
 * - Navigation behavior
 * - Canvas initialization per floor
 */

// ============================================
// FLOOR TAB SWITCHING
// ============================================

/**
 * Initialize floor tabs for a map page
 * @param {string} mapName - The name of the current map (e.g., 'oregon')
 * @param {Array} floors - Array of floor objects with id and image properties
 */
function initializeFloorTabs(mapName, floors) {
    const tabContainer = document.getElementById('floor-tabs');
    const imageContainer = document.getElementById('map-image-container');
    
    if (!tabContainer || !imageContainer) return;
    
    // Store floor data globally for this page
    window.currentMapFloors = floors;
    window.currentMapName = mapName;
    
    // Create tab buttons
    floors.forEach((floor, index) => {
        const tabBtn = document.createElement('button');
        tabBtn.className = `floor-tab ${index === 0 ? 'active' : ''}`;
        tabBtn.dataset.floorId = floor.id;
        tabBtn.textContent = floor.label;
        tabBtn.addEventListener('click', () => switchFloor(floor.id));
        tabContainer.appendChild(tabBtn);
    });
    
    // Create image elements for each floor
    floors.forEach((floor, index) => {
        const img = document.createElement('img');
        img.id = `floor-image-${floor.id}`;
        img.className = `floor-image ${index === 0 ? 'active' : ''}`;
        img.src = floor.image;
        img.alt = `${mapName} - ${floor.label}`;
        img.dataset.floorId = floor.id;
        imageContainer.appendChild(img);
    });
    
    // Initialize canvas for the first floor
    if (typeof initializeDrawingCanvas === 'function') {
        initializeDrawingCanvas(floors[0].id);
    }
}

/**
 * Switch to a different floor
 * @param {string} floorId - The ID of the floor to switch to
 */
function switchFloor(floorId) {
    // Update active tab
    const tabs = document.querySelectorAll('.floor-tab');
    tabs.forEach(tab => {
        if (tab.dataset.floorId === floorId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Update active image
    const images = document.querySelectorAll('.floor-image');
    images.forEach(img => {
        if (img.dataset.floorId === floorId) {
            img.classList.add('active');
        } else {
            img.classList.remove('active');
        }
    });
    
    // Reinitialize canvas for the new floor
    if (typeof initializeDrawingCanvas === 'function') {
        initializeDrawingCanvas(floorId);
    }
    
    // Dispatch custom event for floor change
    window.dispatchEvent(new CustomEvent('floorChanged', { detail: { floorId } }));
}

// ============================================
// NAVIGATION
// ============================================

/**
 * Navigate to a map page
 * @param {string} mapName - The name of the map to navigate to
 */
function navigateToMap(mapName) {
    window.location.href = `Pages/${mapName}.html`;
}

/**
 * Navigate to homepage
 */
function navigateToHome() {
    window.location.href = 'index.html';
}

/**
 * Go back to previous page
 */
function goBack() {
    window.history.back();
}

// ============================================
// MAP CONFIG – single source of truth
// ============================================

/**
 * All maps in the game. Add new maps here when they release.
 * Fortress is placeholder until map/blueprints are available.
 */
const ALL_MAPS = [
    { id: 'Bank', name: 'Bank', image: 'Images/MapCards/Bank.webp', meta: 'Financial District' },
    { id: 'Border', name: 'Border', image: 'Images/MapCards/Border.webp', meta: 'Border Crossing' },
    { id: 'Chalet', name: 'Chalet', image: 'Images/MapCards/Chalet.webp', meta: 'Mountain Retreat' },
    { id: 'Clubhouse', name: 'Clubhouse', image: 'Images/MapCards/Clubhouse.webp', meta: 'Biker Club' },
    { id: 'Coastline', name: 'Coastline', image: 'Images/MapCards/Coastline.webp', meta: 'Ibiza Resort' },
    { id: 'Consulate', name: 'Consulate', image: 'Images/MapCards/Consulate.webp', meta: 'French Embassy' },
    { id: 'Emerald Plains', name: 'Emerald Plains', image: 'Images/MapCards/Emerald Plains.webp', meta: 'Forest' },
    { id: 'Fortress', name: 'Fortress', image: 'Images/MapCards/Bank.webp', meta: 'Coming soon' },
    { id: 'Kafe', name: 'Kafe', image: 'Images/MapCards/Kafe Dostoyevsky.webp', meta: 'Russian Cafe' },
    { id: 'Kanal', name: 'Kanal', image: 'Images/MapCards/Kanal.webp', meta: 'Industrial Harbor' },
    { id: 'Lair', name: 'Lair', image: 'Images/MapCards/Lair.webp', meta: 'Underground Base' },
    { id: 'Nighthaven', name: 'Nighthaven', image: 'Images/MapCards/Nighthaven Labs.webp', meta: 'Labs' },
    { id: 'Oregon', name: 'Oregon', image: 'Images/MapCards/Oregon.webp', meta: 'Country House' },
    { id: 'Outback', name: 'Outback', image: 'Images/MapCards/Outback.webp', meta: 'Australian Pub' },
    { id: 'Skyscraper', name: 'Skyscraper', image: 'Images/MapCards/Skyscraper.webp', meta: 'Skyscraper' },
    { id: 'Theme Park', name: 'Theme Park', image: 'Images/MapCards/Theme Park.webp', meta: 'Amusement Park' },
    { id: 'Villa', name: 'Villa', image: 'Images/MapCards/Villa.webp', meta: 'Italian Estate' }
];

/**
 * Map IDs currently in the ranked rotation (alphabetical). Homepage shows these by default.
 * When Ubisoft changes the ranked pool: add IDs to include a map, remove IDs to drop it.
 * Use exact id from ALL_MAPS (e.g. 'Emerald Plains', 'Theme Park').
 */
const RANKED_ROTATION_IDS = [
    'Bank', 'Border', 'Chalet', 'Coastline', 'Consulate',
    'Fortress', 'Kafe', 'Kanal', 'Lair', 'Nighthaven', 'Oregon', 'Outback',
    'Skyscraper', 'Theme Park', 'Villa'
];

// ============================================
// MAP CARD INITIALIZATION
// ============================================

/**
 * Get maps to display based on filter. Ranked only = default; showAll = every map.
 * @param {boolean} showAll - If true, return ALL_MAPS; otherwise only ranked rotation
 * @returns {Array} Map objects to render
 */
function getMapsForView(showAll) {
    if (showAll) return [...ALL_MAPS];
    return ALL_MAPS.filter(m => RANKED_ROTATION_IDS.includes(m.id));
}

/**
 * Initialize map cards on the homepage (appends to existing grid).
 * @param {Array} maps - Array of map objects with name and image properties
 */
function initializeMapCards(maps) {
    const gridContainer = document.getElementById('map-grid');
    if (!gridContainer) return;
    
    maps.forEach(map => {
        const card = createMapCard(map);
        gridContainer.appendChild(card);
    });
}

/**
 * Re-render the homepage map grid with the given filter.
 * @param {boolean} showAll - If true, show all maps; if false, ranked rotation only
 */
function renderMapGrid(showAll) {
    const gridContainer = document.getElementById('map-grid');
    if (!gridContainer) return;
    gridContainer.innerHTML = '';
    initializeMapCards(getMapsForView(showAll));
}

/**
 * Create a map card element with overlay text effect
 * @param {Object} map - Map object with name, image, and meta properties
 * @returns {HTMLElement} The created card element
 */
function createMapCard(map) {
    const card = document.createElement('div');
    card.className = 'map-card';
    card.addEventListener('click', () => {
        window.location.href = `Pages/${map.id}.html`;
    });
    
    // Image container with overlay
    const imageContainer = document.createElement('div');
    imageContainer.className = 'map-card-image-container';
    
    const img = document.createElement('img');
    img.className = 'map-card-image';
    img.src = map.image;
    img.alt = map.name;
    img.loading = 'lazy';
    
    // Overlay with text
    const overlay = document.createElement('div');
    overlay.className = 'map-card-overlay';
    
    const title = document.createElement('h3');
    title.className = 'map-card-title';
    title.textContent = map.name;
    
    overlay.appendChild(title);
    imageContainer.appendChild(img);
    imageContainer.appendChild(overlay);
    card.appendChild(imageContainer);
    
    return card;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Preload an image
 * @param {string} src - Image source URL
 * @returns {Promise} Resolves when image is loaded
 */
function preloadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

/**
 * Debounce function for performance
 * @param {Function} func - Function to debounce
 * @param {number} wait - Milliseconds to wait
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Get current active floor ID
 * @returns {string|null} The current floor ID
 */
function getCurrentFloorId() {
    const activeTab = document.querySelector('.floor-tab.active');
    return activeTab ? activeTab.dataset.floorId : null;
}

// ============================================
// INITIALIZATION
// ============================================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Homepage: map grid + ranked/all filter
    const mapGrid = document.getElementById('map-grid');
    if (mapGrid) {
        let showAllMaps = false;
        renderMapGrid(showAllMaps);

        const filterBtn = document.getElementById('map-filter-btn');
        const filterLabel = document.getElementById('map-filter-label');
        const filterCaption = document.getElementById('map-filter-caption-text');
        const pageTitle = document.getElementById('map-page-title');
        if (filterBtn && filterLabel && filterCaption) {
            const updateTitle = () => {
                if (pageTitle) {
                    pageTitle.textContent = showAllMaps ? 'All Maps' : 'Ranked Rotation';
                }
            };
            updateTitle();
            filterBtn.addEventListener('click', () => {
                showAllMaps = !showAllMaps;
                renderMapGrid(showAllMaps);
                filterCaption.textContent = showAllMaps ? 'All maps' : 'Ranked rotation';
                filterLabel.textContent = showAllMaps ? 'Show ranked only' : 'Show all maps';
                filterBtn.setAttribute('aria-pressed', showAllMaps);
                updateTitle();
            });
        }
    }
    
    // Check if we're on a map page
    const floorTabs = document.getElementById('floor-tabs');
    if (floorTabs && window.mapFloorsData) {
        initializeFloorTabs(window.mapName || 'map', window.mapFloorsData);
    }
});

// Export functions for use in other scripts
window.MapTool = {
    switchFloor,
    navigateToMap,
    navigateToHome,
    goBack,
    getCurrentFloorId,
    preloadImage,
    debounce
};
