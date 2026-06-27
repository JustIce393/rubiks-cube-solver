// renderer.js - Three.js 3D Rubik's Cube Visualizer (Fixed)

const COLOR_MAP = {
    'W': 0xffffff,  // White
    'Y': 0xffd700,  // Gold
    'O': 0xff6b00,  // Orange
    'R': 0xe50914,  // Red
    'G': 0x00e676,  // Green
    'B': 0x2979ff   // Blue
};

class CubeRenderer {
    constructor(containerId, size = 3) {
        this.containerId = containerId;
        this.container   = document.getElementById(containerId);
        this.size        = size;
        this.cubies      = [];
        this.stickers    = [];
        this.isAnimating = false;
        this._animFrame  = null;

        this._initThree();
        this._buildCube();
    }

    // ─── Initialise Three.js scene (called once) ─────────────────────────────
    _initThree() {
        this.container.innerHTML = '';

        this.scene = new THREE.Scene();

        const w = this.container.clientWidth  || 800;
        const h = this.container.clientHeight || 600;

        this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
        this.camera.position.set(6, 6, 8);
        this.camera.lookAt(0, 0, 0);

        this.threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.threeRenderer.setSize(w, h);
        this.threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.container.appendChild(this.threeRenderer.domElement);

        // Orbit controls — OrbitControls attaches to THREE.OrbitControls via the UMD build
        this.controls = new THREE.OrbitControls(this.camera, this.threeRenderer.domElement);
        this.controls.enableDamping  = true;
        this.controls.dampingFactor  = 0.06;
        this.controls.minDistance    = 4;
        this.controls.maxDistance    = 18;
        this.controls.enablePan      = false;

        // Lighting
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.65));
        const d1 = new THREE.DirectionalLight(0xffffff, 0.8);
        d1.position.set(5, 10, 7);
        this.scene.add(d1);
        const d2 = new THREE.DirectionalLight(0xffffff, 0.35);
        d2.position.set(-5, -5, -5);
        this.scene.add(d2);

        // Render loop
        this._loop = this._loop.bind(this);
        requestAnimationFrame(this._loop);

        // Responsive resize
        window.addEventListener('resize', this._onResize.bind(this));
    }

    _loop() {
        this._animFrame = requestAnimationFrame(this._loop);
        this.controls.update();
        this.threeRenderer.render(this.scene, this.camera);
    }

    _onResize() {
        if (!this.container || !this.threeRenderer) return;
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.threeRenderer.setSize(w, h);
    }

    // ─── Rebuild geometry when cube size changes ──────────────────────────────
    rebuild(newSize) {
        this.size = newSize;
        // Remove old cubies from scene
        this.cubies.forEach(c => this.scene.remove(c));
        this.cubies   = [];
        this.stickers = [];
        this._buildCube();
    }

    // ─── Construct 3D cubies + coloured stickers ─────────────────────────────
    _buildCube() {
        const cubeModel = new RubiksCube(this.size);
        const facelets  = cubeModel.initialFacelets;

        // Cubie grid positions
        const coords    = this.size === 3 ? [-1, 0, 1] : [-0.5, 0.5];
        const cubieSize = this.size === 3 ? 0.94 : 0.93;

        const geomCubie  = new THREE.BoxGeometry(cubieSize, cubieSize, cubieSize);
        const matCubie   = new THREE.MeshLambertMaterial({ color: 0x111111 });

        const cubieMap = {};

        for (const x of coords) {
            for (const y of coords) {
                for (const z of coords) {
                    const mesh = new THREE.Mesh(geomCubie, matCubie);
                    mesh.position.set(x, y, z);
                    this.scene.add(mesh);
                    this.cubies.push(mesh);
                    cubieMap[this._key(x, y, z)] = mesh;
                }
            }
        }

        // Sticker geometry (thin slabs)
        const thick = 0.03;
        const span  = this.size === 3 ? 0.80 : 0.82;
        const geomX = new THREE.BoxGeometry(thick, span, span);
        const geomY = new THREE.BoxGeometry(span, thick, span);
        const geomZ = new THREE.BoxGeometry(span, span, thick);
        const offset = this.size === 3 ? 0.47 : 0.465;

        facelets.forEach((f, idx) => {
            const [fx, fy, fz] = f.pos;
            const [nx, ny, nz] = f.normal;

            // Map facelet coordinate to its parent cubie coordinate
            const cx = this._snapCoord(fx, this.size);
            const cy = this._snapCoord(fy, this.size);
            const cz = this._snapCoord(fz, this.size);

            const cubie = cubieMap[this._key(cx, cy, cz)];
            if (!cubie) { this.stickers[idx] = null; return; }

            const geom  = Math.abs(nx) > 0.5 ? geomX : Math.abs(ny) > 0.5 ? geomY : geomZ;
            const mat   = new THREE.MeshLambertMaterial({ color: COLOR_MAP[f.color] });
            const stick = new THREE.Mesh(geom, mat);

            stick.position.set(nx * offset, ny * offset, nz * offset);
            cubie.add(stick);
            this.stickers[idx] = stick;
        });
    }

    _snapCoord(val, size) {
        if (size === 3) {
            if (val >  1) return  1;
            if (val < -1) return -1;
            return Math.round(val);
        } else {
            return val > 0 ? 0.5 : -0.5;
        }
    }

    _key(x, y, z) {
        return `${x.toFixed(1)},${y.toFixed(1)},${z.toFixed(1)}`;
    }

    // ─── Instantly update all sticker colours from state array ───────────────
    updateState(state) {
        state.forEach((color, idx) => {
            const s = this.stickers[idx];
            if (s) s.material.color.setHex(COLOR_MAP[color]);
        });
    }

    // ─── Animate a face rotation ─────────────────────────────────────────────
    animateMove(moveName, _oldState, newState, duration = 250) {
        // If already animating, snap finish and start new animation
        if (this.isAnimating) {
            this.updateState(newState);
            return Promise.resolve();
        }
        this.isAnimating = true;

        return new Promise(resolve => {
            const threshold = this.size === 3 ? 0.5 : 0.1;
            const base      = moveName[0];
            const isPrime   = moveName.includes("'");
            const isDouble  = moveName.includes('2');

            // Determine axis and sign
            let axisVec = new THREE.Vector3();
            let sign    = isPrime ? +1 : -1;  // -1 = CW, +1 = CCW
            if (isDouble) sign = -Math.PI / (Math.PI / 2); // effectively doubles the angle below

            let targetAngle;
            let filterFn;

            switch (base) {
                case 'U': axisVec.set(0, 1, 0); filterFn = c => c.position.y >  threshold; break;
                case 'D': axisVec.set(0, 1, 0); filterFn = c => c.position.y < -threshold; sign = -sign; break;
                case 'R': axisVec.set(1, 0, 0); filterFn = c => c.position.x >  threshold; break;
                case 'L': axisVec.set(1, 0, 0); filterFn = c => c.position.x < -threshold; sign = -sign; break;
                case 'F': axisVec.set(0, 0, 1); filterFn = c => c.position.z >  threshold; break;
                case 'B': axisVec.set(0, 0, 1); filterFn = c => c.position.z < -threshold; sign = -sign; break;
                default:
                    this.isAnimating = false;
                    this.updateState(newState);
                    resolve();
                    return;
            }

            targetAngle = isDouble ? sign * Math.PI : sign * (Math.PI / 2);

            const movingCubies = this.cubies.filter(filterFn);

            // Pivot group at origin
            const pivot = new THREE.Group();
            this.scene.add(pivot);
            movingCubies.forEach(c => pivot.add(c));

            const startT = performance.now();

            const tick = (now) => {
                const elapsed  = now - startT;
                const t        = Math.min(elapsed / duration, 1);
                // Sine ease-out
                const eased    = Math.sin(t * Math.PI * 0.5);
                const curAngle = eased * targetAngle;

                pivot.rotation.set(
                    axisVec.x !== 0 ? curAngle : 0,
                    axisVec.y !== 0 ? curAngle : 0,
                    axisVec.z !== 0 ? curAngle : 0
                );

                if (t < 1) {
                    requestAnimationFrame(tick);
                    return;
                }

                // ── Snap & de-parent ──
                const worldPos  = new THREE.Vector3();
                const worldQuat = new THREE.Quaternion();

                movingCubies.forEach(c => {
                    c.getWorldPosition(worldPos);
                    c.getWorldQuaternion(worldQuat);
                    this.scene.add(c);     // re-parent to scene

                    // Snap to integer grid to prevent drift
                    const snap = this.size === 3 ? 1 : 2;
                    c.position.set(
                        Math.round(worldPos.x * snap) / snap,
                        Math.round(worldPos.y * snap) / snap,
                        Math.round(worldPos.z * snap) / snap
                    );
                    // Reset rotation — cubie is symmetric, colour is handled separately
                    c.rotation.set(0, 0, 0);
                });

                this.scene.remove(pivot);

                // Apply new sticker colours
                this.updateState(newState);

                this.isAnimating = false;
                resolve();
            };

            requestAnimationFrame(tick);
        });
    }
}
