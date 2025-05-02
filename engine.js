class SimulationEngine {
    constructor(canvas, materials) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { willReadFrequently: true });
        this.materials = materials;
        
        // Resize canvas to match display size
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Simulation properties
        this.CHUNK_SIZE = 32;
        this.running = true;
        this.lastUpdateTime = 0;
        this.updateInterval = 1000 / 60; // Target 60 updates per second
        
        // Optimizations
        this.activeChunks = new Set();
        this.dirtyRegion = { startX: 0, startY: 0, endX: 0, endY: 0, isDirty: false };
        
        // Initialize grid and rendering
        this.initializeGrid();
        this.initializeRendering();
        
        // Physics constants
        this.DIRECTION_CHANCE = 0.5; // For flow randomization
        this.FIRE_RISE_CHANCE = 0.8; // Chance for fire to rise
        this.FIRE_SPREAD_CHANCE = 0.05; // Chance for fire to spread
        this.FLAME_COLORS = [
            this.materials.packColor(255, 50, 0),   // Red-orange
            this.materials.packColor(255, 120, 0),  // Orange
            this.materials.packColor(255, 180, 0),  // Yellow
        ];
        
        // Start the simulation
        this.startSimulation();
    }
    
    // Resize canvas to match display size
    resizeCanvas() {
        const containerWidth = this.canvas.parentElement.clientWidth;
        const containerHeight = this.canvas.parentElement.clientHeight;
        
        this.canvas.width = containerWidth;
        this.canvas.height = containerHeight;
        
        if (this.grid) {
            this.initializeGrid();
            this.initializeRendering();
        }
    }
    
    // Initialize the particle grid
    initializeGrid() {
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        
        // Grid data using TypedArray
        this.grid = new Uint8Array(this.width * this.height);
        this.nextGrid = new Uint8Array(this.width * this.height);
        
        // Additional properties for particles
        this.particleAge = new Uint16Array(this.width * this.height);
        
        // Chunk management
        this.chunksX = Math.ceil(this.width / this.CHUNK_SIZE);
        this.chunksY = Math.ceil(this.height / this.CHUNK_SIZE);
        this.chunkActiveState = new Uint8Array(this.chunksX * this.chunksY);
        
        // Clear grid
        this.clearGrid();
    }
    
    // Initialize rendering system
    initializeRendering() {
        // Create ImageData for direct pixel manipulation
        this.imageData = this.ctx.createImageData(this.width, this.height);
        this.pixels = new Uint32Array(this.imageData.data.buffer);
    }
    
    // Clear the entire grid
    clearGrid() {
        this.grid.fill(MaterialType.EMPTY);
        this.nextGrid.fill(MaterialType.EMPTY);
        this.particleAge.fill(0);
        this.chunkActiveState.fill(0);
        this.activeChunks.clear();
        
        // Reset dirty region
        this.setDirtyRegion(0, 0, 0, 0, false);
    }
    
    // Start the simulation loop
    startSimulation() {
        this.running = true;
        this.lastUpdateTime = performance.now();
        requestAnimationFrame((timestamp) => this.simulationLoop(timestamp));
    }
    
    // Pause/resume the simulation
    togglePause() {
        this.running = !this.running;
        if (this.running) {
            this.lastUpdateTime = performance.now();
            requestAnimationFrame((timestamp) => this.simulationLoop(timestamp));
        }
    }
    
    // Main simulation loop
    simulationLoop(timestamp) {
        if (!this.running) return;
        
        // Calculate delta time
        const deltaTime = timestamp - this.lastUpdateTime;
        
        // Update simulation at fixed time step
        if (deltaTime >= this.updateInterval) {
            this.lastUpdateTime = timestamp;
            this.update();
        }
        
        // Render the current state
        this.render();
        
        // Continue the loop
        requestAnimationFrame((timestamp) => this.simulationLoop(timestamp));
    }
    
    // Update the simulation state
    update() {
        // Skip update if no active chunks
        if (this.activeChunks.size === 0) return;
        
        // Copy current grid to next grid
        this.nextGrid.set(this.grid);
        
        // Process active chunks
        this.processActiveChunks();
        
        // Swap grids after update
        [this.grid, this.nextGrid] = [this.nextGrid, this.grid];
        
        // Update chunk activity states
        this.updateChunkActivityStates();
    }
    
    // Process physics for active chunks
    processActiveChunks() {
        const activeChunksArray = Array.from(this.activeChunks);
        
        // Randomize processing order to avoid directional bias
        this.shuffleArray(activeChunksArray);
        
        for (const chunkIndex of activeChunksArray) {
            const chunkX = chunkIndex % this.chunksX;
            const chunkY = Math.floor(chunkIndex / this.chunksX);
            
            // Process chunk in random order
            this.processChunk(chunkX, chunkY);
        }
    }
    
    // Process a single chunk
    processChunk(chunkX, chunkY) {
        const startX = chunkX * this.CHUNK_SIZE;
        const startY = chunkY * this.CHUNK_SIZE;
        const endX = Math.min(startX + this.CHUNK_SIZE, this.width);
        const endY = Math.min(startY + this.CHUNK_SIZE, this.height);
        
        // Process in random order within the chunk
        const positions = [];
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                positions.push({ x, y });
            }
        }
        
        this.shuffleArray(positions);
        
        for (const pos of positions) {
            this.processParticle(pos.x, pos.y);
        }
    }
    
    processParticle(x, y) {
        const idx = y * this.width + x;
        const type = this.grid[idx];
        
        if (type === MaterialType.EMPTY) return;
        
        if (type === MaterialType.WALL) return;
        
        if (this.materials.isStatic(type) && type !== MaterialType.FIRE) {
            if (type === MaterialType.WOOD && this.particleAge[idx] > 0) {
                this.processBurning(x, y, idx, type);
            }
            return;
        }
        
        if (type === MaterialType.FIRE) {
            this.processFireParticle(x, y, idx);
            return;
        }
        
        const gravity = this.materials.gravity[type];
        const moveUp = gravity < 0;
        
        if (this.materials.canFall(type)) {
            const successfulMove = moveUp ? 
                this.tryMoveUp(x, y, type, Math.abs(gravity)) : 
                this.tryMoveDown(x, y, type, gravity);
            
            if (successfulMove) return;
        }
        
        this.processInteractions(x, y, idx, type);
    }
    
    tryMoveDown(x, y, type, gravity) {
        if (y >= this.height - 1) return false;
        
        const idx = y * this.width + x;
        const belowIdx = (y + 1) * this.width + x;
        
        // Fall directly down
        if (this.grid[belowIdx] === MaterialType.EMPTY) {
            this.moveParticle(idx, belowIdx, type);
            return true;
        } else if (this.materials.canDisplace(type, this.grid[belowIdx])) {
            this.swapParticles(idx, belowIdx);
            return true;
        }
        
        // Check if material can flow sideways or diagonally
        if (this.materials.canFlow(type)) {
            // Randomize direction based on density and disperse rate
            const goesLeft = Math.random() < this.DIRECTION_CHANCE;
            const movementIntensity = Math.min(1.0, this.materials.disperseRate[type] / 10.0);
            
            // Try diagonal movement based on material's properties
            if (Math.random() < movementIntensity * gravity / 10) {
                // Try left or right diagonal based on random direction
                const successfulDiagonalMove = goesLeft ? 
                    this.tryMoveDiagonal(x, y, type, -1, 1) : 
                    this.tryMoveDiagonal(x, y, type, 1, 1);
                
                // If first attempt fails, try the other diagonal
                if (!successfulDiagonalMove) {
                    const otherDiagonalMove = goesLeft ? 
                        this.tryMoveDiagonal(x, y, type, 1, 1) : 
                        this.tryMoveDiagonal(x, y, type, -1, 1);
                    
                    if (otherDiagonalMove) return true;
                } else {
                    return true;
                }
            }
            
            // Liquids can flow sideways when they can't go down
            if (this.materials.disperseRate[type] > 5) {
                const flowChance = this.materials.disperseRate[type] / 30;
                if (Math.random() < flowChance) {
                    // Try left or right based on random direction
                    const successfulSidewaysMove = goesLeft ? 
                        this.trySidewaysMove(x, y, type, -1) : 
                        this.trySidewaysMove(x, y, type, 1);
                    
                    if (successfulSidewaysMove) return true;
                    
                    // Try the other direction if first fails
                    const otherSidewaysMove = goesLeft ? 
                        this.trySidewaysMove(x, y, type, 1) : 
                        this.trySidewaysMove(x, y, type, -1);
                        
                    if (otherSidewaysMove) return true;
                }
            }
        }
        
        return false;
    }
    
    tryMoveUp(x, y, type, absGravity) {
        if (y <= 0) return false;
        
        const idx = y * this.width + x;
        const aboveIdx = (y - 1) * this.width + x;
        
        // Move directly up
        if (this.grid[aboveIdx] === MaterialType.EMPTY) {
            this.moveParticle(idx, aboveIdx, type);
            return true;
        } else if (this.materials.canDisplace(type, this.grid[aboveIdx])) {
            this.swapParticles(idx, aboveIdx);
            return true;
        }
        
        // Try diagonal up movement for gases
        if (this.materials.canFlow(type) && Math.random() < absGravity / 10) {
            const goesLeft = Math.random() < this.DIRECTION_CHANCE;
            
            const successfulDiagonalMove = goesLeft ? 
                this.tryMoveDiagonal(x, y, type, -1, -1) : 
                this.tryMoveDiagonal(x, y, type, 1, -1);
            
            if (successfulDiagonalMove) return true;
            
            const otherDiagonalMove = goesLeft ? 
                this.tryMoveDiagonal(x, y, type, 1, -1) : 
                this.tryMoveDiagonal(x, y, type, -1, -1);
                
            if (otherDiagonalMove) return true;
        }
        
        return false;
    }
    
    tryMoveDiagonal(x, y, type, dx, dy) {
        const nx = x + dx;
        const ny = y + dy;
        
        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) return false;
        
        const idx = y * this.width + x;
        const targetIdx = ny * this.width + nx;
        
        if (this.grid[targetIdx] === MaterialType.EMPTY) {
            this.moveParticle(idx, targetIdx, type);
            return true;
        } else if (!this.materials.isStatic(this.grid[targetIdx]) && 
                   this.materials.canDisplace(type, this.grid[targetIdx])) {
            this.swapParticles(idx, targetIdx);
            return true;
        }
        
        return false;
    }
    
    trySidewaysMove(x, y, type, dx) {
        const nx = x + dx;
        
        if (nx < 0 || nx >= this.width) return false;
        
        const idx = y * this.width + x;
        const targetIdx = y * this.width + nx;
        
        if (this.grid[targetIdx] === MaterialType.EMPTY) {
            this.moveParticle(idx, targetIdx, type);
            return true;
        }
        
        return false;
    }
    
    // Process particle interactions (like fire spread)
    processInteractions(x, y, idx, type) {
        if (type === MaterialType.FIRE) {
            this.processFireParticle(x, y, idx);
            return;
        }
        
        // Check if particle is flammable and near fire
        if (this.materials.canBurn(type)) {
            const nearFire = this.checkSurrounding(x, y, MaterialType.FIRE);
            if (nearFire) {
                const igniteChance = this.materials.flammability[type] / 255;
                if (Math.random() < igniteChance * this.FIRE_SPREAD_CHANCE) {
                    this.nextGrid[idx] = MaterialType.FIRE;
                    this.particleAge[idx] = 0;
                    this.markChunkActive(x, y);
                }
            }
        }
    }
    
    // Process fire particle behavior
    processFireParticle(x, y, idx) {
        // Increment fire age
        this.particleAge[idx]++;
        
        // Fire dies out after burnTime
        if (this.particleAge[idx] >= this.materials.burnTime[MaterialType.FIRE]) {
            this.nextGrid[idx] = MaterialType.EMPTY;
            this.particleAge[idx] = 0;
            this.markChunkActive(x, y);
            return;
        }
        
        // Fire spreads to flammable neighbors
        const spreads = this.spreadFireToNeighbors(x, y);
        
        // Fire can rise if not spreading
        if (!spreads && Math.random() < this.FIRE_RISE_CHANCE && y > 0) {
            const aboveIdx = (y - 1) * this.width + x;
            if (this.grid[aboveIdx] === MaterialType.EMPTY) {
                this.moveParticle(idx, aboveIdx, MaterialType.FIRE);
                return;
            }
        }
        
        // Fire can move slightly to sides
        if (Math.random() < 0.3) {
            const dir = Math.random() < 0.5 ? -1 : 1;
            if (x + dir >= 0 && x + dir < this.width) {
                const sideIdx = y * this.width + (x + dir);
                if (this.grid[sideIdx] === MaterialType.EMPTY) {
                    this.moveParticle(idx, sideIdx, MaterialType.FIRE);
                    return;
                }
            }
        }
    }
    
    // Process burning materials (e.g., wood burning)
    processBurning(x, y, idx, type) {
        // Increment burn age
        this.particleAge[idx]++;
        
        // Material burns out after its burn time
        if (this.particleAge[idx] >= this.materials.burnTime[type]) {
            // Wood turns to ash/sand when burnt out
            if (type === MaterialType.WOOD) {
                this.nextGrid[idx] = MaterialType.SAND;
            } else {
                this.nextGrid[idx] = MaterialType.EMPTY;
            }
            this.particleAge[idx] = 0;
            this.markChunkActive(x, y);
        }
        
        // Create fire particle occasionally while burning
        if (Math.random() < 0.05 && y > 0) {
            const aboveIdx = (y - 1) * this.width + x;
            if (this.grid[aboveIdx] === MaterialType.EMPTY) {
                this.nextGrid[aboveIdx] = MaterialType.FIRE;
                this.particleAge[aboveIdx] = 0;
                this.markChunkActive(x, y - 1);
            }
        }
    }
    
    // Spread fire to neighboring cells
    spreadFireToNeighbors(x, y) {
        let spread = false;
        
        // Check all 8 surrounding cells
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    const nIdx = ny * this.width + nx;
                    const nType = this.grid[nIdx];
                    
                    if (this.materials.canBurn(nType) && Math.random() < this.FIRE_SPREAD_CHANCE) {
                        const igniteChance = this.materials.flammability[nType] / 255;
                        if (Math.random() < igniteChance) {
                            this.nextGrid[nIdx] = MaterialType.FIRE;
                            this.particleAge[nIdx] = 0;
                            this.markChunkActive(nx, ny);
                            spread = true;
                        }
                    }
                }
            }
        }
        
        return spread;
    }
    
    // Check if a material type exists in surrounding cells
    checkSurrounding(x, y, typeToCheck) {
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    const nIdx = ny * this.width + nx;
                    if (this.grid[nIdx] === typeToCheck) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    // Move a particle from one position to another
    moveParticle(fromIdx, toIdx, type) {
        this.nextGrid[fromIdx] = MaterialType.EMPTY;
        this.nextGrid[toIdx] = type;
        
        // Copy particle age
        this.particleAge[toIdx] = this.particleAge[fromIdx];
        this.particleAge[fromIdx] = 0;
        
        // Mark both source and destination chunks as active
        const fromX = fromIdx % this.width;
        const fromY = Math.floor(fromIdx / this.width);
        const toX = toIdx % this.width;
        const toY = Math.floor(toIdx / this.width);
        
        this.markChunkActive(fromX, fromY);
        this.markChunkActive(toX, toY);
        
        // Update dirty region for rendering
        this.expandDirtyRegion(fromX, fromY);
        this.expandDirtyRegion(toX, toY);
    }
    
    // Swap two particles
    swapParticles(idx1, idx2) {
        const type1 = this.grid[idx1];
        const type2 = this.grid[idx2];
        const age1 = this.particleAge[idx1];
        const age2 = this.particleAge[idx2];
        
        this.nextGrid[idx1] = type2;
        this.nextGrid[idx2] = type1;
        this.particleAge[idx1] = age2;
        this.particleAge[idx2] = age1;
        
        // Mark both chunks as active
        const x1 = idx1 % this.width;
        const y1 = Math.floor(idx1 / this.width);
        const x2 = idx2 % this.width;
        const y2 = Math.floor(idx2 / this.width);
        
        this.markChunkActive(x1, y1);
        this.markChunkActive(x2, y2);
        
        // Update dirty region for rendering
        this.expandDirtyRegion(x1, y1);
        this.expandDirtyRegion(x2, y2);
    }
    
    // Mark a chunk as active for the next update
    markChunkActive(x, y) {
        const chunkX = Math.floor(x / this.CHUNK_SIZE);
        const chunkY = Math.floor(y / this.CHUNK_SIZE);
        const chunkIdx = chunkY * this.chunksX + chunkX;
        
        if (chunkX >= 0 && chunkX < this.chunksX && chunkY >= 0 && chunkY < this.chunksY) {
            this.chunkActiveState[chunkIdx] = 1;
            this.activeChunks.add(chunkIdx);
            
            // Also mark neighboring chunks as active
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = chunkX + dx;
                    const ny = chunkY + dy;
                    
                    if (nx >= 0 && nx < this.chunksX && ny >= 0 && ny < this.chunksY) {
                        const nChunkIdx = ny * this.chunksX + nx;
                        this.chunkActiveState[nChunkIdx] = 1;
                        this.activeChunks.add(nChunkIdx);
                    }
                }
            }
        }
    }
    
    // Update chunk activity states after each simulation step
    updateChunkActivityStates() {
        // Process active chunks to determine which remain active
        const chunksToRemove = [];
        
        for (const chunkIdx of this.activeChunks) {
            const chunkX = chunkIdx % this.chunksX;
            const chunkY = Math.floor(chunkIdx / this.chunksX);
            
            if (!this.isChunkActive(chunkX, chunkY)) {
                chunksToRemove.push(chunkIdx);
                this.chunkActiveState[chunkIdx] = 0;
            }
        }
        
        // Remove inactive chunks
        for (const chunkIdx of chunksToRemove) {
            this.activeChunks.delete(chunkIdx);
        }
    }
    
    // Check if a chunk has any active particles
    isChunkActive(chunkX, chunkY) {
        const startX = chunkX * this.CHUNK_SIZE;
        const startY = chunkY * this.CHUNK_SIZE;
        const endX = Math.min(startX + this.CHUNK_SIZE, this.width);
        const endY = Math.min(startY + this.CHUNK_SIZE, this.height);
        
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const idx = y * this.width + x;
                const type = this.grid[idx];
                
                // Non-empty cells or cells that changed make chunk active
                if (type !== MaterialType.EMPTY || this.grid[idx] !== this.nextGrid[idx]) {
                    return true;
                }
                
                // Fire and burning particles make chunk active
                if (type === MaterialType.FIRE || this.particleAge[idx] > 0) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    // Render the current simulation state
    render() {
        // Only render if there are active chunks
        if (this.activeChunks.size === 0 && !this.dirtyRegion.isDirty) return;
        
        // Render all active chunks
        if (this.activeChunks.size > 0) {
            this.renderPixels();
        }
        
        // Put the image data on the canvas
        this.ctx.putImageData(this.imageData, 0, 0);
        
        // Reset dirty region
        this.setDirtyRegion(0, 0, 0, 0, false);
    }
    
    // Render individual pixels based on the grid state
    renderPixels() {
        for (const chunkIdx of this.activeChunks) {
            const chunkX = chunkIdx % this.chunksX;
            const chunkY = Math.floor(chunkIdx / this.chunksX);
            
            const startX = chunkX * this.CHUNK_SIZE;
            const startY = chunkY * this.CHUNK_SIZE;
            const endX = Math.min(startX + this.CHUNK_SIZE, this.width);
            const endY = Math.min(startY + this.CHUNK_SIZE, this.height);
            
            for (let y = startY; y < endY; y++) {
                for (let x = startX; x < endX; x++) {
                    const idx = y * this.width + x;
                    const type = this.grid[idx];
                    
                    if (type === MaterialType.EMPTY) {
                        this.pixels[idx] = 0; // Transparent
                    } else if (type === MaterialType.FIRE) {
                        // Animate fire colors based on age
                        const ageRatio = this.particleAge[idx] / this.materials.burnTime[MaterialType.FIRE];
                        const colorIdx = Math.min(
                            Math.floor(ageRatio * this.FLAME_COLORS.length), 
                            this.FLAME_COLORS.length - 1
                        );
                        this.pixels[idx] = this.materials.randomizeColor(this.FLAME_COLORS[colorIdx], 20);
                    } else {
                        // Get material color with some randomization
                        this.pixels[idx] = this.materials.getRandomizedColor(type);
                    }
                }
            }
        }
    }
    
    // Add material at a specific position (for drawing)
    addMaterial(x, y, type, radius = 1) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        
        // Add material in a circular pattern based on radius
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                // Skip if outside circle
                if (dx*dx + dy*dy > radius*radius) continue;
                
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    const idx = ny * this.width + nx;
                    
                    if (type === MaterialType.EMPTY || this.grid[idx] === MaterialType.EMPTY || 
                        this.materials.canDisplace(type, this.grid[idx])) {
                        this.grid[idx] = type;
                        this.nextGrid[idx] = type;
                        this.particleAge[idx] = 0;
                        
                        this.markChunkActive(nx, ny);
                        this.expandDirtyRegion(nx, ny);
                    }
                }
            }
        }
    }
    
    // Ignite flammable materials (for fire tool)
    igniteMaterial(x, y, radius = 1) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        
        // Ignite materials in a circular pattern
        for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
                // Skip if outside circle
                if (dx*dx + dy*dy > radius*radius) continue;
                
                const nx = x + dx;
                const ny = y + dy;
                
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    const idx = ny * this.width + nx;
                    const type = this.grid[idx];
                    
                    if (type === MaterialType.EMPTY) {
                        // Add fire to empty cells
                        this.grid[idx] = MaterialType.FIRE;
                        this.nextGrid[idx] = MaterialType.FIRE;
                        this.particleAge[idx] = 0;
                    } else if (this.materials.canBurn(type)) {
                        // Ignite flammable materials
                        this.grid[idx] = MaterialType.FIRE;
                        this.nextGrid[idx] = MaterialType.FIRE;
                        this.particleAge[idx] = 0;
                    }
                    
                    this.markChunkActive(nx, ny);
                    this.expandDirtyRegion(nx, ny);
                }
            }
        }
    }
    
    // Set dirty region for partial rendering
    setDirtyRegion(startX, startY, endX, endY, isDirty) {
        this.dirtyRegion.startX = startX;
        this.dirtyRegion.startY = startY;
        this.dirtyRegion.endX = endX;
        this.dirtyRegion.endY = endY;
        this.dirtyRegion.isDirty = isDirty;
    }
    
    // Expand dirty region to include a new point
    expandDirtyRegion(x, y) {
        if (!this.dirtyRegion.isDirty) {
            this.setDirtyRegion(x, y, x + 1, y + 1, true);
        } else {
            this.dirtyRegion.startX = Math.min(this.dirtyRegion.startX, x);
            this.dirtyRegion.startY = Math.min(this.dirtyRegion.startY, y);
            this.dirtyRegion.endX = Math.max(this.dirtyRegion.endX, x + 1);
            this.dirtyRegion.endY = Math.max(this.dirtyRegion.endY, y + 1);
        }
    }
    
    // Shuffle array in place (Fisher-Yates algorithm)
    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}
