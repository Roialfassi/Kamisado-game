# Kamisado Test Suite & Edge-Case Verification Guide

This document defines 25 explicit test scenarios that any coding agent or developer must implement as automated tests to guarantee 100% compliance with Peter Burley's official rules.

---

## Suite 1: Movement & Geometric Validation

### Test 1: Legal Forward Straight Move
* **Setup**: Initial board position.
* **Action**: Black moves Brown tower from `(0, 0)` forward 3 squares to `(3, 0)`.
* **Expected Result**: `SUCCESS`. Piece location is updated to `(3, 0)`. Next active color corresponds to the color of square `(3, 0)`.

### Test 2: Legal Forward Diagonal Moves
* **Setup**: Initial board position.
* **Action**: Black moves Red tower from `(0, 2)` diagonally forward-right to `(3, 5)`.
* **Expected Result**: `SUCCESS`. `(3, 5)` is reached via a clear diagonal line `(1, 3) -> (2, 4) -> (3, 5)`.

### Test 3: Backward Move Rejection
* **Setup**: Black tower at `(4, 4)`.
* **Action**: Attempt to move Black tower backward to `(3, 4)`.
* **Expected Result**: `REJECTED (ILLEGAL_DIRECTION)`. Forward movement only.

### Test 4: Sideways Move Rejection
* **Setup**: Black tower at `(4, 4)`.
* **Action**: Attempt to move Black tower horizontally to `(4, 5)`.
* **Expected Result**: `REJECTED (ILLEGAL_DIRECTION)`. Orthogonal-sideways moves are strictly forbidden.

### Test 5: Obstruction / Jumping Over Pieces Rejected
* **Setup**: Black tower at `(0, 3)`. Opponent tower at `(2, 3)`.
* **Action**: Black attempts to move tower to `(4, 3)`.
* **Expected Result**: `REJECTED (PATH_OBSTRUCTED)`. Jumping over pieces is illegal.

### Test 6: Destination Occupied Rejected
* **Setup**: Black tower at `(0, 3)`. Opponent tower at `(3, 3)`.
* **Action**: Black attempts to land directly on `(3, 3)`.
* **Expected Result**: `REJECTED (DESTINATION_OCCUPIED)`. Two pieces can never occupy the same square.

### Test 7: Corner-Touching Diagonal Clearance (Rule M4)
* **Setup**: Tower A at `(3, 3)` and Tower B at `(4, 4)` (touching diagonally corner-to-corner).
* **Action**: Tower C at `(4, 3)` attempts to move diagonally forward-right to `(3, 4)`.
* **Expected Result**: `SUCCESS`. Moving between corner-touching pieces is explicitly allowed under Rule M4 if the squares themselves are vacant.

---

## Suite 2: Color Forcing & Turn Constraints

### Test 8: Opening Move Freedom
* **Setup**: Round 1, Turn 1.
* **Action**: Black chooses to move Yellow tower, Orange tower, or Green tower.
* **Expected Result**: `SUCCESS`. The opening player (Black) may move any of their 8 towers.

### Test 9: Strict Color Forcing on Subsequent Turns
* **Setup**: Black lands on square `(3, 2)` which is `PURPLE`.
* **Action 1**: Gold attempts to move Gold Blue tower.
  * **Expected Result**: `REJECTED (COLOR_MISMATCH)`. Must move Purple tower.
* **Action 2**: Gold moves Gold Purple tower.
  * **Expected Result**: `SUCCESS`.

### Test 10: Mandatory Move Rule
* **Setup**: Gold Purple tower has 2 legal forward diagonal moves.
* **Action**: Gold player attempts to pass or select a different tower.
* **Expected Result**: `REJECTED (MANDATORY_MOVE)`. If a legal move exists, moving is compulsory.

---

## Suite 3: Stymie (Pass) & Deadlock Adjudication

### Test 11: Stymie Pass Automation
* **Setup**: Black Purple tower is at `(2, 4)`. Squares `(3, 4)`, `(3, 3)`, and `(3, 5)` are occupied. Black Purple tower has 0 legal moves.
* **Action**: Gold lands on a Purple square.
* **Expected Result**: Black cannot move. Turn forfeits (`PASS`). Gold immediately moves again using the tower matching the color of square `(2, 4)`.

### Test 12: Two-Tower Deadlock Causes Last Mover Loss
* **Setup**: 
  1. Black moves tower to a Blue square.
  2. Gold Blue tower is blocked on an Orange square (Pass).
  3. Black Orange tower is blocked on a Blue square (Pass).
  4. Neither player can make any physical move.
* **Expected Result**: Game declares `ROUND_OVER`. Black was the last player who made a physical move before the deadlock, so Black LOSES the round. Gold is declared the winner!

### Test 13: Multi-Tower Circular Deadlock
* **Setup**: A 3-step pass loop occurs: Player A passes $\to$ Player B passes $\to$ Player A passes $\to$ returns to initial pass state.
* **Expected Result**: `ROUND_OVER`. The player who initiated the sequence with the last physical move loses the round.

---

## Suite 4: Victory Conditions & Round Scoring

### Test 14: Baseline Reach Immediate Victory
* **Setup**: Black tower at `(6, 2)`. Square `(7, 2)` on Gold's home row is empty.
* **Action**: Black moves tower to `(7, 2)`.
* **Expected Result**: `ROUND_OVER`. Black wins the round immediately. The winning tower earns 1 Sumo Ring.

### Test 15: Match Victory Point Threshold
* **Setup**: Match format is `STANDARD` (first to 3 points). Black already has 2 points.
* **Action**: Black wins the round.
* **Expected Result**: `MATCH_OVER`. Black score becomes 3 points. Black is declared the overall match winner.

---

## Suite 5: Sumo Mechanics & Sumo Pushing

### Test 16: Single Sumo Movement Range Limit (Max 5)
* **Setup**: Tower has 1 Sumo Ring (Single Sumo). Path ahead is completely open for 7 squares.
* **Action 1**: Attempt to move forward 6 squares.
  * **Expected Result**: `REJECTED (EXCEEDS_SUMO_RANGE)`. Single Sumo max range is 5.
* **Action 2**: Move forward 5 squares.
  * **Expected Result**: `SUCCESS`.

### Test 17: Double and Triple Sumo Range Limits
* **Setup**: Double Sumo (2 rings) and Triple Sumo (3 rings).
* **Expected Limits**:
  * Double Sumo max forward distance: **3 squares**.
  * Triple Sumo max forward distance: **1 square**.

### Test 18: Legal Sumo Push Execution
* **Setup**: Black Sumo tower at `(3, 3)`. Opponent normal tower at `(4, 3)`. Square `(5, 3)` is empty.
* **Action**: Black executes Sumo push forward.
* **Expected Result**: 
  1. `SUCCESS`.
  2. Black Sumo advances to `(4, 3)`.
  3. Opponent tower is pushed backward to `(5, 3)`.
  4. Opponent skips their turn.
  5. Black moves again immediately using the tower matching the color of `(5, 3)`.

### Test 19: Sumo Push Diagonal Attempt Rejected
* **Setup**: Opponent piece is at `(4, 4)` (diagonally forward-right of Black Sumo at `(3, 3)`).
* **Action**: Black attempts a diagonal Sumo push.
* **Expected Result**: `REJECTED (ILLEGAL_SUMO_PUSH_DIRECTION)`. Sumo pushes can only be performed directly forward.

### Test 20: Sumo Push with Occupied Rear Cell Rejected
* **Setup**: Black Sumo at `(3, 3)`. Opponent tower at `(4, 3)`. A piece occupies square `(5, 3)`.
* **Action**: Black attempts Sumo push.
* **Expected Result**: `REJECTED (SUMO_PUSH_BLOCKED)`. The cell behind the pushed piece must be strictly vacant.

### Test 21: Sumo Push on Home Row Rejected (Rule S6)
* **Setup**: Opponent piece is sitting on its own baseline `(7, 3)`. Black Sumo is at `(6, 3)`.
* **Action**: Black attempts to push the piece backward.
* **Expected Result**: `REJECTED (CANNOT_PUSH_OFF_BOARD)`. Sumo towers cannot push pieces that are currently on their home row.

### Test 22: Sumo Immunity — Equal Rank Push Rejected (Rule S8)
* **Setup**: Black Single Sumo (1 ring) faces Gold Single Sumo (1 ring).
* **Action**: Black attempts Sumo push.
* **Expected Result**: `REJECTED (SUMO_IMMUNITY)`. A Sumo cannot push an opponent Sumo of equal or higher rank.

### Test 23: Sumo Rank Superiority Push Allowed
* **Setup**: Black Double Sumo (2 rings) faces Gold Single Sumo (1 ring). Square behind Gold Sumo is vacant.
* **Action**: Black attempts Sumo push.
* **Expected Result**: `SUCCESS`. A higher-ranked Sumo can push a lower-ranked Sumo.

### Test 24: Multi-Piece Push by Double Sumo
* **Setup**: Black Double Sumo at `(2, 2)`. Opponent towers at `(3, 2)` and `(4, 2)`. Square `(5, 2)` is empty.
* **Action**: Black Double Sumo pushes forward.
* **Expected Result**: `SUCCESS`. Both opponent towers are pushed 1 square backward to `(4, 2)` and `(5, 2)`. Black Sumo advances to `(3, 2)`.

### Test 25: Forced Sumo Push (Rule S11)
* **Setup**: A Sumo tower has no legal diagonal forward moves, but an opponent tower is directly ahead and can be pushed.
* **Action**: Player attempts to declare a pass.
* **Expected Result**: `REJECTED (MANDATORY_PUSH)`. Under Rule S11, if a Sumo push is the sole available move, the player must execute the push.
