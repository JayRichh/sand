class ToolManager {
    constructor(engine, canvas) {
        this.engine = engine;
        this.canvas = canvas;
        this.simulationContainer = canvas.parentElement;
        
        this.currentTool = 'draw';
        this.currentMaterial = MaterialType.SAND;
        this.brushSize = 5;
        this.isDrawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.cursorX = 0;
        this.cursorY = 0;
        this.cursorVisible = false;
        
        this.cursorOverlay = document.getElementById('cursor-overlay');
        this.tooltip = new Tooltip();
        this.materialDescriptions = {
            'sand': 'Sand: Granular material that flows and piles up',
            'wood': 'Wood: Solid material that can burn',
            'water': 'Water: Liquid that flows freely to fill spaces',
            'fire': 'Fire: Spreads to flammable materials and rises',
            'wall': 'Wall: Solid barrier that blocks flow'
        };
        
        this.setupEventListeners();
        this.setupToolButtons();
        this.setupCursor();
        this.setupTooltips();
    }
    
    setupCursor() {
        if (!this.cursorOverlay) {
            this.cursorOverlay = document.createElement('div');
            this.cursorOverlay.id = 'cursor-overlay';
            this.cursorOverlay.className = 'hidden';
            document.getElementById('container').appendChild(this.cursorOverlay);
        }
        
        this.updateCursorIcon();
    }
    
    updateCursorIcon() {
        if (!this.cursorOverlay) return;
        
        this.cursorOverlay.innerHTML = '';
        
        let iconSrc = '';
        
        switch (this.currentTool) {
            case 'draw':
                switch (this.currentMaterial) {
                    case MaterialType.SAND:
                        iconSrc = 'mojis/sand.png';
                        break;
                    case MaterialType.WOOD:
                        iconSrc = 'mojis/wood.png';
                        break;
                    case MaterialType.WATER:
                        iconSrc = 'mojis/water.png';
                        break;
                    case MaterialType.FIRE:
                        iconSrc = 'mojis/fire.png';
                        break;
                    case MaterialType.WALL:
                        iconSrc = 'mojis/wall.png';
                        break;
                    default:
                        iconSrc = 'mojis/sand.png';
                }
                break;
            case 'erase':
                iconSrc = 'mojis/bin.png';
                break;
            case 'ignite':
                iconSrc = 'mojis/fire.png';
                break;
        }
        
        if (iconSrc) {
            const img = document.createElement('img');
            img.src = iconSrc;
            img.alt = this.currentTool;
            this.cursorOverlay.appendChild(img);
        }
    }
    
    updateCursorPosition(x, y) {
        if (!this.cursorOverlay) return;
        
        this.cursorX = x;
        this.cursorY = y;
        
        this.cursorOverlay.style.left = `${x}px`;
        this.cursorOverlay.style.top = `${y}px`;
    }
    
    showCursor() {
        if (!this.cursorOverlay) return;
        this.cursorVisible = true;
        this.cursorOverlay.classList.remove('hidden');
    }
    
    hideCursor() {
        if (!this.cursorOverlay) return;
        this.cursorVisible = false;
        this.cursorOverlay.classList.add('hidden');
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handlePointerStart.bind(this));
        this.canvas.addEventListener('mousemove', (e) => {
            this.updateCursorPosition(e.clientX, e.clientY);
            this.handlePointerMove(e);
        });
        this.canvas.addEventListener('mouseup', this.handlePointerEnd.bind(this));
        this.canvas.addEventListener('mouseenter', () => this.showCursor());
        this.canvas.addEventListener('mouseleave', () => {
            this.hideCursor();
            this.handlePointerEnd();
        });
        
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.handlePointerStart(this.getTouchPos(e));
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            this.handlePointerMove(this.getTouchPos(e));
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.handlePointerEnd();
        });
        
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        const brushSizeInput = document.getElementById('brush-size');
        const brushSizeDisplay = document.getElementById('brush-size-display');
        
        if (brushSizeInput) {
            brushSizeInput.addEventListener('input', () => {
                this.brushSize = parseInt(brushSizeInput.value);
                if (brushSizeDisplay) {
                    brushSizeDisplay.textContent = this.brushSize;
                }
            });
        }
        
        const clearButton = document.getElementById('clear-button');
        if (clearButton) {
            clearButton.addEventListener('click', () => this.engine.clearGrid());
        }
        
        const pauseButton = document.getElementById('pause-button');
        if (pauseButton) {
            pauseButton.addEventListener('click', () => {
                this.engine.togglePause();
                const pauseIcon = pauseButton.querySelector('img');
                if (pauseIcon) {
                    pauseIcon.src = 'mojis/playpause.png';
                }
            });
        }
    }
    
    setupTooltips() {
        const materialButtons = document.querySelectorAll('.material-button');
        materialButtons.forEach(button => {
            button.addEventListener('mouseenter', (e) => {
                const material = button.getAttribute('data-material');
                const description = this.materialDescriptions[material] || material;
                const rect = button.getBoundingClientRect();
                this.tooltip.show(description, rect.left + rect.width / 2, rect.bottom);
            });
            
            button.addEventListener('mouseleave', () => {
                this.tooltip.hide();
            });
        });
        
        const toolButtons = document.querySelectorAll('.tool-action');
        toolButtons.forEach(button => {
            button.addEventListener('mouseenter', (e) => {
                const tool = button.getAttribute('data-tool');
                let description = '';
                
                switch(tool) {
                    case 'draw':
                        description = 'Draw: Place material on the canvas';
                        break;
                    case 'erase':
                        description = 'Erase: Remove material from the canvas';
                        break;
                    case 'ignite':
                        description = 'Ignite: Start fires or ignite flammable material';
                        break;
                    default:
                        description = tool;
                }
                
                const rect = button.getBoundingClientRect();
                this.tooltip.show(description, rect.left + rect.width / 2, rect.bottom);
            });
            
            button.addEventListener('mouseleave', () => {
                this.tooltip.hide();
            });
        });
    }
    
    setupToolButtons() {
        const materialButtons = document.querySelectorAll('.material-button');
        materialButtons.forEach(button => {
            button.addEventListener('click', () => {
                const material = button.getAttribute('data-material');
                this.setMaterial(material);
                
                materialButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
            });
        });
        
        const toolButtons = document.querySelectorAll('.tool-action');
        toolButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tool = button.getAttribute('data-tool');
                this.setTool(tool);
                
                toolButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                
                this.updateCursor();
            });
        });
    }
    
    setTool(tool) {
        this.currentTool = tool;
        this.updateCursor();
        this.updateCursorIcon();
    }
    
    setMaterial(materialName) {
        switch (materialName.toLowerCase()) {
            case 'sand':
                this.currentMaterial = MaterialType.SAND;
                break;
            case 'dirt':
                this.currentMaterial = MaterialType.DIRT;
                break;
            case 'wood':
                this.currentMaterial = MaterialType.WOOD;
                break;
            case 'water':
                this.currentMaterial = MaterialType.WATER;
                break;
            case 'fire':
                this.currentMaterial = MaterialType.FIRE;
                break;
            case 'wall':
                this.currentMaterial = MaterialType.WALL;
                break;
            default:
                this.currentMaterial = MaterialType.SAND;
        }
        
        if (this.currentTool === 'draw') {
            this.updateCursorIcon();
        }
    }
    
    updateCursor() {
        this.simulationContainer.classList.remove('cursor-draw', 'cursor-erase', 'cursor-ignite');
        
        switch (this.currentTool) {
            case 'draw':
                this.simulationContainer.classList.add('cursor-draw');
                break;
            case 'erase':
                this.simulationContainer.classList.add('cursor-erase');
                break;
            case 'ignite':
                this.simulationContainer.classList.add('cursor-ignite');
                break;
        }
    }
    
    handlePointerStart(e) {
        this.isDrawing = true;
        const pos = this.getPointerPosition(e);
        this.lastX = pos.x;
        this.lastY = pos.y;
        
        this.applyTool(pos.x, pos.y);
    }
    
    handlePointerMove(e) {
        if (!this.isDrawing) return;
        
        const pos = this.getPointerPosition(e);
        
        this.interpolateLine(this.lastX, this.lastY, pos.x, pos.y);
        
        this.lastX = pos.x;
        this.lastY = pos.y;
    }
    
    handlePointerEnd() {
        this.isDrawing = false;
    }
    
    handleKeyDown(e) {
        const key = e.key.toLowerCase();
        
        switch (key) {
            case 'd':
                this.setTool('draw');
                this.updateToolButtonUI('draw');
                break;
            case 'e':
                this.setTool('erase');
                this.updateToolButtonUI('erase');
                break;
            case 'f':
                this.setTool('ignite');
                this.updateToolButtonUI('ignite');
                break;
            case 'c':
                this.engine.clearGrid();
                break;
            case ' ':
                this.engine.togglePause();
                const pauseButton = document.getElementById('pause-button');
                if (pauseButton) {
                    const pauseIcon = pauseButton.querySelector('img');
                    if (pauseIcon) {
                        pauseIcon.src = 'mojis/playpause.png';
                    }
                }
                e.preventDefault();
                break;
        }
        
        if (!isNaN(parseInt(key)) && parseInt(key) >= 1 && parseInt(key) <= 6) {
            const materialIndex = parseInt(key) - 1;
            const materials = ['sand', 'dirt', 'wood', 'water', 'fire', 'wall'];
            
            if (materialIndex < materials.length) {
                this.setMaterial(materials[materialIndex]);
                this.updateMaterialButtonUI(materials[materialIndex]);
            }
        }
        
        if (key === '[' || key === ']') {
            const brushSizeInput = document.getElementById('brush-size');
            if (brushSizeInput) {
                const currentSize = parseInt(brushSizeInput.value);
                const newSize = key === '[' ? Math.max(1, currentSize - 1) : Math.min(20, currentSize + 1);
                
                brushSizeInput.value = newSize;
                this.brushSize = newSize;
                
                const brushSizeDisplay = document.getElementById('brush-size-display');
                if (brushSizeDisplay) {
                    brushSizeDisplay.textContent = newSize;
                }
            }
        }
    }
    
    updateToolButtonUI(tool) {
        const toolButtons = document.querySelectorAll('.tool-action');
        toolButtons.forEach(button => {
            if (button.getAttribute('data-tool') === tool) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }
    
    updateMaterialButtonUI(material) {
        const materialButtons = document.querySelectorAll('.material-button');
        materialButtons.forEach(button => {
            if (button.getAttribute('data-material') === material) {
                button.classList.add('active');
            } else {
                button.classList.remove('active');
            }
        });
    }
    
    applyTool(x, y) {
        switch (this.currentTool) {
            case 'draw':
                this.engine.addMaterial(x, y, this.currentMaterial, this.brushSize);
                break;
            case 'erase':
                this.engine.addMaterial(x, y, MaterialType.EMPTY, this.brushSize);
                break;
            case 'ignite':
                this.engine.igniteMaterial(x, y, this.brushSize);
                break;
        }
    }
    
    getPointerPosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        
        let clientX, clientY;
        
        if (event.touches) {
            clientX = event.touches[0].clientX;
            clientY = event.touches[0].clientY;
        } else {
            clientX = event.clientX;
            clientY = event.clientY;
        }
        
        return {
            x: Math.floor(clientX - rect.left),
            y: Math.floor(clientY - rect.top)
        };
    }
    
    getTouchPos(touchEvent) {
        return {
            clientX: touchEvent.touches[0].clientX,
            clientY: touchEvent.touches[0].clientY
        };
    }
    
    interpolateLine(x0, y0, x1, y1) {
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = (x0 < x1) ? 1 : -1;
        const sy = (y0 < y1) ? 1 : -1;
        let err = dx - dy;
        
        while (true) {
            this.applyTool(x0, y0);
            
            if (x0 === x1 && y0 === y1) break;
            
            const e2 = 2 * err;
            if (e2 > -dy) {
                if (x0 === x1) break;
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                if (y0 === y1) break;
                err += dx;
                y0 += sy;
            }
        }
    }
}
