// solver.js - Web Worker for Rubik's Cube Solver (Fixed & Improved)

importScripts('cube.js');

let cubeInstance = null;
let nodesVisited = 0;
let startTime = 0;

// Increased limits for a better user experience
const SAFETY_LIMITS = {
    bfs: 1500000,
    dfs: 2000000,
    iddfs: 3000000
};
const TIME_LIMIT_MS = 20000; // 20 seconds max

// --- Improved Move Pruning ---
// Opposite faces commute (R L = L R), so we can enforce a canonical order:
// always put U before D, F before B, R before L.
// If the previous move is the HIGHER-priority face, and current is the LOWER-priority face,
// and the previous-previous move is the SAME face as current → prune.
const OPPOSITE = { 'R': 'L', 'L': 'R', 'U': 'D', 'D': 'U', 'F': 'B', 'B': 'F' };

function isRedundant(move, prevMove, prevPrevMove) {
    if (!prevMove) return false;
    const face = move[0];
    const prevFace = prevMove[0];

    // 1. Never two consecutive moves on the same face (e.g., R, R' is wasteful)
    if (face === prevFace) return true;

    // 2. Canonical ordering for commuting opposite-face pairs:
    //    If prevPrevMove is the same face as the current move AND
    //    the prevMove is the opposite face → this sequence is redundant.
    //    e.g., R … L … R → can always be rewritten as L … R … R → prune the trailing R
    if (prevPrevMove && OPPOSITE[face] === prevFace && prevPrevMove[0] === face) {
        return true;
    }

    return false;
}

function reportProgress() {
    postMessage({
        status: 'searching',
        nodesVisited,
        elapsedTime: Date.now() - startTime,
        solution: null
    });
}

// ===================== BFS =====================
function solveBFS(startState, allowedMoves) {
    // Use a flat array as queue with a head pointer for performance
    const queue = [{ state: startState, path: [] }];
    const visited = new Set();
    visited.add(cubeInstance.getStateString(startState));
    let head = 0;

    while (head < queue.length) {
        if (nodesVisited % 5000 === 0) {
            if (Date.now() - startTime > TIME_LIMIT_MS) return { status: 'timeout' };
            reportProgress();
        }

        const current = queue[head++];
        nodesVisited++;

        if (cubeInstance.isSolved(current.state)) {
            return { status: 'success', path: current.path };
        }

        if (nodesVisited > SAFETY_LIMITS.bfs) return { status: 'limit_exceeded' };

        const prevMove = current.path.length > 0 ? current.path[current.path.length - 1] : null;
        const prevPrevMove = current.path.length > 1 ? current.path[current.path.length - 2] : null;

        for (const move of allowedMoves) {
            if (isRedundant(move, prevMove, prevPrevMove)) continue;

            const nextState = cubeInstance.applyMove(current.state, move);
            const stateStr = cubeInstance.getStateString(nextState);

            if (!visited.has(stateStr)) {
                visited.add(stateStr);
                queue.push({ state: nextState, path: [...current.path, move] });
            }
        }
    }

    return { status: 'failed' };
}

// ===================== DFS =====================
// Pure recursive DFS. Uses a path-based visited set (prevents cycles on current path only).
function dfsHelper(state, depth, maxDepth, path, allowedMoves) {
    nodesVisited++;

    if (nodesVisited % 5000 === 0) {
        if (Date.now() - startTime > TIME_LIMIT_MS) throw new Error('timeout');
        if (nodesVisited > SAFETY_LIMITS.dfs) throw new Error('limit_exceeded');
        reportProgress();
    }

    if (cubeInstance.isSolved(state)) return path;
    if (depth >= maxDepth) return null;

    const prevMove = path.length > 0 ? path[path.length - 1] : null;
    const prevPrevMove = path.length > 1 ? path[path.length - 2] : null;

    for (const move of allowedMoves) {
        if (isRedundant(move, prevMove, prevPrevMove)) continue;

        const nextState = cubeInstance.applyMove(state, move);
        const result = dfsHelper(nextState, depth + 1, maxDepth, [...path, move], allowedMoves);
        if (result !== null) return result;
    }

    return null;
}

function solveDFS(startState, allowedMoves, maxDepth) {
    try {
        const path = dfsHelper(startState, 0, maxDepth, [], allowedMoves);
        return path !== null ? { status: 'success', path } : { status: 'failed' };
    } catch (e) {
        return { status: e.message };
    }
}

// ===================== IDDFS =====================
// Pure IDDFS: no global visited set (memory-efficient by design).
// At each depth limit we run a fresh DFS. This guarantees shortest solution like BFS,
// but with O(depth) memory instead of O(branching^depth).
function iddfsHelper(state, depth, maxDepth, path, allowedMoves) {
    nodesVisited++;

    if (nodesVisited % 5000 === 0) {
        if (Date.now() - startTime > TIME_LIMIT_MS) throw new Error('timeout');
        if (nodesVisited > SAFETY_LIMITS.iddfs) throw new Error('limit_exceeded');
        reportProgress();
    }

    if (cubeInstance.isSolved(state)) return path;
    if (depth >= maxDepth) return null;

    const prevMove = path.length > 0 ? path[path.length - 1] : null;
    const prevPrevMove = path.length > 1 ? path[path.length - 2] : null;

    for (const move of allowedMoves) {
        if (isRedundant(move, prevMove, prevPrevMove)) continue;

        const nextState = cubeInstance.applyMove(state, move);
        const result = iddfsHelper(nextState, depth + 1, maxDepth, [...path, move], allowedMoves);
        if (result !== null) return result;
    }

    return null;
}

function solveIDDFS(startState, allowedMoves) {
    // IDDFS explores depth 0, 1, 2, ... until solution found
    const maxDepthCap = 8; // cap to prevent infinite loops on very deep scrambles

    try {
        for (let limit = 0; limit <= maxDepthCap; limit++) {
            const path = iddfsHelper(startState, 0, limit, [], allowedMoves);
            if (path !== null) return { status: 'success', path };
        }
    } catch (e) {
        return { status: e.message };
    }

    return { status: 'failed' };
}

// ===================== Main Worker Handler =====================
onmessage = function (e) {
    const { state, algorithm, size, maxDepth } = e.data;

    cubeInstance = new RubiksCube(size);
    nodesVisited = 0;
    startTime = Date.now();

    // For 2x2: fix DBL corner and restrict to only 9 moves (removes symmetry duplicates)
    const allowedMoves = size === 2
        ? ['U', "U'", 'U2', 'R', "R'", 'R2', 'F', "F'", 'F2']
        : cubeInstance.getMoves();

    let result;

    try {
        if (cubeInstance.isSolved(state)) {
            result = { status: 'success', path: [] };
        } else if (algorithm === 'bfs') {
            result = solveBFS(state, allowedMoves);
        } else if (algorithm === 'dfs') {
            result = solveDFS(state, allowedMoves, maxDepth || 6);
        } else if (algorithm === 'iddfs') {
            result = solveIDDFS(state, allowedMoves);
        } else {
            result = { status: 'error', message: 'Unknown algorithm' };
        }
    } catch (error) {
        result = { status: 'error', message: error.message };
    }

    postMessage({
        status: result.status,
        nodesVisited,
        elapsedTime: Date.now() - startTime,
        solution: result.path || null
    });
};
