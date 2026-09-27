# Kamisado Game Rules & Mathematical Specification

This document provides the definitive, unambiguous mathematical and logical specification for **Kamisado** as designed by Peter Burley. Any AI coding agent or human developer must adhere strictly to these rules with zero deviations.

---

## 1. Board Representation & Coordinate System

### 1.1 The Colors
Kamisado uses eight colors:
1. `BROWN` (Index 0, `#5D4037`)
2. `GREEN` (Index 1, `#2E7D32`)
3. `RED` (Index 2, `#C62828`)
4. `YELLOW` (Index 3, `#FBC02D`)
5. `PINK` (Index 4, `#EC407A`)
6. `PURPLE` (Index 5, `#7B1FA2`)
7. `BLUE` (Index 6, `#1565C0`)
8. `ORANGE` (Index 7, `#EF6C00`)

### 1.2 Coordinate System (Algebraic & 0-Indexed)
* **Grid Size**: $8 \times 8$ (64 squares).
* **Columns (Files)**: `0` to `7`, labeled `a` through `h` (left-to-right from Black's view).
* **Rows (Ranks)**: `0` to `7`, labeled `1` through `8` (Black home row = row 0 / rank 1; Gold home row = row 7 / rank 8).
* Square coordinates are denoted $(r, c)$ where $r \in [0, 7]$ and $c \in [0, 7]$.

### 1.3 Standard Board Color Matrix
The standard Latin square board satisfies $180^\circ$ rotational symmetry. For any cell $(r, c)$, the color is identical to cell $(7 - r, 7 - c)$:

```
Ranks:
8 (Row 7) [ ORANGE,   BLUE, PURPLE,   PINK, YELLOW,    RED,  GREEN,  BROWN ] (Gold Home Row)
7 (Row 6) [    RED, ORANGE,   PINK,  GREEN,   BLUE, YELLOW,  BROWN, PURPLE ]
6 (Row 5) [  GREEN,   PINK, ORANGE,    RED, PURPLE,  BROWN, YELLOW,   BLUE ]
5 (Row 4) [   PINK, PURPLE,   BLUE, ORANGE,  BROWN,  GREEN,    RED, YELLOW ]
4 (Row 3) [ YELLOW,    RED,  GREEN,  BROWN, ORANGE,   BLUE, PURPLE,   PINK ]
3 (Row 2) [   BLUE, YELLOW,  BROWN, PURPLE,    RED, ORANGE,   PINK,  GREEN ]
2 (Row 1) [ PURPLE,  BROWN, YELLOW,   BLUE,  GREEN,   PINK, ORANGE,    RED ]
1 (Row 0) [  BROWN,  GREEN,    RED, YELLOW,   PINK, PURPLE,   BLUE, ORANGE ] (Black Home Row)
             File a  File b  File c  File d  File e  File f  File g  File h
```

*Verification of properties:*
* Every row and every column contains all 8 colors exactly once (Latin square).
* Black's home row (Row 0): `[BROWN, GREEN, RED, YELLOW, PINK, PURPLE, BLUE, ORANGE]`
* Gold's home row from Gold's viewpoint (looking from Row 7 down to Row 0, left-to-right): `[BROWN, GREEN, RED, YELLOW, PINK, PURPLE, BLUE, ORANGE]`

---

## 2. Initial Setup

* **Black Towers** ($r = 0$): Placed on matching squares:
  * $(0, 0) \to$ Brown
  * $(0, 1) \to$ Green
  * $(0, 2) \to$ Red
  * $(0, 3) \to$ Yellow
  * $(0, 4) \to$ Pink
  * $(0, 5) \to$ Purple
  * $(0, 6) \to$ Blue
  * $(0, 7) \to$ Orange
* **Gold Towers** ($r = 7$): Placed on matching squares:
  * $(7, 0) \to$ Orange
  * $(7, 1) \to$ Blue
  * $(7, 2) \to$ Purple
  * $(7, 3) \to$ Pink
  * $(7, 4) \to$ Yellow
  * $(7, 5) \to$ Red
  * $(7, 6) \to$ Green
  * $(7, 7) \to$ Brown

---

## 3. Movement Rules & Mechanics

### 3.1 Direction of Movement
* **Forward Movement Only**: 
  * Black moves in the direction of increasing row index ($+r$).
  * Gold moves in the direction of decreasing row index ($-r$).
* **Trajectory Vectors**:
  * For Black: $(+k, 0)$ [straight], $(+k, -k)$ [diagonal left], $(+k, +k)$ [diagonal right] for $k \ge 1$.
  * For Gold: $(-k, 0)$ [straight], $(-k, -k)$ [diagonal left], $(-k, +k)$ [diagonal right] for $k \ge 1$.
* **No Backward or Sideways Moves**: Backward and sideways moves are strictly illegal under all circumstances (except when pushed backward by an opponent's Sumo push).

### 3.2 Obstruction & Path Clearance
* A tower may move any distance $k$ provided all intermediate cells and the destination cell are strictly empty.
* **No Jumping**: Pieces cannot jump over other pieces.
* **Corner-Touching Clearance (Rule M4)**: A piece moving diagonally between two pieces that touch at a corner is legally permitted, as long as the intervening diagonal path and destination are clear.

### 3.3 The Core Color-Forcing Rule
* **Turn 1 (Opening Move)**: The Challenger (Black in Round 1) may select and move **any** of their 8 towers.
* **Turn $N > 1$**: The current player **must** move the tower whose color matches the color of the square on which the opponent's previous move landed.
* **Mandatory Action**: If the designated tower has at least one legal move, the player **must** move it.

---

## 4. Special Situations: Stymie (Pass) & Deadlock

### 4.1 Stymie / Pass (Rule M6)
* If the designated color tower has **zero legal forward or diagonal moves** (blocked):
  1. The player's turn is forfeited (**Pass**).
  2. The tower is considered to have executed a zero-length move finishing on its current square.
  3. The opponent moves again immediately.
  4. The color tower the opponent must move is dictated by the **color of the square on which the blocked tower is currently standing**.

### 4.2 Deadlock Resolution (Rule M8)
* A deadlock occurs when a sequence of passes repeats such that neither player can make a physical move.
* **The Deadlock Loss Rule**: The player who made the **last physical move** immediately prior to the deadlock is judged to have caused the deadlock and **loses the round**. The opponent is awarded the victory.

---

## 5. Sumo Rules & Multi-Round Match Play

### 5.1 Match Types & Winning Thresholds
* **Single Round**: First to 1 point.
* **Standard Match**: First to 3 points.
* **Long Match**: First to 7 points.
* **Marathon Match**: First to 15 points.

### 5.2 Sumo Promotion & Ranks
When a tower reaches the opponent's home row ($r = 7$ for Black, $r = 0$ for Gold), it earns a Sumo Ring:
* **Level 1 — Single Sumo** (1 Ring, worth 1 pt): Movement range max 5 squares; can push 1 piece.
* **Level 2 — Double Sumo** (2 Rings, worth 3 pts): Movement range max 3 squares; can push up to 2 pieces.
* **Level 3 — Triple Sumo** (3 Rings, worth 7 pts): Movement range max 1 square; can push up to 3 pieces.
* **Level 4 — Quadruple Sumo** (4 Rings, worth 15 pts): Match automatically won.

### 5.3 Sumo Push Mechanics
1. **Direction**: Orthogonal-forward only (never diagonal).
2. **Contact**: The opponent's tower must be on the cell immediately in front of the Sumo tower.
3. **Empty Cell Requirement**: There must be an empty square directly behind the pushed opponent piece(s).
4. **Home Row Immunity (Rule S6)**: A Sumo cannot push an opponent's piece if that piece is currently on its own home row (cannot push pieces off the board).
5. **Sumo Immunity (Rule S8)**: A Sumo cannot push another Sumo of equal or higher rank.
   * Single Sumo can push: Normal towers only.
   * Double Sumo can push: Normal towers and Single Sumos.
   * Triple Sumo can push: Normal towers, Single Sumos, and Double Sumos.
6. **Turn Sequence After a Push (Rule S3)**:
   * The Sumo tower moves 1 space forward, shifting the opponent's piece(s) 1 space backward.
   * The opponent skips their next turn.
   * The player who made the Sumo push **moves again immediately**, using the tower matching the color of the empty square that was behind the pushed piece(s).
7. **Forced Push (Rule S11)**: A Sumo push is optional if diagonal forward moves exist. However, if a Sumo push is the *only* available move, the player is forced to execute it (cannot pass).

### 5.4 Regrouping Between Rounds (Rules F1–F4)
* The winner of the previous round (the Defender in the new round) chooses whether to **fill from the left** or **fill from the right**.
* The Challenger must fill in the same direction.
* Towers are returned to the home row in order based on the row and column they occupied at the end of the round.
