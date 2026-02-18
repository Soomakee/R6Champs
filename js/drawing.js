/**
 * ============================================
 * TACTICAL FPS MAP REFERENCE TOOL - DRAWING.JS
 * ============================================
 * 
 * Handles:
 * - Canvas overlay management
 * - Pencil drawing tool
 * - Eraser tool
 * - Adjustable brush size
 * - Clear canvas functionality
 * - Drawing state management per floor
 */

// ============================================
// DRAWING STATE
// ============================================

const DrawingState = {
    currentTool: 'pencil',  // 'pencil' or 'eraser'
    brushSize: 4,
    brushColor: '#e63946',  // Default R6 red color
    isDrawing: false,
    lastX: 0,
    lastY: 0,
    currentFloorId: null,
    canvasContexts: new Map(), // Store canvas contexts per floor
    canvasHistory: new Map()   // Store canvas history per floor
};

// ============================================
// CANVAS INITIALIZATION
// ============================================

/**
 * Initialize the drawing canvas for a specific floor
 * @param {string} floorId - The floor ID to initialize canvas for
 */
function initializeDrawingCanvas(floorId) {
    const container = document.getElementById('map-image-container');
    if (!container) return;
    
    // Remove any existing canvas
    const existingCanvas = document.getElementById('drawing-canvas');
    if (existingCanvas) {
        existingCanvas.remove();
    }
    
    // Get the active image dimensions
    const activeImage = container.querySelector('.floor-image.active');
    if (!activeImage) return;
    
    // Wait for image to load to get correct dimensions
    const setupCanvas = () => {
        const rect = activeImage.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Create canvas element
        const canvas = document.createElement('canvas');
        canvas.id = 'drawing-canvas';
        canvas.className = 'drawing-canvas';
        canvas.width = rect.width;
        canvas.height = rect.height;
        
        // Position canvas over the image
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
        canvas.style.left = `${rect.left - containerRect.left}px`;
        canvas.style.top = `${rect.top - containerRect.top}px`;
        
        // Insert canvas into container
        container.appendChild(canvas);
        
        // Get context and set up drawing
        const ctx = canvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = DrawingState.brushColor;
        ctx.lineWidth = DrawingState.brushSize;
        
        // Store context for this floor
        DrawingState.canvasContexts.set(floorId, ctx);
        DrawingState.currentFloorId = floorId;
        
        // Restore previous drawing if exists
        restoreCanvasState(floorId, canvas);
        
        // Attach event listeners
        attachDrawingEvents(canvas);
    };
    
    if (activeImage.complete) {
        setupCanvas();
    } else {
        activeImage.onload = setupCanvas;
    }
}

/**
 * Restore canvas state from history
 * @param {string} floorId - Floor ID to restore
 * @param {HTMLCanvasElement} canvas - Canvas element
 */
function restoreCanvasState(floorId, canvas) {
    const savedData = DrawingState.canvasHistory.get(floorId);
    if (savedData) {
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => {
            ctx.drawImage(img, 0, 0);
        };
        img.src = savedData;
    }
}

/**
 * Save current canvas state to history
 * @param {string} floorId - Floor ID to save
 */
function saveCanvasState(floorId) {
    const canvas = document.getElementById('drawing-canvas');
    if (canvas) {
        DrawingState.canvasHistory.set(floorId, canvas.toDataURL());
    }
}

// ============================================
// DRAWING EVENTS
// ============================================

/**
 * Attach drawing event listeners to canvas
 * @param {HTMLCanvasElement} canvas - Canvas element
 */
function attachDrawingEvents(canvas) {
    // Mouse events
    canvas.addEventListener('mousedown', handleDrawStart);
    canvas.addEventListener('mousemove', handleDrawMove);
    canvas.addEventListener('mouseup', handleDrawEnd);
    canvas.addEventListener('mouseout', handleDrawEnd);
    
    // Touch events for mobile support
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleDrawEnd);
    
    // Prevent context menu on right click
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

/**
 * Get mouse position relative to canvas
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {MouseEvent|Touch} event - Mouse or touch event
 * @returns {Object} x and y coordinates
 */
function getCanvasCoordinates(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const clientX = event.clientX || (event.touches && event.touches[0].clientX);
    const clientY = event.clientY || (event.touches && event.touches[0].clientY);
    
    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
}

/**
 * Handle drawing start
 * @param {MouseEvent|TouchEvent} e - Event object
 */
function handleDrawStart(e) {
    e.preventDefault();
    const canvas = document.getElementById('drawing-canvas');
    if (!canvas) return;
    
    const coords = getCanvasCoordinates(canvas, e);
    DrawingState.isDrawing = true;
    DrawingState.lastX = coords.x;
    DrawingState.lastY = coords.y;
    
    // Draw a single dot for click
    draw(coords.x, coords.y, coords.x, coords.y);
}

/**
 * Handle touch start
 * @param {TouchEvent} e - Touch event object
 */
function handleTouchStart(e) {
    e.preventDefault();
    handleDrawStart(e);
}

/**
 * Handle drawing move
 * @param {MouseEvent|TouchEvent} e - Event object
 */
function handleDrawMove(e) {
    if (!DrawingState.isDrawing) return;
    e.preventDefault();
    
    const canvas = document.getElementById('drawing-canvas');
    if (!canvas) return;
    
    const coords = getCanvasCoordinates(canvas, e);
    draw(DrawingState.lastX, DrawingState.lastY, coords.x, coords.y);
    
    DrawingState.lastX = coords.x;
    DrawingState.lastY = coords.y;
}

/**
 * Handle touch move
 * @param {TouchEvent} e - Touch event object
 */
function handleTouchMove(e) {
    handleDrawMove(e);
}

/**
 * Handle drawing end
 * @param {MouseEvent|TouchEvent} e - Event object
 */
function handleDrawEnd(e) {
    if (DrawingState.isDrawing) {
        DrawingState.isDrawing = false;
        // Save canvas state when drawing ends
        saveCanvasState(DrawingState.currentFloorId);
    }
}

/**
 * Draw a line on the canvas
 * @param {number} x1 - Start X coordinate
 * @param {number} y1 - Start Y coordinate
 * @param {number} x2 - End X coordinate
 * @param {number} y2 - End Y coordinate
 */
function draw(x1, y1, x2, y2) {
    const canvas = document.getElementById('drawing-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    
    if (DrawingState.currentTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = DrawingState.brushSize * 2;
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = DrawingState.brushColor;
        ctx.lineWidth = DrawingState.brushSize;
    }
    
    ctx.stroke();
    ctx.closePath();
}

// ============================================
// TOOL CONTROLS
// ============================================

/**
 * Set the current drawing tool
 * @param {string} tool - 'pencil' or 'eraser'
 */
function setTool(tool) {
    DrawingState.currentTool = tool;
    
    // Update UI
    const pencilBtn = document.getElementById('tool-pencil');
    const eraserBtn = document.getElementById('tool-eraser');
    
    if (pencilBtn) {
        pencilBtn.classList.toggle('active', tool === 'pencil');
    }
    if (eraserBtn) {
        eraserBtn.classList.toggle('active', tool === 'eraser');
    }
    
    // Update cursor
    const canvas = document.getElementById('drawing-canvas');
    if (canvas) {
        canvas.style.cursor = tool === 'eraser' ? 'cell' : 'crosshair';
    }
}

/**
 * Set the brush size
 * @param {number} size - Brush size in pixels
 */
function setBrushSize(size) {
    DrawingState.brushSize = parseInt(size, 10);
    updateBrushPreview();
}

/**
 * Set the brush color
 * @param {string} color - Hex color code
 */
function setBrushColor(color) {
    DrawingState.brushColor = color;
}

/**
 * Update brush preview display
 */
function updateBrushPreview() {
    const preview = document.getElementById('brush-dot');
    if (preview) {
        preview.style.width = `${DrawingState.brushSize}px`;
        preview.style.height = `${DrawingState.brushSize}px`;
    }
    
    const sizeDisplay = document.getElementById('brush-size-display');
    if (sizeDisplay) {
        sizeDisplay.textContent = `${DrawingState.brushSize}px`;
    }
}

/**
 * Clear the current canvas
 */
function clearCanvas() {
    const canvas = document.getElementById('drawing-canvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Clear saved state for this floor
    if (DrawingState.currentFloorId) {
        DrawingState.canvasHistory.delete(DrawingState.currentFloorId);
    }
}

// ============================================
// TOOLBAR INITIALIZATION
// ============================================

/**
 * Initialize the drawing toolbar
 */
function initializeDrawingToolbar() {
    // Pencil button
    const pencilBtn = document.getElementById('tool-pencil');
    if (pencilBtn) {
        pencilBtn.addEventListener('click', () => setTool('pencil'));
    }
    
    // Eraser button
    const eraserBtn = document.getElementById('tool-eraser');
    if (eraserBtn) {
        eraserBtn.addEventListener('click', () => setTool('eraser'));
    }
    
    // Brush size slider
    const brushSlider = document.getElementById('brush-size');
    if (brushSlider) {
        brushSlider.addEventListener('input', (e) => {
            setBrushSize(e.target.value);
        });
    }
    
    // Color picker
    const colorPicker = document.getElementById('brush-color');
    if (colorPicker) {
        colorPicker.addEventListener('input', (e) => {
            setBrushColor(e.target.value);
        });
    }
    
    // Clear button
    const clearBtn = document.getElementById('tool-clear');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearCanvas);
    }
    
    // Set initial tool
    setTool('pencil');
    updateBrushPreview();
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================

document.addEventListener('keydown', (e) => {
    // P for pencil
    if (e.key === 'p' || e.key === 'P') {
        setTool('pencil');
    }
    // E for eraser
    else if (e.key === 'e' || e.key === 'E') {
        setTool('eraser');
    }
    // Delete or C for clear
    else if (e.key === 'Delete' || e.key === 'c' || e.key === 'C') {
        if (e.ctrlKey || e.key === 'Delete') {
            clearCanvas();
        }
    }
});

// ============================================
// WINDOW RESIZE HANDLING
// ============================================

let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        // Reinitialize canvas on resize to match new image dimensions
        if (DrawingState.currentFloorId) {
            saveCanvasState(DrawingState.currentFloorId);
            initializeDrawingCanvas(DrawingState.currentFloorId);
        }
    }, 250);
});

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    initializeDrawingToolbar();
});

// Export functions for use in other scripts
window.DrawingTool = {
    setTool,
    setBrushSize,
    setBrushColor,
    clearCanvas,
    initializeDrawingCanvas,
    getState: () => ({ ...DrawingState })
};
