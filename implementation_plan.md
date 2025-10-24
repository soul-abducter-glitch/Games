# Implementation Plan

## Overview
This plan outlines the refactoring of the existing game to align with the discrete, tick-based mechanics of an original LCD game, replacing continuous physics with segmented movement and updating rendering to reflect this style. The implementation will remove all physics-based updates, continuous movement, and collision detection, replacing them with a system driven by global and spawn timers, discrete egg positions on predefined tracks, and pose-based catching logic. The rendering will be strictly LCD-style, showing only active segments during gameplay and introducing a diagnostic SCREEN mode for calibration.

The goal is to transform the current game from a physics-driven, smoothly animated experience into a classic LCD-style game with discrete states and movements. This involves a fundamental shift in how game elements are updated, rendered, and how player interactions are processed. The existing codebase, primarily `main.js` and `index.html`, will be modified to remove continuous physics, implement a new tick-based game loop, manage discrete egg positions on tracks, and update the rendering pipeline to display only active segments and handle the player/basket as separate layers.

## Types
The type system changes will primarily involve defining new data structures to represent the discrete states of game entities.

- **`GameState`**: An object to hold the overall game state, including:
    - `score`: `number` (0-9999)
    - `lives`: `number` (0-3)
    - `currentMode`: `string` ('A' or 'B')
    - `playerPose`: `string` ('LT', 'LB', 'RB', 'RT')
    - `eggs`: `Array<EggState | null>` (4 elements, one for each lane)
    - `tickMs`: `number` (current global tick interval in milliseconds)
    - `spawnTimer`: `number` (time until next egg spawn)
    - `gameOver`: `boolean`
    - `screenMode`: `boolean` (for diagnostic display)
    - `mute`: `boolean`
    - `brokenEggs`: `Array<{ lane: string, timer: number }>` (for visual feedback)

- **`EggState`**: An object representing an active egg on a track.
    - `lane`: `string` ('LT', 'LB', 'RB', 'RT')
    - `segment`: `number` (0, 1, 2, or 3)
    - `id`: `number` (unique identifier for the egg)

- **`LaneConfig`**: An object to define the fixed points for each lane.
    - `name`: `string` ('LT', 'LB', 'RB', 'RT')
    - `segments`: `Array<{ x: number, y: number }>` (4 points for S0, S1, S2, S3)

## Files
File modifications will primarily focus on `main.js` and `index.html`.

- **`main.js`**:
    - **Modifications**:
        - Remove `velocity`, `gravity`, `dt`-integration, `colliders`/`triggers`.
        - Remove smooth pixel-based egg movements.
        - Remove rendering of all eggs at once on a track (ghosts).
        - Update `state` object to include new `GameState` properties.
        - Modify `loop(timestamp)` and `step(dt)` to remove physics and integrate tick-based logic.
        - Implement `processTick()` function as described in section 5 of the prompt.
        - Modify `updateSpawner(dt)` to use the new spawn timers and rules.
        - Modify `setPlayerPose(pose)` to be instantaneous and cyclic.
        - Update `handleCatch()` and `handleMiss()` to reflect discrete catching logic.
        - Implement `checkDifficultyScaling()` for `tickMs` acceleration.
        - Modify `render()` to draw only active segments, handle basket as a separate layer, and implement SCREEN mode.
        - Update `drawEggs()`, `drawBrokenEggs()`, `drawDog()`, `drawMouse()` to use new discrete positions and rendering rules.
        - Modify `bindEvents()` to handle new game mode buttons (A/B), SCREEN, and mute.
        - Update `startGame()`, `resetGame()`, `handleGameOver()` to reflect new game states.
        - Remove `drawAllInactiveElements()` or modify it to only draw ghosts in SCREEN mode.
        - Update `applyLcdStyles()` to ensure proper scaling and styling.
    - **New functions**:
        - `initializeGame(mode)`: Sets up initial game state for Game A or Game B.
        - `updateGameLogic()`: Orchestrates the `processTick` and other game logic updates.
        - `drawBasket()`: Renders the basket as a separate layer.
        - `drawSegment(lane, segmentIndex, isActive, isGhost)`: Helper function for drawing individual segments.

- **`index.html`**:
    - **Modifications**:
        - Update UI elements for score, lives, game over screen, and game mode buttons.
        - Ensure proper z-ordering for background, dog, basket, eggs, UI.
        - Replace existing character assets (wolf/hare) with dog/mouse.
        - Add elements for the separate basket layer.
        - Adjust CSS for LCD-style rendering, scaling, and letterboxing.

## Functions
Function modifications will be extensive, with many existing functions being refactored and new ones introduced.

- **New functions**:
    - `initializeGame(mode: 'A' | 'B')`: `main.js`, Initializes all game state variables for the selected mode.
    - `updateGameLogic()`: `main.js`, The main game logic loop, called on each tick.
    - `drawBasket(pose: string)`: `main.js`, Renders the basket asset at the correct position based on the player's pose.
    - `drawSegment(lane: string, segmentIndex: number, isActive: boolean, isGhost: boolean)`: `main.js`, Renders a single egg segment, handling active and ghost states.

- **Modified functions**:
    - `loop(timestamp)`: `main.js`, Will be refactored to remove `dt` integration and physics, instead calling `updateGameLogic()` based on `tickMs`.
    - `step(dt)`: `main.js`, Will be removed or heavily modified to only handle timer updates, not physics.
    - `updateTimers(dt)`: `main.js`, Will be modified to manage `tickMs` and `spawnTimer`.
    - `updateSpawner(dt)`: `main.js`, Will be updated to spawn eggs based on `spawnTimer` and game mode rules (1 or 2 eggs, random interval).
    - `updateMouse(dt)`: `main.js`, Will be updated to trigger mouse "joy" animation on score thresholds.
    - `updateTicks(dt)`: `main.js`, Will be removed or integrated into `updateGameLogic()`.
    - `processTick()`: `main.js`, This will be the core logic for egg movement, catching, and missing. It will be completely rewritten to handle discrete segment transitions and pose-based collision.
    - `resolveEgg(index)`: `main.js`, Will be modified to handle egg removal after catch/miss.
    - `handleCatch()`: `main.js`, Will be updated to increment score, play sound, and remove egg.
    - `handleMiss(lane)`: `main.js`, Will be updated to decrement lives, show broken egg, play sound, and remove egg.
    - `checkDifficultyScaling()`: `main.js`, Will be implemented to reduce `tickMs` every 20 points, down to 120ms.
    - `spawnEgg()`: `main.js`, Will be updated to place eggs on S0 of free lanes, respecting the "max 1 egg per lane" rule.
    - `setPlayerPose(pose, options = {})`: `main.js`, Will be modified to instantly change the player's pose without animation.
    - `toggleScreenMode()`: `main.js`, Will be implemented to switch between normal rendering and diagnostic SCREEN mode.
    - `render()`: `main.js`, Will be heavily refactored to draw only active segments, the dog, the separate basket, eggs, and UI elements in the correct z-order.
    - `drawAllInactiveElements()`: `main.js`, Will be modified to only draw "ghost" segments when `screenMode` is active.
    - `drawActiveCatcher()`: `main.js`, Will be modified to draw the dog based on `playerPose` and call `drawBasket()`.
    - `drawEggs()`: `main.js`, Will be updated to draw eggs at their discrete segment positions.
    - `drawBrokenEggs()`: `main.js`, Will be updated to draw broken egg sprites at miss locations for a fixed duration.
    - `drawScore()`: `main.js`, Will be updated to display score (max 9999) centrally.
    - `drawDog(point)`: `main.js`, Will be updated to draw the dog silhouette based on `playerPose`.
    - `drawMouse(isActive)`: `main.js`, Will be updated to draw the mouse with "joy" animation on score thresholds.
    - `drawEggAt(x, y)`: `main.js`, Will be updated to draw the egg silhouette.
    - `drawBrokenEggAt(x, y)`: `main.js`, Will be updated to draw the broken egg sprite.
    - `init()`: `main.js`, Will be updated to initialize the new game state and bind events.
    - `startGame()`: `main.js`, Will be updated to start the game loop and timers for the selected mode.
    - `resetGame()`: `main.js`, Will be updated to reset all game state variables.
    - `enterAttract()`: `main.js`, Will be updated to reflect the new game start state.
    - `handleGameOver()`: `main.js`, Will be updated to stop timers, show game over screen, and allow restart.
    - `bindEvents()`: `main.js`, Will be updated to handle new input actions for game modes, screen mode, and mute.

- **Removed functions**:
    - Functions related to continuous physics, velocity, gravity, and collision detection will be removed. This includes any functions that calculate smooth interpolation between points for eggs or player movement.

## Classes
The current codebase appears to be primarily functional, without explicit class definitions for game entities. No new classes are planned, and no existing classes will be modified or removed. The game state will be managed using a global state object and helper functions.

## Dependencies
No new external dependencies are planned. The project will continue to use vanilla JavaScript, HTML, and CSS.

## Testing
The testing approach will involve manual verification of all new and modified game mechanics and rendering.

- **Test file requirements**: No dedicated test files will be created.
- **Existing test modifications**: N/A, as there are no explicit test files.
- **Validation strategies**:
    - **Discrete Movement**: Visually confirm that eggs move segment by segment, without any smooth transitions.
    - **Catching/Missing Logic**: Test all four lanes and player poses to ensure correct catching and missing behavior, especially when multiple eggs arrive at S3 simultaneously.
    - **Timers and Difficulty**: Verify `tickMs` acceleration every 20 points, and that spawn timers adhere to Game A/B rules.
    - **UI**: Confirm score, lives, Game Over, and mode indicators update correctly.
    - **SCREEN Mode**: Toggle SCREEN mode to verify that ghost segments appear/disappear as expected and that S3 points align with the basket.
    - **Input Controls**: Test left/right movement for cyclic pose changes, and all other buttons (GAME A/B, RESTART, SCREEN, ♪) for correct functionality.
    - **Z-ordering**: Visually confirm the correct rendering order of background, dog, basket, eggs, and UI.
    - **Assets**: Verify that dog, basket, mouse, egg, and broken egg assets are displayed correctly and that no forbidden assets (wolf/hare) are present.

## Implementation Order
The implementation sequence will prioritize core game mechanics before refining rendering and UI.

1. **Disable/Remove Physics**: Remove all existing physics-based updates, continuous movement, and collision detection from `main.js`.
2. **Define Game State**: Introduce the `GameState` and `EggState` data structures in `main.js`.
3. **Implement Timers**: Set up `tickMs` and `spawnTimer` mechanisms in `main.js`.
4. **Implement Player Pose Control**: Modify `setPlayerPose` for instantaneous, cyclic movement.
5. **Implement `processTick` Logic**: Develop the core tick-based egg movement, catching, and missing logic in `main.js`.
6. **Update Egg Spawning**: Refactor `spawnEgg` and `updateSpawner` to adhere to new rules.
7. **Refactor Rendering**:
    a. Modify `render()` to draw only active segments.
    b. Separate basket rendering from the dog.
    c. Implement correct z-ordering.
    d. Implement SCREEN mode toggle and ghost segment rendering.
8. **Update UI and Game Flow**: Implement Game A/B, Restart, Game Over, score, and lives updates.
9. **Integrate Difficulty Scaling**: Implement `checkDifficultyScaling` for `tickMs` acceleration.
10. **Sound and Mute**: Connect sound effects and implement mute functionality.
11. **Mouse Animation**: Implement mouse "joy" animation on score thresholds.
12. **Coordinate Calibration**: Use SCREEN mode to calibrate segment coordinates, ensuring S3 aligns with the basket.
13. **Final Review**: Conduct a comprehensive check against the acceptance checklist.
