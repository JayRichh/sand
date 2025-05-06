// Remove the event listeners since we're calling initializeSimulation directly from index.html
// This prevents potential double-initialization issues
// document.addEventListener('DOMContentLoaded', () => {
//     window.addEventListener('load', initializeSimulation);
// });

function initializeSimulation() {
    try {
        console.log('Starting application initialization...');
        
        // Get the canvas element
        const canvas = document.getElementById('simulation');
        if (!canvas) {
            console.error('Canvas element not found');
            return;
        }
        
        // Verify the canvas is ready and has a 2D context
        const testCtx = canvas.getContext('2d');
        if (!testCtx) {
            console.error('2D context not available on canvas');
            return;
        }
        
        // Initialize materials
        console.log('Initializing materials...');
        const materials = new Materials();
        
        // Create engine with improved error handling
        console.log('Creating simulation engine...');
        let engine;
        try {
            engine = new SimulationEngine(canvas, materials);
        } catch (e) {
            console.error('Failed to initialize simulation engine:', e);
            showFallbackMessage();
            return;
        }
        
        if (!engine) {
            console.error('Engine creation failed');
            showFallbackMessage();
            return;
        }
        
        // Set up tool manager
        console.log('Setting up tool manager...');
        const toolManager = new ToolManager(engine, canvas);
        
        // Create initial sandbox environment
        console.log('Creating sandbox environment...');
        createSandbox(engine);
        
        // Log initialization success
        console.log('Sand Simulator Initialized');
        console.log('Controls:');
        console.log('- Materials: 1-6 number keys or toolbar buttons');
        console.log('- Tools: D (draw), E (erase), F (fire)');
        console.log('- Clear: C key or clear button');
        console.log('- Pause/Resume: Space key or pause button');
        console.log('- Brush Size: [ and ] keys or slider');
        
    } catch (error) {
        // Global error handling
        console.error('Failed to initialize application:', error);
        showFallbackMessage();
    }
}

// Shows a message when the application can't load
function showFallbackMessage() {
    // Only display if an error element doesn't already exist
    if (!document.getElementById('error-message')) {
        const errorDiv = document.createElement('div');
        errorDiv.id = 'error-message';
        errorDiv.style.position = 'fixed';
        errorDiv.style.top = '50%';
        errorDiv.style.left = '50%';
        errorDiv.style.transform = 'translate(-50%, -50%)';
        errorDiv.style.background = 'rgba(0,0,0,0.8)';
        errorDiv.style.color = 'white';
        errorDiv.style.padding = '20px';
        errorDiv.style.borderRadius = '5px';
        errorDiv.style.maxWidth = '80%';
        errorDiv.style.textAlign = 'center';
        errorDiv.style.zIndex = '1000';
        errorDiv.style.fontSize = '16px';
        
        errorDiv.innerHTML = `
            <h2>Sand Simulator could not initialize properly</h2>
            <p>Your browser might not support all the required features.</p>
            <p>The simulation will still run in basic mode without shader effects.</p>
        `;
        
        document.body.appendChild(errorDiv);
    }
}

function createSandbox(engine) {
    const width = engine.width;
    const height = engine.height;
    
    createBoxBoundary(engine, width, height);
    createPlatforms(engine, width, height);
    addInitialMaterials(engine, width, height);
}

function createBoxBoundary(engine, width, height) {
    const wallThickness = 10;
    const padding = 40;
    
    // Left wall
    for (let y = padding; y < height - padding; y++) {
        for (let x = padding; x < padding + wallThickness; x++) {
            engine.addMaterial(x, y, MaterialType.WALL);
        }
    }
    
    // Right wall
    for (let y = padding; y < height - padding; y++) {
        for (let x = width - padding - wallThickness; x < width - padding; x++) {
            engine.addMaterial(x, y, MaterialType.WALL);
        }
    }
    
    // Bottom wall
    for (let y = height - padding - wallThickness; y < height - padding; y++) {
        for (let x = padding; x < width - padding; x++) {
            engine.addMaterial(x, y, MaterialType.WALL);
        }
    }
}

function createPlatforms(engine, width, height) {
    const platformThickness = 5;
    
    // Fixed horizontal platform in the middle
    const middlePlatformY = Math.floor(height * 0.5);
    const middlePlatformWidth = Math.floor(width / 3);
    const middlePlatformX = Math.floor(width / 2) - Math.floor(middlePlatformWidth / 2);
    
    for (let y = middlePlatformY; y < middlePlatformY + platformThickness; y++) {
        for (let x = middlePlatformX; x < middlePlatformX + middlePlatformWidth; x++) {
            engine.addMaterial(x, y, MaterialType.WALL);
        }
    }
    
    // Left slanted platform
    const leftPlatformLength = Math.floor(width / 4);
    const leftPlatformStartX = Math.floor(width / 6);
    const leftPlatformStartY = Math.floor(height * 0.3);
    const leftPlatformSlope = 0.4;
    
    for (let i = 0; i < leftPlatformLength; i++) {
        const x = leftPlatformStartX + i;
        const y = leftPlatformStartY + Math.floor(i * leftPlatformSlope);
        
        for (let t = 0; t < platformThickness; t++) {
            engine.addMaterial(x, y + t, MaterialType.WALL);
        }
    }
    
    // Right slanted platform (opposite direction)
    const rightPlatformLength = Math.floor(width / 4);
    const rightPlatformEndX = Math.floor(width - width / 6);
    const rightPlatformStartY = Math.floor(height * 0.3);
    const rightPlatformSlope = 0.4;
    
    for (let i = 0; i < rightPlatformLength; i++) {
        const x = rightPlatformEndX - i;
        const y = rightPlatformStartY + Math.floor(i * rightPlatformSlope);
        
        for (let t = 0; t < platformThickness; t++) {
            engine.addMaterial(x, y + t, MaterialType.WALL);
        }
    }
    
    // Small platforms for catching materials
    const smallPlatformWidth = Math.floor(width / 8);
    
    // Left small platform
    const leftSmallX = Math.floor(width / 4) - Math.floor(smallPlatformWidth / 2);
    const leftSmallY = Math.floor(height * 0.7);
    
    for (let y = leftSmallY; y < leftSmallY + platformThickness; y++) {
        for (let x = leftSmallX; x < leftSmallX + smallPlatformWidth; x++) {
            engine.addMaterial(x, y, MaterialType.WALL);
        }
    }
    
    // Right small platform
    const rightSmallX = Math.floor(width * 3/4) - Math.floor(smallPlatformWidth / 2);
    const rightSmallY = Math.floor(height * 0.7);
    
    for (let y = rightSmallY; y < rightSmallY + platformThickness; y++) {
        for (let x = rightSmallX; x < rightSmallX + smallPlatformWidth; x++) {
            engine.addMaterial(x, y, MaterialType.WALL);
        }
    }
}

function addInitialMaterials(engine, width, height) {
    // Add a pile of sand at the top center
    const sandPileWidth = Math.floor(width / 10);
    const sandPileHeight = 20;
    const sandX = Math.floor(width / 2);
    const sandY = Math.floor(height * 0.15);
    
    // Create a pyramid-like pile of sand
    for (let y = 0; y < sandPileHeight; y++) {
        const rowWidth = Math.max(4, sandPileWidth - y);
        for (let x = sandX - Math.floor(rowWidth/2); x < sandX + Math.ceil(rowWidth/2); x++) {
            if (Math.random() < 0.9) {
                engine.addMaterial(x, sandY + y, MaterialType.SAND);
            }
        }
    }
    
    // Add water pool on the left
    const waterX = Math.floor(width / 4);
    const waterY = Math.floor(height * 0.2);
    const waterSize = 20;
    
    for (let y = waterY; y < waterY + waterSize; y++) {
        for (let x = waterX - waterSize/2; x < waterX + waterSize/2; x++) {
            if (Math.random() < 0.9) {
                engine.addMaterial(x, y, MaterialType.WATER);
            }
        }
    }
    
    // Add dirt pile on the right
    const dirtX = Math.floor(width * 3/4);
    const dirtY = Math.floor(height * 0.25);
    const dirtSize = 15;
    
    for (let y = 0; y < dirtSize; y++) {
        const rowWidth = Math.max(3, dirtSize - y);
        for (let x = dirtX - Math.floor(rowWidth/2); x < dirtX + Math.ceil(rowWidth/2); x++) {
            if (Math.random() < 0.8) {
                engine.addMaterial(x, dirtY + y, MaterialType.DIRT);
            }
        }
    }
    
    // Add wood structure
    const woodX = Math.floor(width / 2);
    const woodY = Math.floor(height * 0.4);
    const woodWidth = 40;
    const woodHeight = 5;
    
    for (let y = 0; y < woodHeight; y++) {
        for (let x = woodX - Math.floor(woodWidth/2); x < woodX + Math.ceil(woodWidth/2); x++) {
            engine.addMaterial(x, woodY + y, MaterialType.WOOD);
        }
    }
    
    // Mark all chunks as active initially to ensure simulation starts running
    for (let y = 0; y < engine.height; y += engine.CHUNK_SIZE) {
        for (let x = 0; x < engine.width; x += engine.CHUNK_SIZE) {
            engine.markChunkActive(x, y);
        }
    }
}
