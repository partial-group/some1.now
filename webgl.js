class WebGL2DotsAnimation {
    constructor() {
        this.canvas = document.querySelector('.dots-canvas');
        this.gl = this.canvas.getContext('webgl2', { 
            antialias: true,
            alpha: true
        });
        this.dots = [];
        this.time = 0;
        this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        
        if (!this.gl) {
            console.error('WebGL 2.0 not supported');
            return;
        }

        this.setupGL();
        this.setupCanvas();
        this.createDots();
        this.bindEvents();
        
        if (!this.prefersReducedMotion.matches) {
            this.animate();
        }
    }

    setupGL() {
        const vertexShaderSource = `#version 300 es
            layout(location = 0) in vec2 a_position;
            layout(location = 1) in float a_speed;
            layout(location = 2) in float a_offset;
            
            uniform vec2 u_resolution;
            uniform float u_time;
            
            out float v_opacity;

            void main() {
                vec2 zeroToOne = a_position / u_resolution;
                vec2 zeroToTwo = zeroToOne * 2.0;
                vec2 clipSpace = zeroToTwo - 1.0;
                gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
                gl_PointSize = 4.0;
                
                float t = u_time * a_speed + a_offset;
                v_opacity = 0.02 + (sin(t) + 1.0) * 0.04;
            }
        `;

        const fragmentShaderSource = `#version 300 es
            precision mediump float;
            
            in float v_opacity;
            out vec4 fragColor;

            void main() {
                float r = 0.0;
                vec2 cxy = 2.0 * gl_PointCoord - 1.0;
                r = dot(cxy, cxy);
                if (r > 1.0) {
                    discard;
                }
                fragColor = vec4(1.0, 1.0, 1.0, v_opacity);
            }
        `;

        const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);

        this.program = this.createProgram(vertexShader, fragmentShader);
        
        this.positionLocation = 0;
        this.speedLocation = 1;
        this.offsetLocation = 2;
        
        this.resolutionLocation = this.gl.getUniformLocation(this.program, "u_resolution");
        this.timeLocation = this.gl.getUniformLocation(this.program, "u_time");

        this.vao = this.gl.createVertexArray();
        this.gl.bindVertexArray(this.vao);

        this.positionBuffer = this.gl.createBuffer();
        this.speedBuffer = this.gl.createBuffer();
        this.offsetBuffer = this.gl.createBuffer();

        this.gl.enable(this.gl.BLEND);
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    }

    createShader(type, source) {
        const shader = this.gl.createShader(type);
        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);
        
        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    createProgram(vertexShader, fragmentShader) {
        const program = this.gl.createProgram();
        this.gl.attachShader(program, vertexShader);
        this.gl.attachShader(program, fragmentShader);
        this.gl.linkProgram(program);
        
        if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
            console.error('Program link error:', this.gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    bindEvents() {
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.createDots();
        });
        
        this.prefersReducedMotion.addEventListener('change', (event) => {
            if (event.matches) {
                this.stop();
            } else {
                this.animate();
            }
        });
    }

    setupCanvas() {
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;
        this.canvas.width = displayWidth;
        this.canvas.height = displayHeight;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    createDots() {
        this.dots = [];
        const gridSize = 20;
        
        const cols = Math.floor(this.canvas.width / gridSize);
        const rows = Math.floor(this.canvas.height / gridSize);
        
        const marginX = (this.canvas.width - (cols * gridSize)) / 2;
        const marginY = (this.canvas.height - (rows * gridSize)) / 2;
        
        for (let i = 0; i < cols; i++) {
            for (let j = 0; j < rows; j++) {
                this.dots.push({
                    x: marginX + i * gridSize + gridSize / 2,
                    y: marginY + j * gridSize + gridSize / 2,
                    speed: 0.5 + Math.random() * 1.5,
                    offset: Math.random() * Math.PI * 2
                });
            }
        }

        const positions = new Float32Array(this.dots.flatMap(dot => [dot.x, dot.y]));
        const speeds = new Float32Array(this.dots.map(dot => dot.speed));
        const offsets = new Float32Array(this.dots.map(dot => dot.offset));

        this.gl.bindVertexArray(this.vao);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(this.positionLocation);
        this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.speedBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, speeds, this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(this.speedLocation);
        this.gl.vertexAttribPointer(this.speedLocation, 1, this.gl.FLOAT, false, 0, 0);

        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.offsetBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, offsets, this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(this.offsetLocation);
        this.gl.vertexAttribPointer(this.offsetLocation, 1, this.gl.FLOAT, false, 0, 0);

        this.gl.bindVertexArray(null);
    }

    drawDots() {
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);

        this.gl.useProgram(this.program);
        this.gl.bindVertexArray(this.vao);

        this.gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height);
        this.gl.uniform1f(this.timeLocation, this.time);

        this.gl.drawArrays(this.gl.POINTS, 0, this.dots.length);

        this.gl.bindVertexArray(null);
    }

    stop() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    animate() {
        this.time += 0.016;
        this.drawDots();
        this.animationFrame = requestAnimationFrame(() => this.animate());
    }
}

new WebGL2DotsAnimation();