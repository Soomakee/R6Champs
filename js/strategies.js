/**
 * ============================================================================
 * R6CHAMPS - STRATEGY MANAGEMENT SYSTEM
 * ============================================================================
 * 
 * DOCUMENTATION:
 * This file handles all strategy-related functionality including:
 * - Saving/loading strategies to localStorage
 * - Strategy sidebar UI management
 * - Icon placement system for custom operator icons
 * - Strategy editing and deletion
 * 
 * HOW IT WORKS:
 * 1. Strategies are stored in the browser's localStorage as JSON
 * 2. Each strategy contains: name, map, floor, canvas drawing data, and icon placements
 * 3. Icons are placed as draggable DOM elements on top of the map
 * 4. When saving, the canvas and icon positions are serialized
 * 
 * DATA STRUCTURE:
 * {
 *   id: string (unique identifier),
 *   name: string (strategy name),
 *   mapId: string (e.g., 'oregon'),
 *   floorId: string (e.g., 'basement'),
 *   canvasData: string (base64 image data),
 *   icons: [
 *     {
 *       iconId: string (icon filename),
 *       x: number (position %),
 *       y: number (position %)
 *     }
 *   ],
 *   createdAt: timestamp,
 *   updatedAt: timestamp
 * }
 * 
 * ADDING CUSTOM ICONS:
 * 1. Place your PNG icons in /Images/Icons/ folder
 * 2. Add the icon filename to the availableIcons array below
 * 3. Icons will automatically appear in the icon toolbar
 * ============================================================================
 */

// ============================================
// CONFIGURATION - ADD YOUR CUSTOM ICONS HERE
// ============================================

/**
 * List of available icons for strategy placement
 * Add icon filenames here (without .png) as you add PNG files to /Images/Icons/
 */
const AVAILABLE_ICONS = ['ash', 'lion', 'sledge'];

// ============================================
// STRATEGY STATE MANAGEMENT
// ============================================

/**
 * Global state for the strategy system
 * Tracks current strategy being edited, active icons, etc.
 */
const StrategyState = {
    currentStrategyId: null,      // ID of strategy being edited
    isEditMode: false,            // Whether we're editing a strategy
    placedIcons: [],              // Array of currently placed icon elements
    selectedIconId: null,         // Currently selected icon for placement
    isPlacingIcon: false,         // Whether we're in icon placement mode
    draggedIcon: null,            // Currently dragged icon element
    dragOffset: { x: 0, y: 0 },   // Offset for smooth dragging
    dragFromToolbar: false        // True while dragging from toolbar (so we don't trigger click)
};

// Storage key prefix for localStorage
const STORAGE_KEY_PREFIX = 'r6champs_strategy_';

// ============================================
// LOCALSTORAGE OPERATIONS
// ============================================

/**
 * Get all saved strategies from localStorage
 * @returns {Array} Array of strategy objects
 */
function getAllStrategies() {
    const strategies = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
            try {
                const strategy = JSON.parse(localStorage.getItem(key));
                strategies.push(strategy);
            } catch (e) {
                console.error('Error parsing strategy:', key, e);
            }
        }
    }
    // Sort by updated date (newest first)
    return strategies.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Get strategies filtered by map and floor
 * @param {string} mapId - Map identifier
 * @param {string} floorId - Floor identifier
 * @returns {Array} Filtered strategies
 */
function getStrategiesForFloor(mapId, floorId) {
    return getAllStrategies().filter(s => s.mapId === mapId && s.floorId === floorId);
}

/**
 * Save a strategy to localStorage
 * @param {Object} strategy - Strategy object to save
 */
function saveStrategyToStorage(strategy) {
    const key = STORAGE_KEY_PREFIX + strategy.id;
    localStorage.setItem(key, JSON.stringify(strategy));
}

/**
 * Delete a strategy from localStorage
 * @param {string} strategyId - ID of strategy to delete
 */
function deleteStrategyFromStorage(strategyId) {
    const key = STORAGE_KEY_PREFIX + strategyId;
    localStorage.removeItem(key);
}

/**
 * Generate a unique ID for new strategies
 * @returns {string} Unique identifier
 */
function generateStrategyId() {
    return 'strat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ============================================
// STRATEGY SIDEBAR UI
// ============================================

/**
 * Initialize the strategy sidebar for a map page
 * @param {string} mapId - Current map identifier
 * @param {Array} floors - Array of floor objects
 */
function initializeStrategySidebar(mapId, floors) {
    const sidebar = document.getElementById('strategy-sidebar');
    if (!sidebar) return;
    
    // Store current map info
    StrategyState.currentMapId = mapId;
    StrategyState.currentFloors = floors;
    
    // Build sidebar HTML
    sidebar.innerHTML = `
        <div class="sidebar-header">
            <div class="sidebar-title">Saved Strategies</div>
            <div class="sidebar-subtitle">Click to load, edit to modify</div>
        </div>
        <button class="new-strat-btn" id="new-strat-btn">
            <span>+</span> New Strategy
        </button>
        <div class="strategy-list" id="strategy-list">
            <div class="strategy-list-empty">No strategies saved yet</div>
        </div>
    `;
    
    // Attach event listener to new strategy button
    document.getElementById('new-strat-btn').addEventListener('click', createNewStrategy);
    
    // Initial render of strategy list
    renderStrategyList();
    
    // Listen for floor changes
    window.addEventListener('floorChanged', (e) => {
        renderStrategyList(e.detail.floorId);
    });
}

/**
 * Render the list of strategies for the current floor
 * @param {string} floorId - Optional floor ID to filter by
 */
function renderStrategyList(floorId) {
    const listContainer = document.getElementById('strategy-list');
    if (!listContainer) return;
    
    const currentFloor = floorId || getCurrentFloorId();
    const strategies = getStrategiesForFloor(StrategyState.currentMapId, currentFloor);
    
    if (strategies.length === 0) {
        listContainer.innerHTML = '<div class="strategy-list-empty">No strategies saved for this floor</div>';
        return;
    }
    
    listContainer.innerHTML = '';
    strategies.forEach(strategy => {
        const item = createStrategyListItem(strategy);
        listContainer.appendChild(item);
    });
}

/**
 * Create a strategy list item element
 * @param {Object} strategy - Strategy object
 * @returns {HTMLElement} List item element
 */
function createStrategyListItem(strategy) {
    const item = document.createElement('div');
    item.className = 'strategy-item';
    item.dataset.strategyId = strategy.id;
    
    // Format date
    const date = new Date(strategy.updatedAt);
    const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    item.innerHTML = `
        <div class="strategy-name">${escapeHtml(strategy.name)}</div>
        <div class="strategy-meta">
            <span class="strategy-floor">${strategy.floorId.toUpperCase()}</span>
            <span>${dateStr}</span>
        </div>
        <div class="strategy-actions">
            <button class="strat-action-btn load-btn">Load</button>
            <button class="strat-action-btn edit-btn">Edit</button>
            <button class="strat-action-btn delete delete-btn">Delete</button>
        </div>
    `;
    
    // Event listeners
    item.querySelector('.load-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        loadStrategy(strategy.id);
    });
    
    item.querySelector('.edit-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        enterEditMode(strategy.id);
    });
    
    item.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteStrategy(strategy.id);
    });
    
    // Click on item loads the strategy
    item.addEventListener('click', () => loadStrategy(strategy.id));
    
    return item;
}

// ============================================
// STRATEGY CRUD OPERATIONS
// ============================================

/**
 * Create a new strategy - prompts for name and enters edit mode
 */
function createNewStrategy() {
    const name = prompt('Enter strategy name:');
    if (!name || name.trim() === '') return;
    
    const strategy = {
        id: generateStrategyId(),
        name: name.trim(),
        mapId: StrategyState.currentMapId,
        floorId: getCurrentFloorId(),
        canvasData: null,
        icons: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    
    saveStrategyToStorage(strategy);
    renderStrategyList();
    enterEditMode(strategy.id);
}

/**
 * Load a strategy onto the map
 * @param {string} strategyId - ID of strategy to load
 */
function loadStrategy(strategyId, isForEditing = false) {
    const key = STORAGE_KEY_PREFIX + strategyId;
    const strategy = JSON.parse(localStorage.getItem(key));
    if (!strategy) return;
    
    // Switch to the correct floor if needed
    if (strategy.floorId !== getCurrentFloorId()) {
        switchFloor(strategy.floorId);
    }
    
    // Clear current state
    clearCanvas();
    clearPlacedIcons();
    
    // Load canvas drawing
    if (strategy.canvasData) {
        loadCanvasData(strategy.canvasData);
    }
    
    // Load icons
    if (strategy.icons && strategy.icons.length > 0) {
        strategy.icons.forEach(icon => placeIconOnMap(icon.iconId, icon.x, icon.y));
    }
    
    // Update UI
    StrategyState.currentStrategyId = strategyId;
    updateActiveStrategyItem(strategyId);
    
    // Exit edit mode if active, unless we are loading for edit
    if (!isForEditing) {
        exitEditMode();
    }
}

/**
 * Enter edit mode for a strategy
 * @param {string} strategyId - ID of strategy to edit
 */
function enterEditMode(strategyId) {
    StrategyState.isEditMode = true;
    StrategyState.currentStrategyId = strategyId;
    
    // Load the strategy for editing (pass true so loadStrategy doesn't call exitEditMode)
    loadStrategy(strategyId, true);
    
    // Show edit mode banner
    const banner = document.getElementById('edit-mode-banner');
    if (banner) banner.classList.add('active');
    
    // Update UI
    updateActiveStrategyItem(strategyId);
    
    // Show save button
    const saveBtn = document.getElementById('save-strat-btn');
    if (saveBtn) saveBtn.style.display = 'inline-flex';
    
    // Enable icon toolbar
    const iconToolbar = document.getElementById('icon-toolbar');
    if (iconToolbar) iconToolbar.style.display = 'flex';
}

/**
 * Exit edit mode
 */
function exitEditMode() {
    StrategyState.isEditMode = false;
    
    // Hide edit mode banner
    const banner = document.getElementById('edit-mode-banner');
    if (banner) banner.classList.remove('active');
    
    // Hide save button
    const saveBtn = document.getElementById('save-strat-btn');
    if (saveBtn) saveBtn.style.display = 'none';
    
    // Hide icon toolbar
    const iconToolbar = document.getElementById('icon-toolbar');
    if (iconToolbar) iconToolbar.style.display = 'none';
    
    // Deselect any selected icon
    StrategyState.selectedIconId = null;
    updateIconToolbarSelection();
}

/**
 * Save the current state to the active strategy
 */
function saveCurrentStrategy() {
    if (!StrategyState.currentStrategyId) return;
    
    const key = STORAGE_KEY_PREFIX + StrategyState.currentStrategyId;
    const strategy = JSON.parse(localStorage.getItem(key));
    if (!strategy) return;
    
    // Update strategy data
    strategy.canvasData = getCanvasData();
    strategy.icons = getPlacedIconsData();
    strategy.floorId = getCurrentFloorId();
    strategy.updatedAt = Date.now();
    
    saveStrategyToStorage(strategy);
    renderStrategyList();
    
    // Show confirmation
    alert('Strategy saved successfully!');
}

/**
 * Delete a strategy
 * @param {string} strategyId - ID of strategy to delete
 */
function deleteStrategy(strategyId) {
    if (!confirm('Are you sure you want to delete this strategy?')) return;
    
    deleteStrategyFromStorage(strategyId);
    
    // If we deleted the current strategy, clear the map
    if (StrategyState.currentStrategyId === strategyId) {
        clearCanvas();
        clearPlacedIcons();
        StrategyState.currentStrategyId = null;
        exitEditMode();
    }
    
    renderStrategyList();
}

// ============================================
// CANVAS DATA OPERATIONS
// ============================================

/**
 * Get current canvas data as base64 string
 * @returns {string|null} Base64 image data or null
 */
function getCanvasData() {
    const canvas = document.getElementById('drawing-canvas');
    if (!canvas) return null;
    
    // Check if canvas has any content
    const ctx = canvas.getContext('2d');
    const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const hasContent = pixelData.some(pixel => pixel !== 0);
    
    return hasContent ? canvas.toDataURL('image/png') : null;
}

/**
 * Load canvas data from base64 string
 * @param {string} dataUrl - Base64 image data
 */
function loadCanvasData(dataUrl) {
    const canvas = document.getElementById('drawing-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
        ctx.drawImage(img, 0, 0);
    };
    img.src = dataUrl;
}

// ============================================
// ICON PLACEMENT SYSTEM
// ============================================

/**
 * Initialize the icon toolbar with available icons
 */
function initializeIconToolbar() {
    const toolbar = document.getElementById('icon-toolbar');
    if (!toolbar) return;
    
    toolbar.innerHTML = '<span class="icon-toolbar-label">Operators:</span>';
    
    if (AVAILABLE_ICONS.length === 0) {
        const emptyMsg = document.createElement('span');
        emptyMsg.className = 'icon-toolbar-empty';
        emptyMsg.textContent = 'Add PNG files to Images/Icons and list them in strategies.js';
        toolbar.appendChild(emptyMsg);
        return;
    }
    
    AVAILABLE_ICONS.forEach(iconId => {
        const btn = document.createElement('button');
        btn.className = 'icon-btn';
        btn.dataset.iconId = iconId;
        btn.draggable = true;
        btn.title = iconId.charAt(0).toUpperCase() + iconId.slice(1) + ' – drag onto map or click then click map';
        
        const img = document.createElement('img');
        img.src = `../Images/Icons/${iconId}.png`;
        img.alt = iconId;
        img.draggable = false;
        img.onerror = () => {
            // If icon doesn't exist, show placeholder
            btn.innerHTML = `<span style="font-size: 10px; color: #666;">${iconId.substr(0, 3)}</span>`;
        };
        
        btn.appendChild(img);
        btn.addEventListener('dragstart', (e) => handleIconToolbarDragStart(e, iconId));
        btn.addEventListener('dragend', () => { StrategyState.dragFromToolbar = false; });
        btn.addEventListener('click', (e) => {
            if (StrategyState.dragFromToolbar) return;
            selectIconForPlacement(iconId);
        });
        toolbar.appendChild(btn);
    });
}

/**
 * Handle drag start from icon toolbar – set data for drop on map
 */
function handleIconToolbarDragStart(e, iconId) {
    if (!StrategyState.isEditMode) {
        e.preventDefault();
        return;
    }
    StrategyState.dragFromToolbar = true;
    e.dataTransfer.setData('text/plain', iconId);
    e.dataTransfer.effectAllowed = 'copy';
    const img = e.target.querySelector('img');
    if (img && img.complete) {
        e.dataTransfer.setDragImage(img, img.width / 2, img.height / 2);
    }
}

/**
 * Handle dragover on map container – allow drop and show feedback
 */
function handleMapDragOver(e) {
    if (!StrategyState.isEditMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    const container = e.currentTarget;
    if (container && !container.classList.contains('map-drop-target')) {
        container.classList.add('map-drop-target');
    }
}

/**
 * Handle drag leave – remove drop target styling when leaving map area
 */
function handleMapDragLeave(e) {
    const container = e.currentTarget;
    if (container && !container.contains(e.relatedTarget)) {
        container.classList.remove('map-drop-target');
    }
}

/**
 * Handle drop on map – place icon at drop position
 */
function handleMapDrop(e) {
    e.preventDefault();
    const container = e.currentTarget;
    container.classList.remove('map-drop-target');
    if (!StrategyState.isEditMode) return;
    const iconId = e.dataTransfer.getData('text/plain');
    if (!iconId) return;
    const rect = container.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    placeIconOnMap(iconId, x, y);
}

/**
 * Select an icon for placement on the map
 * @param {string} iconId - ID of icon to place
 */
function selectIconForPlacement(iconId) {
    if (!StrategyState.isEditMode) {
        alert('Create or edit a strategy to place icons');
        return;
    }
    
    StrategyState.selectedIconId = iconId;
    StrategyState.isPlacingIcon = true;
    updateIconToolbarSelection();
    
    // Change cursor to indicate placement mode
    const mapContainer = document.getElementById('map-image-container');
    if (mapContainer) {
        mapContainer.style.cursor = 'copy';
    }
}

/**
 * Update icon toolbar to show selected icon
 */
function updateIconToolbarSelection() {
    document.querySelectorAll('.icon-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.iconId === StrategyState.selectedIconId);
    });
}

/**
 * Place an icon on the map at specified position
 * @param {string} iconId - Icon identifier
 * @param {number} x - X position (0-100 percentage)
 * @param {number} y - Y position (0-100 percentage)
 * @returns {HTMLElement} The placed icon element
 */
function placeIconOnMap(iconId, x, y) {
    const container = document.getElementById('map-image-container');
    if (!container) return null;
    
    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'placed-icon';
    iconWrapper.dataset.iconId = iconId;
    iconWrapper.style.left = x + '%';
    iconWrapper.style.top = y + '%';
    
    const img = document.createElement('img');
    img.src = `../Images/Icons/${iconId}.png`;
    img.alt = iconId;
    img.onerror = () => {
        // Fallback if icon doesn't exist
        iconWrapper.innerHTML = `<div style="width: 32px; height: 32px; background: #e63946; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; color: white;">${iconId.substr(0, 3).toUpperCase()}</div>`;
    };
    
    // Delete button (only visible in edit mode)
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'icon-delete-btn';
    deleteBtn.innerHTML = '×';
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (StrategyState.isEditMode) {
            iconWrapper.remove();
        }
    });
    
    iconWrapper.appendChild(img);
    iconWrapper.appendChild(deleteBtn);
    
    // Make draggable in edit mode
    if (StrategyState.isEditMode) {
        makeIconDraggable(iconWrapper);
    }
    
    container.appendChild(iconWrapper);
    StrategyState.placedIcons.push(iconWrapper);
    
    return iconWrapper;
}

/**
 * Make an icon element draggable
 * @param {HTMLElement} iconElement - Icon element to make draggable
 */
function makeIconDraggable(iconElement) {
    let isDragging = false;
    
    iconElement.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('icon-delete-btn')) return;
        
        isDragging = true;
        StrategyState.draggedIcon = iconElement;
        
        const rect = iconElement.getBoundingClientRect();
        StrategyState.dragOffset.x = e.clientX - rect.left;
        StrategyState.dragOffset.y = e.clientY - rect.top;
        
        iconElement.classList.add('selected');
        e.preventDefault();
    });
    
    document.addEventListener('mousemove', (e) => {
        if (!isDragging || !StrategyState.draggedIcon) return;
        
        const container = document.getElementById('map-image-container');
        const containerRect = container.getBoundingClientRect();
        
        let x = e.clientX - containerRect.left - StrategyState.dragOffset.x + 16;
        let y = e.clientY - containerRect.top - StrategyState.dragOffset.y + 16;
        
        // Convert to percentage
        const xPercent = (x / containerRect.width) * 100;
        const yPercent = (y / containerRect.height) * 100;
        
        // Clamp to container bounds
        iconElement.style.left = Math.max(0, Math.min(95, xPercent)) + '%';
        iconElement.style.top = Math.max(0, Math.min(95, yPercent)) + '%';
    });
    
    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            if (StrategyState.draggedIcon) {
                StrategyState.draggedIcon.classList.remove('selected');
                StrategyState.draggedIcon = null;
            }
        }
    });
}

/**
 * Handle map click for icon placement
 * @param {MouseEvent} e - Click event
 */
function handleMapClickForIcon(e) {
    if (!StrategyState.isEditMode || !StrategyState.isPlacingIcon || !StrategyState.selectedIconId) {
        return;
    }
    
    const container = document.getElementById('map-image-container');
    const rect = container.getBoundingClientRect();
    
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    
    placeIconOnMap(StrategyState.selectedIconId, x, y);
    
    // Reset placement mode
    StrategyState.isPlacingIcon = false;
    StrategyState.selectedIconId = null;
    container.style.cursor = 'default';
    updateIconToolbarSelection();
}

/**
 * Get data for all placed icons
 * @returns {Array} Array of icon data objects
 */
function getPlacedIconsData() {
    return StrategyState.placedIcons.map(icon => ({
        iconId: icon.dataset.iconId,
        x: parseFloat(icon.style.left),
        y: parseFloat(icon.style.top)
    }));
}

/**
 * Clear all placed icons from the map
 */
function clearPlacedIcons() {
    StrategyState.placedIcons.forEach(icon => icon.remove());
    StrategyState.placedIcons = [];
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Update the active state of strategy list items
 * @param {string} strategyId - ID of active strategy
 */
function updateActiveStrategyItem(strategyId) {
    document.querySelectorAll('.strategy-item').forEach(item => {
        item.classList.toggle('active', item.dataset.strategyId === strategyId);
    });
}

// ============================================
// SAVE MODAL
// ============================================

/**
 * Show the save strategy modal
 */
function showSaveModal() {
    const modal = document.getElementById('save-modal');
    if (modal) {
        modal.classList.add('active');
        document.getElementById('strategy-name-input').focus();
    }
}

/**
 * Hide the save strategy modal
 */
function hideSaveModal() {
    const modal = document.getElementById('save-modal');
    if (modal) {
        modal.classList.remove('active');
        document.getElementById('strategy-name-input').value = '';
    }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    // Initialize icon toolbar
    initializeIconToolbar();
    
    // Attach map click and drag-drop handlers for icon placement
    const mapContainer = document.getElementById('map-image-container');
    if (mapContainer) {
        mapContainer.addEventListener('click', handleMapClickForIcon);
        mapContainer.addEventListener('dragover', handleMapDragOver);
        mapContainer.addEventListener('dragleave', handleMapDragLeave);
        mapContainer.addEventListener('drop', handleMapDrop);
    }
    
    // Save strategy button
    const saveBtn = document.getElementById('save-strat-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveCurrentStrategy);
    }
    
    // Modal buttons
    const confirmSaveBtn = document.getElementById('confirm-save-btn');
    const cancelSaveBtn = document.getElementById('cancel-save-btn');
    
    if (confirmSaveBtn) {
        confirmSaveBtn.addEventListener('click', () => {
            const name = document.getElementById('strategy-name-input').value.trim();
            if (name) {
                saveCurrentStrategy();
                hideSaveModal();
            }
        });
    }
    
    if (cancelSaveBtn) {
        cancelSaveBtn.addEventListener('click', hideSaveModal);
    }
    
    // Close modal on overlay click
    const modal = document.getElementById('save-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hideSaveModal();
        });
    }
});

// ============================================
// EXPORTS
// ============================================

window.StrategyManager = {
    initialize: initializeStrategySidebar,
    createNew: createNewStrategy,
    load: loadStrategy,
    save: saveCurrentStrategy,
    delete: deleteStrategy,
    enterEditMode,
    exitEditMode,
    getAll: getAllStrategies,
    getForFloor: getStrategiesForFloor,
    placeIcon: placeIconOnMap,
    clearIcons: clearPlacedIcons,
    isEditMode: () => StrategyState.isEditMode,
    getCurrentStrategyId: () => StrategyState.currentStrategyId
};
