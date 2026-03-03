const cursor = "c"
const blackStone = "b"
const whiteStone = "w"
const boardTile = "-"

setLegend(
  [cursor, bitmap`
2222........2222
2..............2
2..............2
2..............2
................
................
................
................
................
................
................
................
2..............2
2..............2
2..............2
2222........2222`],
  [blackStone, bitmap`
.......00.......
.....000000.....
....00000000....
...0001110000...
...0011111000...
..000111110000..
..000111110000..
.00000111000000.
.00000000000000.
..000000000000..
..000000000000..
...0000000000...
...0000000000...
....00000000....
.....000000.....
.......00.......`],
  [whiteStone, bitmap`
.......77.......
.....777777.....
....77777777....
...7772227777...
...7722222777...
..777222227777..
..777222227777..
.77777222777777.
.77777777777777.
..777777777777..
..777777777777..
...7777777777...
...7777777777...
....77777777....
.....777777.....
.......77.......`],
  [boardTile, bitmap`
4444444144444444
4444444144444444
4444444144444444
4444444144444444
4444444144444444
4444444144444444
4444444144444444
1111111111111111
4444444144444444
4444444144444444
4444444144444444
4444444144444444
4444444144444444
4444444144444444
4444444144444444
4444444144444444`]
)

const BOARD_SIZE = 9
let currentTurn = "black"
let consecutivePasses = 0
let curX = 4, curY = 4
let lastBoardState = ""
let blackCaptures = 0
let whiteCaptures = 0
let gameState = "START"

const DIRS = [[0,-1],[0,1],[-1,0],[1,0]]
const placeSound = tune`100: c4-150`
const captureSound = tune`100: g5-100, e5-100`
const errorSound = tune`100: c2-200`

function getStoneAt(x, y) {
  return getTile(x, y).find(s => s.type === blackStone || s.type === whiteStone)
}

function getBoardString() {
  let s = ""
  for(let y=0; y<BOARD_SIZE; y++) {
    for(let x=0; x<BOARD_SIZE; x++) {
      const stone = getStoneAt(x, y)
      s += stone ? (stone.type === blackStone ? "b" : "w") : "."
    }
  }
  return s
}

function showTitleScreen() {
  gameState = "START"
  clearText()
  const emptyRows = Array(BOARD_SIZE).fill(boardTile.repeat(BOARD_SIZE)).join("\n")
  setMap(map`${emptyRows}`) 
  addText("GO: SPRIG", { x: 2, y: 2, color: color`2` })
  addText("WASD - MOVE", { x: 2, y: 5, color: color`2` })
  addText("I - PLACE STONE", { x: 2, y: 7, color: color`2` })
  addText("K - PASS TURN", { x: 2, y: 9, color: color`2` })
  addText("L - START GAME", { x: 2, y: 11, color: color`2` })
}

function initGame() {
  playTune(placeSound, 0) 
  gameState = "PLAY"
  const emptyMap = Array(BOARD_SIZE).fill(boardTile.repeat(BOARD_SIZE)).join("\n")
  setMap(map`${emptyMap}`)
  curX = 4; curY = 4
  currentTurn = "black"
  consecutivePasses = 0
  blackCaptures = 0
  whiteCaptures = 0
  lastBoardState = ""
  updateCursorDisplay()
  showStatus()
}

function updateCursorDisplay() {
  getAll(cursor).forEach(s => s.remove())
  if (gameState === "PLAY") {
    addSprite(curX, curY, cursor)
  }
}

function moveCursor(dx, dy) {
  if (gameState !== "PLAY") return
  curX = Math.max(0, Math.min(BOARD_SIZE - 1, curX + dx))
  curY = Math.max(0, Math.min(BOARD_SIZE - 1, curY + dy))
  updateCursorDisplay()
}

onInput("w", () => moveCursor(0, -1))
onInput("s", () => moveCursor(0, 1))
onInput("a", () => moveCursor(-1, 0))
onInput("d", () => moveCursor(1, 0))
onInput("l", () => initGame())

function getGroupAndLiberties(startX, startY, type) {
  const visited = new Set(), liberties = new Set(), stones = []
  const stack = [[startX, startY]]
  while(stack.length > 0) {
    const [x, y] = stack.pop()
    const key = x + "," + y
    if (visited.has(key)) continue
    visited.add(key)
    const found = getTile(x, y).find(s => s.type === type)
    if (found) {
      stones.push(found)
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy
        if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
          const neighborStone = getStoneAt(nx, ny)
          if (!neighborStone) liberties.add(nx + "," + ny)
          else if (neighborStone.type === type) stack.push([nx, ny])
        }
      }
    }
  }
  return { stones, liberties: liberties.size }
}

onInput("i", () => {
  if (gameState !== "PLAY") return
  if (getStoneAt(curX, curY)) return 

  const pieceType = (currentTurn === "black") ? blackStone : whiteStone
  const enemyType = (currentTurn === "black") ? whiteStone : blackStone
  const boardBeforeMove = getBoardString()
  
  const placed = addSprite(curX, curY, pieceType)
  let capturedAny = false

  for (const [dx, dy] of DIRS) {
    const nx = curX + dx, ny = curY + dy
    if (nx >= 0 && nx < BOARD_SIZE && ny >= 0 && ny < BOARD_SIZE) {
      const neighbor = getStoneAt(nx, ny)
      if (neighbor && neighbor.type === enemyType) {
        const group = getGroupAndLiberties(nx, ny, enemyType)
        if (group.liberties === 0) {
          if (currentTurn === "black") blackCaptures += group.stones.length
          else whiteCaptures += group.stones.length
          group.stones.forEach(s => s.remove())
          capturedAny = true
        }
      }
    }
  }

  const myGroup = getGroupAndLiberties(curX, curY, pieceType)
  if (!capturedAny && myGroup.liberties === 0) {
    const illegalStone = getStoneAt(curX, curY)
    if (illegalStone) illegalStone.remove()
    playTune(errorSound)
    return
  }

  const boardAfterMove = getBoardString()
  if (boardAfterMove === lastBoardState) {
    const illegalStone = getStoneAt(curX, curY)
    if (illegalStone) illegalStone.remove()
    playTune(errorSound)
    return
  }

  if (capturedAny) playTune(captureSound)
  else playTune(placeSound)

  lastBoardState = boardBeforeMove
  consecutivePasses = 0
  
  if (currentTurn === "black") {
    currentTurn = "white"
  } else {
    currentTurn = "black"
  }

  showStatus()
  updateCursorDisplay()
})

onInput("k", () => {
  if (gameState !== "PLAY") return
  consecutivePasses++
  if (consecutivePasses >= 2) calculateWinner()
  else {
    currentTurn = (currentTurn === "black") ? "white" : "black"
    showStatus()
  }
})

function showStatus() {
  clearText()
  const text = currentTurn.toUpperCase()
  addText(text + " TURN", { x: 0, y: 0, color: color`2` })
  addText("B:" + blackCaptures + " W:" + whiteCaptures, { x: 0, y: 15, color: color`2` })
}

function calculateWinner() {
  gameState = "OVER"
  clearText()
  const bCount = getAll(blackStone).length + blackCaptures
  const wCount = getAll(whiteStone).length + whiteCaptures
  let msg = (bCount > wCount) ? "BLACK WINS!" : (wCount > bCount) ? "WHITE WINS!" : "DRAW"
  addText(msg, { x: 1, y: 3, color: color`2` })
  addText("TOTAL B:" + bCount + " W:" + wCount, { x: 1, y: 4, color: color`2` })
  addText("L TO RESTART", { x: 1, y: 5, color: color`2` })
}

showTitleScreen()