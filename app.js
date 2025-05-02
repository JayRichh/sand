document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('simulation');
    if (!canvas) {
        console.error('Canvas element not found');
        return;
    }
    
    const materials = new Materials();
    const engine = new SimulationEngine(canvas, materials);
    const toolManager = new ToolManager(engine, canvas);
    
    createSandbox(engine);
    
    console.log('Sand Simulator Initialized');
    console.log('Controls:');
    console.log('- Materials: 1-6 number keys or toolbar buttons');
    console.log('- Tools: D (draw), E (erase), F (fire)');
    console.log('- Clear: C key or clear button');
    console.log('- Pause/Resume: Space key or pause button');
    console.log('- Brush Size: [ and ] keys or slider');
});

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
