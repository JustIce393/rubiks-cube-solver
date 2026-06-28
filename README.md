# 3D Rubik's Cube Solver

> An interactive web-based 3D Rubik's Cube simulator and solver powered by a background **Web Worker Thread** running **Graph Search Algorithms (BFS, DFS, IDDFS)**.

![Language](https://img.shields.io/badge/language-HTML5%20%2F%20CSS3%20%2F%20JavaScript-yellow)
![Worker](https://img.shields.io/badge/threading-Web%20Workers-blue)
![License](https://img.shields.io/badge/license-MIT-green)

---

## 📌 What is this Project?

This project is an interactive 3D Rubik's Cube simulation that runs entirely in the web browser. Users can scramble the cube, perform moves manually using key controls or UI buttons, and trigger an automated solver. It showcases:
1. **Interactive 3D Render Engine:** Built using pure CSS 3D transforms (`transform-style: preserve-3d`) and vanilla JS, avoiding heavy WebGL libraries.
2. **Background Thread Solving:** Moves pathfinding algorithms into a separate browser thread using the **Web Workers API**, preventing UI freezing.
3. **Advanced Graph Search:** Implements Breadth-First Search (BFS), Depth-First Search (DFS), and Iterative Deepening DFS (IDDFS) to find solution paths.
4. **Move Pruning Optimizations:** Reduces the search space branch factor by pruning redundant moves and enforcing canonical face-move orderings.

---

## 🏗️ Pathfinding & Search Algorithms

Solving a 3x3 Rubik's Cube has a total state space of over **\(4.3 \times 10^{19}\)** combinations. To find solutions in a web browser within seconds, the solver uses tailored graph search methods:

| Algorithm | Search Model | Space Complexity | Time Guarantee | Best For |
| :--- | :--- | :--- | :--- | :--- |
| **BFS** | Queue-based flat array | \(O(B^D)\) — High memory | Guarantees shortest path | Shorter scrambles (depth < 6) |
| **DFS** | Recursive path stack | \(O(D)\) — Ultra low memory | Not guaranteed shortest | Deep search / checking existences |
| **IDDFS** | Iterative depth-bound DFS | \(O(D)\) — Ultra low memory | Guarantees shortest path | Deep scrambles without memory exhaust |

### Search Space Pruning
To reduce the branching factor from 18 (6 faces \(\times\) 3 directions) to a manageable level:
1. **Consecutive Face Pruning:** Prevents redundant moves on the same face (e.g., performing `R` immediately followed by `R'` or another `R`).
2. **Commuting Face Canonical Ordering:** Opposite faces commute (e.g., `R L` results in the same state as `L R`). The solver enforces a canonical priority order (U before D, F before B, R before L) and prunes commuting variations (e.g., pruning a trailing `R` in `R L R`).

---

## 🚀 How to Run

1. Clone or download the repository.
2. Simply open `index.html` in a web browser.
3. Click **Scramble** to shuffle the cube, select your preferred algorithm (BFS, DFS, or IDDFS), and click **Solve** to watch the solver search in real-time and replay the solution steps.

---

## 📁 Project Structure

```
rubiks-cube-solver/
├── index.html       <- Main SPA interface and 3D cube markup
├── style.css        <- 3D cube CSS styles & animations
├── renderer.js      <- Manages 3D rendering and manual rotations
├── cube.js          <- Pure state representation and turn logic
├── solver.js        <- Web Worker thread running pathfinding solvers
└── server.js        <- Mini Node.js server (optional, for local hosting)
```

---

## 💡 SDE Interview Q&A

### Q1: Why did you run the solving algorithms in a Web Worker?
> JavaScript is single-threaded. Because pathfinding on a Rubik's Cube can visit millions of nodes and take up to 20 seconds, running it on the main UI thread would block the browser's event loop. This would cause the entire page to freeze, stop animations, and trigger a "Page Unresponsive" popup. By offloading the search to a `Web Worker`, the computations run in a separate background thread, allowing the main thread to render smooth animations and show a live search progress count (elapsed time, nodes visited) back to the user.

### Q2: Why is IDDFS preferred over BFS for deeper solution searches?
> BFS stores every visited state in a queue to traverse level-by-level, which results in an exponential space complexity of \(O(B^D)\). For a branching factor \(B \approx 12\) (after basic pruning), searching to depth 7 would require storing millions of states in memory, quickly crashing the browser tab's heap. IDDFS combines the depth-first search space efficiency of \(O(D)\) with the shortest-path guarantee of BFS by running depth-limited DFS repeatedly, incrementing the limit by 1 each time. It uses virtually no memory.

### Q3: How does your CSS-only 3D rendering engine work?
> Instead of bringing in three.js or canvas-based WebGL, I utilized CSS 3D capabilities. The cube is represented as a container with `transform-style: preserve-3d`. Each of the 26 cubies is a `div` positioned in 3D space using `translate3d`. The faces of each cubie are rotated using `rotateX`, `rotateY`, and `rotateZ`. To rotate a slice, the code groups the active cubies into a temporary rotation element, applies a CSS transition for the rotation angle, updates the underlying state array, and reconstructs the flat layout.
