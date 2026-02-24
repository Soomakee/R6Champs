/**
 * ============================================
 * R6CHAMPS - BLUEPRINT ZOOM & PAN
 * ============================================
 * Zoom in/out on map blueprints and pan when zoomed.
 * Run on map pages only (requires #map-image-container and #map-zoom-pan-wrapper).
 */

const ZoomState = {
    scale: 1,
    minScale: 0.5,
    maxScale: 3,
    panX: 0,
    panY: 0,
    isPanning: false,
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0
};

function getZoomWrapper() {
    return document.getElementById('map-zoom-pan-wrapper');
}

function getMapContainer() {
    return document.getElementById('map-image-container');
}

/**
 * Apply current scale and pan to the wrapper
 */
function applyZoomTransform() {
    const wrapper = getZoomWrapper();
    if (!wrapper) return;
    const { scale, panX, panY } = ZoomState;
    wrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
}

/**
 * Zoom in one step
 */
function zoomIn() {
    ZoomState.scale = Math.min(ZoomState.maxScale, ZoomState.scale + 0.25);
    if (ZoomState.scale === 1) {
        ZoomState.panX = 0;
        ZoomState.panY = 0;
    }
    applyZoomTransform();
}

/**
 * Zoom out one step
 */
function zoomOut() {
    ZoomState.scale = Math.max(ZoomState.minScale, ZoomState.scale - 0.25);
    if (ZoomState.scale === 1) {
        ZoomState.panX = 0;
        ZoomState.panY = 0;
    }
    applyZoomTransform();
}

/**
 * Reset zoom and pan to default
 */
function resetZoom() {
    ZoomState.scale = 1;
    ZoomState.panX = 0;
    ZoomState.panY = 0;
    applyZoomTransform();
}

/**
 * Get current scale (for drawing coordinate conversion)
 */
function getZoomScale() {
    return ZoomState.scale;
}

/**
 * Create and inject zoom control buttons
 */
function createZoomControls() {
    const container = getMapContainer();
    if (!container) return;
    if (document.getElementById('zoom-controls')) return;

    const controls = document.createElement('div');
    controls.id = 'zoom-controls';
    controls.className = 'zoom-controls';
    controls.innerHTML = `
        <button type="button" class="zoom-btn" id="zoom-in-btn" title="Zoom in" aria-label="Zoom in">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </button>
        <button type="button" class="zoom-btn" id="zoom-out-btn" title="Zoom out" aria-label="Zoom out">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M19 13H5v-2h14v2z"/></svg>
        </button>
        <button type="button" class="zoom-btn" id="zoom-reset-btn" title="Reset zoom" aria-label="Reset zoom">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/></svg>
        </button>
    `;

    const parent = container.closest('.map-display-container');
    if (parent) parent.appendChild(controls);

    document.getElementById('zoom-in-btn').addEventListener('click', zoomIn);
    document.getElementById('zoom-out-btn').addEventListener('click', zoomOut);
    document.getElementById('zoom-reset-btn').addEventListener('click', resetZoom);
}

/**
 * Pan: mouse drag when zoomed
 */
function initPan() {
    const container = getMapContainer();
    if (!container) return;

    container.addEventListener('mousedown', (e) => {
        if (ZoomState.scale <= 1) return;
        if (e.target.closest('.zoom-controls') || e.target.closest('.zoom-btn')) return;
        if (e.target.closest('.placed-icon')) return;
        if (e.target.id === 'drawing-canvas') return; // don't pan when interacting with canvas
        if (e.button !== 0) return;
        ZoomState.isPanning = true;
        ZoomState.startX = e.clientX;
        ZoomState.startY = e.clientY;
        ZoomState.startPanX = ZoomState.panX;
        ZoomState.startPanY = ZoomState.panY;
    });

    document.addEventListener('mousemove', (e) => {
        if (!ZoomState.isPanning) return;
        ZoomState.panX = ZoomState.startPanX + (e.clientX - ZoomState.startX);
        ZoomState.panY = ZoomState.startPanY + (e.clientY - ZoomState.startY);
        applyZoomTransform();
    });

    document.addEventListener('mouseup', () => {
        ZoomState.isPanning = false;
    });
}

/**
 * Optional: Ctrl+wheel to zoom
 */
function initWheelZoom() {
    const container = getMapContainer();
    if (!container) return;

    container.addEventListener('wheel', (e) => {
        if (!e.ctrlKey) return;
        e.preventDefault();
        if (e.deltaY < 0) zoomIn();
        else zoomOut();
    }, { passive: false });
}

document.addEventListener('DOMContentLoaded', () => {
    if (!getZoomWrapper()) return;
    createZoomControls();
    initPan();
    initWheelZoom();
    window.addEventListener('floorChanged', resetZoom);
});

window.BlueprintZoom = {
    zoomIn,
    zoomOut,
    resetZoom,
    getScale: getZoomScale
};
