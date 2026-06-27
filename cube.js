// cube.js - Core Rubik's Cube representation and physics

// Helper to rotate a vector v around unit axis n by 90 degrees (clockwise or counter-clockwise)
// Using Rodrigues' rotation formula for theta = -90 (CW) or +90 (CCW)
function rotateVector(v, n, clockwise) {
    const [x, y, z] = v;
    const [nx, ny, nz] = n;
    // Dot product
    const dot = x*nx + y*ny + z*nz;
    // Cross product n x v
    const cx = ny*z - nz*y;
    const cy = nz*x - nx*z;
    const cz = nx*y - ny*x;
    
    const sign = clockwise ? -1 : 1;
    return [
        nx * dot + sign * cx,
        ny * dot + sign * cy,
        nz * dot + sign * cz
    ];
}

// Find the index of the facelet closest to a given position and normal
function findClosestFacelet(pos, normal, facelets) {
    let minDist = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < facelets.length; i++) {
        const f = facelets[i];
        const dx = pos[0] - f.pos[0];
        const dy = pos[1] - f.pos[1];
        const dz = pos[2] - f.pos[2];
        const distPos = dx*dx + dy*dy + dz*dz;
        
        const dnx = normal[0] - f.normal[0];
        const dny = normal[1] - f.normal[1];
        const dnz = normal[2] - f.normal[2];
        const distNorm = dnx*dnx + dny*dny + dnz*dnz;
        
        const totalDist = distPos + distNorm;
        if (totalDist < minDist) {
            minDist = totalDist;
            bestIdx = i;
        }
    }
    return bestIdx;
}

// Generate the initial facelets for a 3x3 cube
function generate3x3Facelets() {
    const facelets = [];
    
    // Up (U): y = 1.5, White
    for (let z of [1, 0, -1]) {
        for (let x of [-1, 0, 1]) {
            facelets.push({ pos: [x, 1.5, z], normal: [0, 1, 0], color: 'W', face: 'U' });
        }
    }
    
    // Down (D): y = -1.5, Yellow
    for (let z of [-1, 0, 1]) {
        for (let x of [-1, 0, 1]) {
            facelets.push({ pos: [x, -1.5, z], normal: [0, -1, 0], color: 'Y', face: 'D' });
        }
    }
    
    // Left (L): x = -1.5, Orange
    for (let y of [1, 0, -1]) {
        for (let z of [-1, 0, 1]) {
            facelets.push({ pos: [-1.5, y, z], normal: [-1, 0, 0], color: 'O', face: 'L' });
        }
    }
    
    // Right (R): x = 1.5, Red
    for (let y of [1, 0, -1]) {
        for (let z of [1, 0, -1]) {
            facelets.push({ pos: [1.5, y, z], normal: [1, 0, 0], color: 'R', face: 'R' });
        }
    }
    
    // Front (F): z = 1.5, Green
    for (let y of [1, 0, -1]) {
        for (let x of [-1, 0, 1]) {
            facelets.push({ pos: [x, y, 1.5], normal: [0, 0, 1], color: 'G', face: 'F' });
        }
    }
    
    // Back (B): z = -1.5, Blue
    for (let y of [1, 0, -1]) {
        for (let x of [1, 0, -1]) {
            facelets.push({ pos: [x, y, -1.5], normal: [0, 0, -1], color: 'B', face: 'B' });
        }
    }
    
    return facelets;
}

// Generate the initial facelets for a 2x2 cube
function generate2x2Facelets() {
    const facelets = [];
    
    // Up (U): y = 1.0, White
    for (let z of [0.5, -0.5]) {
        for (let x of [-0.5, 0.5]) {
            facelets.push({ pos: [x, 1.0, z], normal: [0, 1, 0], color: 'W', face: 'U' });
        }
    }
    
    // Down (D): y = -1.0, Yellow
    for (let z of [-0.5, 0.5]) {
        for (let x of [-0.5, 0.5]) {
            facelets.push({ pos: [x, -1.0, z], normal: [0, -1, 0], color: 'Y', face: 'D' });
        }
    }
    
    // Left (L): x = -1.0, Orange
    for (let y of [0.5, -0.5]) {
        for (let z of [-0.5, 0.5]) {
            facelets.push({ pos: [-1.0, y, z], normal: [-1, 0, 0], color: 'O', face: 'L' });
        }
    }
    
    // Right (R): x = 1.0, Red
    for (let y of [0.5, -0.5]) {
        for (let z of [0.5, -0.5]) {
            facelets.push({ pos: [1.0, y, z], normal: [1, 0, 0], color: 'R', face: 'R' });
        }
    }
    
    // Front (F): z = 1.0, Green
    for (let y of [0.5, -0.5]) {
        for (let x of [-0.5, 0.5]) {
            facelets.push({ pos: [x, y, 1.0], normal: [0, 0, 1], color: 'G', face: 'F' });
        }
    }
    
    // Back (B): z = -1.0, Blue
    for (let y of [0.5, -0.5]) {
        for (let x of [0.5, -0.5]) {
            facelets.push({ pos: [x, y, -1.0], normal: [0, 0, -1], color: 'B', face: 'B' });
        }
    }
    
    return facelets;
}

// Build the permutation array for a given move
function buildPermutation(initialFacelets, axisNormal, thresholdCond, clockwise) {
    const p = new Array(initialFacelets.length);
    for (let j = 0; j < initialFacelets.length; j++) {
        const jFacelet = initialFacelets[j];
        if (thresholdCond(jFacelet.pos)) {
            // Rotate backwards to find where this slot gets its color from
            const prevPos = rotateVector(jFacelet.pos, axisNormal, !clockwise);
            const prevNormal = rotateVector(jFacelet.normal, axisNormal, !clockwise);
            p[j] = findClosestFacelet(prevPos, prevNormal, initialFacelets);
        } else {
            p[j] = j;
        }
    }
    return p;
}

// Represents a Rubik's Cube state and transitions
class RubiksCube {
    constructor(size = 3) {
        this.size = size;
        this.initialFacelets = size === 3 ? generate3x3Facelets() : generate2x2Facelets();
        // Initial state is just the colors of the initial facelets
        this.state = this.initialFacelets.map(f => f.color);
        
        // Define moves and their permutations
        this.moves = {};
        this.initMoves();
    }
    
    initMoves() {
        const threshold = this.size === 3 ? 0.5 : 0.1;
        const faceletDefs = this.initialFacelets;
        
        const moveSpecs = {
            'U': { axis: [0, 1, 0], cond: p => p[1] > threshold },
            'D': { axis: [0, -1, 0], cond: p => p[1] < -threshold },
            'R': { axis: [1, 0, 0], cond: p => p[0] > threshold },
            'L': { axis: [-1, 0, 0], cond: p => p[0] < -threshold },
            'F': { axis: [0, 0, 1], cond: p => p[2] > threshold },
            'B': { axis: [0, 0, -1], cond: p => p[2] < -threshold }
        };
        
        for (let name in moveSpecs) {
            const spec = moveSpecs[name];
            // Clockwise move
            this.moves[name] = buildPermutation(faceletDefs, spec.axis, spec.cond, true);
            // Counter-clockwise (prime) move
            this.moves[name + "'"] = buildPermutation(faceletDefs, spec.axis, spec.cond, false);
            // Double move (we can generate the permutation directly by applying clockwise twice)
            const pCW = this.moves[name];
            const p2 = new Array(faceletDefs.length);
            for (let i = 0; i < faceletDefs.length; i++) {
                p2[i] = pCW[pCW[i]];
            }
            this.moves[name + "2"] = p2;
        }
    }
    
    // Apply a move name (e.g. "R", "U'") to a state and return the new state
    applyMove(state, moveName) {
        const p = this.moves[moveName];
        if (!p) throw new Error("Unknown move: " + moveName);
        const next = new Array(state.length);
        for (let j = 0; j < state.length; j++) {
            next[j] = state[p[j]];
        }
        return next;
    }
    
    // Check if a state is solved (each face must have only 1 unique color)
    isSolved(state) {
        // Since we know the grouping of facelets by face, we can verify
        const faceletCount = this.size === 3 ? 9 : 4;
        for (let f = 0; f < 6; f++) {
            const startIdx = f * faceletCount;
            const baseColor = state[startIdx];
            for (let i = 1; i < faceletCount; i++) {
                if (state[startIdx + i] !== baseColor) {
                    return false;
                }
            }
        }
        return true;
    }
    
    // Get all valid moves
    getMoves() {
        return Object.keys(this.moves);
    }
    
    // Helper to get string representation of state
    getStateString(state) {
        return state.join('');
    }
}

// Export for Node/CommonJS or attach to window for browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { RubiksCube, rotateVector, findClosestFacelet };
} else {
    window.RubiksCube = RubiksCube;
}
