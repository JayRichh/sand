class ShaderRenderer {
    constructor(engine) {
        this.engine = engine;
        this.canvas = engine.canvas;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.enabled = true;
        this.time = 0;
        
        this.setupWebGL();
        
        // Only proceed with WebGL setup if WebGL is supported
        if (this.gl) {
            try {
                this.setupShaders();
                this.setupBuffers();
                this.setupTexture();
            } catch (e) {
                console.error('Error setting up WebGL:', e);
                this.enabled = false;
            }
        } else {
            console.warn('WebGL not available - shader effects disabled');
            this.enabled = false;
        }
    }
    
    setupWebGL() {
        try {
            console.log('Attempting to initialize WebGL...');
            
            // Ensure canvas dimensions are valid to avoid WebGL context creation issues
            if (this.canvas.width === 0 || this.canvas.height === 0) {
                this.canvas.width = this.canvas.width || 300;
                this.canvas.height = this.canvas.height || 150;
            }
            
            // Set up context loss/restoration handlers
            this.canvas.addEventListener('webglcontextlost', (e) => {
                e.preventDefault();
                console.warn('WebGL context lost');
                this.enabled = false;
            }, false);
            
            this.canvas.addEventListener('webglcontextrestored', () => {
                console.log('WebGL context restored');
                this.setupWebGL();
                if (this.gl) {
                    this.setupShaders();
                    this.setupBuffers();
                    this.setupTexture();
                    this.enabled = true;
                }
            }, false);
            
            // Use any pre-detected WebGL details from parent window
            if (window.webGLInfo) {
                console.log('Using pre-detected WebGL information');
            }
            
            // Try different context types with optimized parameters
            let gl = null;
            
            // Context parameters optimized for compatibility
            const contextOptions = {
                alpha: true,
                premultipliedAlpha: false,
                antialias: true,
                powerPreference: 'default',
                failIfMajorPerformanceCaveat: false,
                preserveDrawingBuffer: true,
                desynchronized: false
            };
            
            // Try WebGL2 first
            try {
                gl = this.canvas.getContext('webgl2', contextOptions);
                if (gl) console.log('WebGL2 context acquired');
            } catch (e) {
                console.warn('WebGL2 context creation failed:', e);
            }
            
            // Fall back to WebGL
            if (!gl) {
                try {
                    gl = this.canvas.getContext('webgl', contextOptions);
                    if (gl) console.log('WebGL context acquired');
                } catch (e) {
                    console.warn('WebGL context creation failed:', e);
                }
            }
            
            // Fall back to experimental WebGL
            if (!gl) {
                try {
                    gl = this.canvas.getContext('experimental-webgl', contextOptions);
                    if (gl) console.log('Experimental WebGL context acquired');
                } catch (e) {
                    console.warn('Experimental WebGL context creation failed:', e);
                }
            }
            
            // Last resort - try with no specific options
            if (!gl) {
                gl = this.canvas.getContext('webgl') || 
                     this.canvas.getContext('experimental-webgl');
                if (gl) console.log('Basic WebGL context acquired');
            }
            
            this.gl = gl;
            
            // Check if WebGL context creation failed
            if (!this.gl) {
                console.error('WebGL not supported - shader effects will be disabled');
                this.enabled = false;
                return;
            }
            
            // Get renderer information for diagnostics
            try {
                const debugInfo = this.gl.getExtension('WEBGL_debug_renderer_info');
                if (debugInfo) {
                    const renderer = this.gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                    const vendor = this.gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                    console.log('WebGL renderer:', renderer);
                    console.log('WebGL vendor:', vendor);
                    
                    // Check for software renderers
                    if (/SwiftShader|Software|Microsoft Basic Renderer/.test(renderer)) {
                        console.warn('Running with software renderer, some effects may be limited');
                    }
                }
            } catch (e) {
                console.warn('Unable to get WebGL renderer info:', e);
            }
            
            // Check supported extensions
            const extensions = this.gl.getSupportedExtensions();
            console.log('WebGL extensions available:', extensions ? extensions.length : 0);
            
            console.log('WebGL successfully initialized!');
            
            // Create an offscreen canvas for rendering
            this.renderCanvas = document.createElement('canvas');
            this.renderCanvas.width = this.width;
            this.renderCanvas.height = this.height;
            this.renderCtx = this.renderCanvas.getContext('2d', { 
                willReadFrequently: true, 
                antialias: true
            });
            
            // Set up viewport
            this.gl.viewport(0, 0, this.width, this.height);
            this.gl.clearColor(0, 0, 0, 0);
            
        } catch (e) {
            console.error('Error initializing WebGL:', e);
            this.gl = null;
            this.enabled = false;
        }
    }
    
    setupShaders() {
        // Simpler vertex shader - just passes position and texture coordinates
        const vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;
        
        // Simplified fragment shader that just displays the texture
        // We'll add more complex effects once basic rendering is working
        const fragmentShaderSource = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_image;
            uniform float u_time;
            
            void main() {
                vec4 color = texture2D(u_image, v_texCoord);
                gl_FragColor = color;
            }
        `;
        
        const vertexShader = this.compileShader(vertexShaderSource, this.gl.VERTEX_SHADER);
        const fragmentShader = this.compileShader(fragmentShaderSource, this.gl.FRAGMENT_SHADER);
        
        this.program = this.gl.createProgram();
        this.gl.attachShader(this.program, vertexShader);
        this.gl.attachShader(this.program, fragmentShader);
        this.gl.linkProgram(this.program);
        
        if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
            console.error('Shader program linking failed:', this.gl.getProgramInfoLog(this.program));
            this.enabled = false;
            return;
        }
        
        this.gl.useProgram(this.program);
        
        this.positionLocation = this.gl.getAttribLocation(this.program, 'a_position');
        this.texCoordLocation = this.gl.getAttribLocation(this.program, 'a_texCoord');
        
        this.imageLocation = this.gl.getUniformLocation(this.program, 'u_image');
        this.timeLocation = this.gl.getUniformLocation(this.program, 'u_time');
        this.resolutionLocation = this.gl.getUniformLocation(this.program, 'u_resolution');
    }
    
    compileShader(source, type) {
        const shader = this.gl.createShader(type);
        
        if (!shader) {
            console.error(`Failed to create shader of type: ${type === this.gl.VERTEX_SHADER ? 'VERTEX_SHADER' : 'FRAGMENT_SHADER'}`);
            return null;
        }
        
        // Add precision definition for fragment shaders
        let processedSource = source;
        if (type === this.gl.FRAGMENT_SHADER && !source.includes('precision')) {
            processedSource = 'precision mediump float;\n' + source;
        }
        
        try {
            this.gl.shaderSource(shader, processedSource);
            this.gl.compileShader(shader);
            
            if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
                const log = this.gl.getShaderInfoLog(shader);
                console.error('Shader compilation failed:', log);
                
                // Log shader source with line numbers for debugging
                const lines = processedSource.split('\n');
                const numberedLines = lines.map((line, i) => `${i + 1}: ${line}`).join('\n');
                console.error('Shader source:\n', numberedLines);
                
                this.gl.deleteShader(shader);
                return null;
            }
            
            return shader;
        } catch (e) {
            console.error('Exception during shader compilation:', e);
            if (shader) {
                this.gl.deleteShader(shader);
            }
            return null;
        }
    }
    
    setupBuffers() {
        this.positionBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        
        const positions = [
            -1, -1,
             1, -1,
            -1,  1,
             1,  1
        ];
        
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
        
        this.texCoordBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
        
        const texCoords = [
            0, 0,
            1, 0,
            0, 1,
            1, 1
        ];
        
        this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(texCoords), this.gl.STATIC_DRAW);
    }
    
    setupTexture() {
        try {
            this.texture = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
            
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
            
            const pixel = new Uint8Array([0, 0, 0, 0]);
            this.gl.texImage2D(
                this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0,
                this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixel
            );
            
            this.gl.generateMipmap && this.gl.generateMipmap(this.gl.TEXTURE_2D);
        } catch (e) {
            console.error('Texture initialization failed:', e);
            this.enabled = false;
        }
    }
    
    render(imageData) {
        // Skip WebGL rendering if disabled
        if (!this.enabled || !this.gl) {
            return imageData;
        }
        
        try {
            // Update animation time
            this.time += 0.016;
            
            // Step 1: Put imageData onto the renderCanvas
            if (!this.renderCtx) {
                return imageData;
            }
            
            this.renderCtx.putImageData(imageData, 0, 0);
            
            // Step 2: Use WebGL to apply shaders
            // First activate texture unit 0
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
            
            // Upload the canvas to the texture
            this.gl.texImage2D(
                this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, 
                this.gl.UNSIGNED_BYTE, this.renderCanvas
            );
            
            // Use our shader program
            this.gl.useProgram(this.program);
            
            // Set up position attribute
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
            this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.enableVertexAttribArray(this.positionLocation);
            
            // Set up texture coordinate attribute
            this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
            this.gl.vertexAttribPointer(this.texCoordLocation, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.enableVertexAttribArray(this.texCoordLocation);
            
            // Set uniforms
            this.gl.uniform1i(this.imageLocation, 0);  // Use texture unit 0
            this.gl.uniform1f(this.timeLocation, this.time);
            
            // Clear and draw
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
            
            // Read the rendered pixels back to the context
            const processedImageData = this.engine.ctx.getImageData(0, 0, this.width, this.height);
            return processedImageData;
            
        } catch (e) {
            console.error('WebGL render error:', e);
            this.enabled = false;
            return imageData;  // Return original image if WebGL fails
        }
    }
    
    resize(width, height) {
        try {
            this.width = width;
            this.height = height;
            
            if (this.gl && this.enabled) {
                this.gl.viewport(0, 0, this.width, this.height);
            }
            
            if (this.renderCanvas) {
                this.renderCanvas.width = this.width;
                this.renderCanvas.height = this.height;
            }
        } catch (e) {
            console.error('Error resizing WebGL context:', e);
            this.enabled = false;
        }
    }
}

class Tooltip {
    constructor() {
        this.element = document.createElement('div');
        this.element.className = 'tooltip';
        this.visible = false;
        this.targetOpacity = 0;
        this.currentOpacity = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.currentX = 0;
        this.currentY = 0;
        
        document.body.appendChild(this.element);
        this.hide();
    }
    
    show(text, x, y) {
        this.element.textContent = text;
        this.targetX = x;
        this.targetY = y + 20;
        this.targetOpacity = 0.9;
        this.visible = true;
        
        if (!this.animating) {
            this.currentX = x;
            this.currentY = y + 30;
            this.animate();
        }
    }
    
    hide() {
        this.targetOpacity = 0;
    }
    
    animate() {
        this.animating = true;
        
        this.currentOpacity = this.lerp(this.currentOpacity, this.targetOpacity, 0.15);
        this.currentX = this.lerp(this.currentX, this.targetX, 0.2);
        this.currentY = this.lerp(this.currentY, this.targetY, 0.2);
        
        this.element.style.opacity = this.currentOpacity;
        this.element.style.transform = `translate(${this.currentX}px, ${this.currentY}px)`;
        
        if (Math.abs(this.currentOpacity - this.targetOpacity) > 0.01 || 
            Math.abs(this.currentX - this.targetX) > 0.5 ||
            Math.abs(this.currentY - this.targetY) > 0.5) {
            requestAnimationFrame(() => this.animate());
        } else if (this.targetOpacity < 0.1) {
            this.visible = false;
            this.animating = false;
        } else {
            this.animating = false;
        }
    }
    
    lerp(start, end, t) {
        const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        return start + (end - start) * easeInOut(t);
    }
}
