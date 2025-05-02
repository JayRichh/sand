const MaterialType = {
    EMPTY: 0,
    SAND: 1,
    DIRT: 2,
    WOOD: 3,
    WATER: 4,
    FIRE: 5,
    WALL: 6
};

class Materials {
    constructor() {
        this.colors = new Uint32Array(Object.keys(MaterialType).length);
        this.density = new Uint8Array(Object.keys(MaterialType).length);
        this.flammability = new Uint8Array(Object.keys(MaterialType).length);
        this.burnTime = new Uint16Array(Object.keys(MaterialType).length);
        this.viscosity = new Uint8Array(Object.keys(MaterialType).length);
        this.disperseRate = new Uint8Array(Object.keys(MaterialType).length);
        this.gravity = new Uint8Array(Object.keys(MaterialType).length);
        
        this.initializeMaterials();
    }
    
    packColor(r, g, b, a = 255) {
        return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
    }
    
    unpackColor(color) {
        return {
            r: color & 0xFF,
            g: (color >> 8) & 0xFF,
            b: (color >> 16) & 0xFF,
            a: (color >> 24) & 0xFF
        };
    }
    
    randomizeColor(color, amount) {
        const unpacked = this.unpackColor(color);
        
        unpacked.r = Math.max(0, Math.min(255, unpacked.r + (Math.random() * amount * 2 - amount) | 0));
        unpacked.g = Math.max(0, Math.min(255, unpacked.g + (Math.random() * amount * 2 - amount) | 0));
        unpacked.b = Math.max(0, Math.min(255, unpacked.b + (Math.random() * amount * 2 - amount) | 0));
        
        return this.packColor(unpacked.r, unpacked.g, unpacked.b, unpacked.a);
    }
    
    initializeMaterials() {
        this.colors[MaterialType.EMPTY] = this.packColor(0, 0, 0, 0);
        this.density[MaterialType.EMPTY] = 0;
        this.flammability[MaterialType.EMPTY] = 0;
        this.burnTime[MaterialType.EMPTY] = 0;
        this.viscosity[MaterialType.EMPTY] = 0;
        this.disperseRate[MaterialType.EMPTY] = 0;
        this.gravity[MaterialType.EMPTY] = 0;
        
        this.colors[MaterialType.SAND] = this.packColor(230, 210, 150);
        this.density[MaterialType.SAND] = 160;
        this.flammability[MaterialType.SAND] = 0;
        this.burnTime[MaterialType.SAND] = 0;
        this.viscosity[MaterialType.SAND] = 1;
        this.disperseRate[MaterialType.SAND] = 3;
        this.gravity[MaterialType.SAND] = 9;
        
        this.colors[MaterialType.DIRT] = this.packColor(140, 100, 80);
        this.density[MaterialType.DIRT] = 180;
        this.flammability[MaterialType.DIRT] = 5;
        this.burnTime[MaterialType.DIRT] = 300;
        this.viscosity[MaterialType.DIRT] = 2;
        this.disperseRate[MaterialType.DIRT] = 1;
        this.gravity[MaterialType.DIRT] = 7;
        
        this.colors[MaterialType.WOOD] = this.packColor(160, 120, 90);
        this.density[MaterialType.WOOD] = 255;
        this.flammability[MaterialType.WOOD] = 200;
        this.burnTime[MaterialType.WOOD] = 1000;
        this.viscosity[MaterialType.WOOD] = 255;
        this.disperseRate[MaterialType.WOOD] = 0;
        this.gravity[MaterialType.WOOD] = 0;
        
        this.colors[MaterialType.WATER] = this.packColor(50, 150, 230);
        this.density[MaterialType.WATER] = 120;
        this.flammability[MaterialType.WATER] = 0;
        this.burnTime[MaterialType.WATER] = 0;
        this.viscosity[MaterialType.WATER] = 5;
        this.disperseRate[MaterialType.WATER] = 10;
        this.gravity[MaterialType.WATER] = 5;
        
        this.colors[MaterialType.FIRE] = this.packColor(255, 100, 50);
        this.density[MaterialType.FIRE] = 1;
        this.flammability[MaterialType.FIRE] = 0;
        this.burnTime[MaterialType.FIRE] = 100;
        this.viscosity[MaterialType.FIRE] = 1;
        this.disperseRate[MaterialType.FIRE] = 8;
        this.gravity[MaterialType.FIRE] = -2;
        
        this.colors[MaterialType.WALL] = this.packColor(80, 80, 80);
        this.density[MaterialType.WALL] = 255;
        this.flammability[MaterialType.WALL] = 0;
        this.burnTime[MaterialType.WALL] = 0;
        this.viscosity[MaterialType.WALL] = 255;
        this.disperseRate[MaterialType.WALL] = 0;
        this.gravity[MaterialType.WALL] = 0;
    }
    
    getTypeName(id) {
        return Object.keys(MaterialType).find(key => MaterialType[key] === id) || 'UNKNOWN';
    }
    
    getColor(type) {
        return this.colors[type];
    }
    
    getRandomizedColor(type, randomAmount = 10) {
        const baseColor = this.colors[type];
        return type !== MaterialType.EMPTY ? this.randomizeColor(baseColor, randomAmount) : baseColor;
    }
    
    canFall(type) {
        return this.density[type] > 0 && this.density[type] < 255 && this.gravity[type] !== 0;
    }
    
    canBurn(type) {
        return this.flammability[type] > 0;
    }
    
    canFlow(type) {
        return this.canFall(type) && this.disperseRate[type] > 0;
    }
    
    isStatic(type) {
        return this.viscosity[type] === 255;
    }
    
    canDisplace(type1, type2) {
        if (type2 === MaterialType.EMPTY) return true;
        if (type1 === MaterialType.EMPTY) return false;
        if (type2 === MaterialType.WALL) return false;
        
        return this.density[type1] > this.density[type2];
    }
}
