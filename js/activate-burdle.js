(function () {
  "use strict";

  const area = document.getElementById("game-area");
  const trigger = document.getElementById("burdle-trigger");
  const hintKey = "burdle.dup";
  const answerWords = [
    "apple", "beach", "brave", "bread", "brick", "brush", "chair", "chalk",
    "charm", "cheer", "chess", "chill", "cloud", "clown", "crane", "dance",
    "diary", "dream", "dress", "drink", "eagle", "earth", "field", "flame",
    "flash", "float", "flour", "fruit", "ghost", "giant", "glass", "globe",
    "grape", "grass", "green", "happy", "heart", "honey", "horse", "house",
    "juice", "knife", "koala", "lemon", "light", "lucky", "lunch", "magic",
    "mango", "maple", "medal", "money", "mouse", "movie", "music", "night",
    "noble", "ocean", "olive", "onion", "otter", "paint", "panda", "party",
    "peace", "peach", "pearl", "penny", "piano", "pilot", "pizza", "plant",
    "plaza", "pride", "prize", "queen", "quiet", "quilt", "radio", "river",
    "roast", "robot", "salad", "sandy", "scarf", "sheep", "shell", "shine",
    "shirt", "shore", "siren", "skate", "sleep", "slice", "smile", "snack",
    "snake", "snowy", "spark", "spice", "spoon", "sport", "stamp", "steam",
    "stone", "storm", "story", "sugar", "sunny", "sweet", "table", "teach",
    "tiger", "toast", "tooth", "torch", "tower", "train", "treat", "tulip",
    "uncle", "vivid", "water", "whale", "wheat", "wheel", "witch", "world",
    "zebra",
  ];
  const validWords = new Set((window.WORDY_DICT || "").split(/\s+/).filter(Boolean));
  let surface = null;
  let activeInput = null;
  let currentGuess = "";
  let guesses = [];
  let answer = "";
  let gameFinished = false;
  let doubleLetterDisplay = false;
  let hintButton = null;
  let letterKeyboard = null;
  let currentCells = [];
  let leftRows = null;
  let historyRows = null;
  let status = null;
  let savedCanvasVisibility = [];
  let priorDpadSetting;
  let hadPriorDpadSetting = false;

  if (!area || !trigger) return;

  function randomAnswer() {
    return answerWords[Math.floor(Math.random() * answerWords.length)];
  }

  function scoreGuess(guess, target) {
    const result = Array(5).fill("absent");
    const remaining = Object.create(null);
    for (const letter of target) remaining[letter] = (remaining[letter] || 0) + 1;

    for (let i = 0; i < 5; i++) {
      if (guess[i] === target[i]) {
        result[i] = "correct";
        remaining[guess[i]]--;
      }
    }
    for (let i = 0; i < 5; i++) {
      if (result[i] === "correct") continue;
      if (remaining[guess[i]] > 0) {
        result[i] = "present";
        remaining[guess[i]]--;
      }
    }
    return result;
  }

  function duplicateLetters(guess, scores) {
    const counts = Object.create(null);
    for (const letter of answer) counts[letter] = (counts[letter] || 0) + 1;
    return guess.split("").map((letter, index) =>
      scores[index] !== "absent" && counts[letter] >= 2
    );
  }

  function loadHintPreference() {
    try {
      return localStorage.getItem(hintKey) === "1";
    } catch (_error) {
      return false;
    }
  }

  function saveHintPreference() {
    try {
      localStorage.setItem(hintKey, doubleLetterDisplay ? "1" : "0");
    } catch (_error) {
      // The game remains playable when storage is unavailable.
    }
  }

  function makeRow() {
    const row = document.createElement("div");
    row.className = "burdle-row";
    const cells = [];
    for (let i = 0; i < 5; i++) {
      const cell = document.createElement("span");
      cell.className = "burdle-tile";
      row.appendChild(cell);
      cells.push(cell);
    }
    return { row, cells };
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function renderCurrentGuess() {
    currentCells.forEach((cell, index) => {
      const letter = currentGuess[index] || "";
      cell.textContent = letter;
      cell.classList.toggle("filled", Boolean(letter));
    });
  }

  function renderBoards() {
    leftRows.replaceChildren();
    historyRows.replaceChildren();
    currentCells = [];

    if (!gameFinished) {
      const entry = makeRow();
      entry.row.classList.add("burdle-active-row");
      entry.row.setAttribute("aria-label", "Current guess. Tap to type.");
      entry.row.addEventListener("click", () => activeInput.focus());
      entry.row.appendChild(activeInput);
      currentCells = entry.cells;
      leftRows.appendChild(entry.row);
    }

    const letterStatuses = Object.create(null);
    const statusRank = { absent: 1, present: 2, correct: 3 };
    for (const guess of guesses) {
      guess.word.split("").forEach((letter, index) => {
        const next = guess.score[index];
        if (!letterStatuses[letter] || statusRank[next] > statusRank[letterStatuses[letter]]) {
          letterStatuses[letter] = next;
        }
      });
    }
    letterKeyboard.querySelectorAll("[data-letter]").forEach((key) => {
      const letter = key.dataset.letter;
      const keyStatus = letterStatuses[letter];
      key.classList.remove("key-absent", "key-present", "key-correct");
      if (keyStatus) key.classList.add(`key-${keyStatus}`);
      key.setAttribute(
        "aria-label",
        keyStatus ? `${letter.toUpperCase()}, ${keyStatus}` : `${letter.toUpperCase()}, unused`
      );
    });

    for (const guess of guesses) {
      const entry = makeRow();
      const doubles = doubleLetterDisplay
        ? duplicateLetters(guess.word, guess.score)
        : Array(5).fill(false);
      entry.cells.forEach((cell, index) => {
        cell.textContent = guess.word[index];
        cell.classList.add(guess.score[index]);
        if (doubles[index]) cell.classList.add("duplicate-letter");
      });
      const feedback = guess.score.map((result, index) => {
        const labels = {
          correct: "correct position",
          present: "in the word, other position",
          absent: "no remaining match",
        };
        const duplicate = doubles[index] ? ", repeated letter" : "";
        return `${guess.word[index].toUpperCase()}: ${labels[result]}${duplicate}`;
      });
      entry.row.setAttribute(
        "aria-label",
        `${guess.word.toUpperCase()} guess. ${feedback.join("; ")}.`
      );
      entry.row.setAttribute("role", "img");
      historyRows.appendChild(entry.row);
    }

    while (historyRows.children.length < 6) {
      const blank = makeRow();
      blank.row.setAttribute("aria-hidden", "true");
      historyRows.appendChild(blank.row);
    }
    renderCurrentGuess();
  }

  function updateHintButton() {
    hintButton.setAttribute("aria-pressed", String(doubleLetterDisplay));
    hintButton.setAttribute(
      "aria-label",
      `Double-letter display ${doubleLetterDisplay ? "on" : "off"}`
    );
    hintButton.title = `Double-letter display: ${doubleLetterDisplay ? "on" : "off"}`;
    hintButton.classList.toggle("enabled", doubleLetterDisplay);
  }

  function startRound() {
    answer = randomAnswer();
    guesses = [];
    currentGuess = "";
    gameFinished = false;
    activeInput.value = "";
    setStatus("Tap the row to type.");
    renderBoards();
    surface.querySelector(".burdle-enter").hidden = false;
    surface.querySelector(".burdle-replay").hidden = true;
  }

  function finishRound(won) {
    gameFinished = true;
    activeInput.blur();
    setStatus(won ? `Got it: ${answer.toUpperCase()}!` : `The word was ${answer.toUpperCase()}.`);
    renderBoards();
    surface.querySelector(".burdle-enter").hidden = true;
    const replay = surface.querySelector(".burdle-replay");
    replay.hidden = false;
    replay.focus({ preventScroll: true });
  }

  function submitGuess() {
    if (gameFinished) return;
    const guess = currentGuess.toLowerCase();
    if (guess.length !== 5) {
      setStatus("Enter five letters first.");
      activeInput.focus({ preventScroll: true });
      return;
    }
    if (validWords.size && !validWords.has(guess)) {
      setStatus("That word is not in the word list.");
      activeInput.focus({ preventScroll: true });
      return;
    }

    const score = scoreGuess(guess, answer);
    guesses.push({ word: guess, score });
    currentGuess = "";
    activeInput.value = "";
    renderBoards();

    if (guess === answer) {
      finishRound(true);
    } else if (guesses.length === 6) {
      finishRound(false);
    } else {
      setStatus(`${6 - guesses.length} guesses left.`);
      activeInput.focus({ preventScroll: true });
    }
  }

  function onDocumentKeyDown(event) {
    if (!surface) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeGame();
    }
  }

  function closeGame() {
    if (!surface) return;
    document.removeEventListener("keydown", onDocumentKeyDown);
    surface.remove();
    surface = null;
    activeInput = null;
    if (savedCanvasVisibility.length) {
      savedCanvasVisibility.forEach(({ canvas, visibility }) => {
        canvas.style.visibility = visibility;
      });
    }
    savedCanvasVisibility = [];
    window.gameActive = false;
    window.stopCurrentGame = null;
    if (hadPriorDpadSetting) window.gameUsesDpad = priorDpadSetting;
    else delete window.gameUsesDpad;
    hadPriorDpadSetting = false;
    trigger.focus({ preventScroll: true });
  }

  function buildSurface() {
    surface = document.createElement("div");
    surface.className = "burdle-surface";
    surface.setAttribute("role", "group");
    surface.setAttribute("aria-label", "Burdle word game");
    surface.innerHTML = `
      <div class="burdle-tools">
        <button class="burdle-hint" type="button">2×</button>
      </div>
      <section class="burdle-column burdle-current-column" aria-label="Current guess and letter keyboard">
        <h2>GUESS</h2>
        <div class="burdle-rows burdle-left-rows"></div>
        <div class="burdle-keyboard" role="group" aria-label="Letter keyboard. Unmarked letters are unused; colored letters have been guessed.">
          <div class="burdle-key-row">${"qwertyuiop".split("").map((letter) => `<button type="button" data-letter="${letter}">${letter}</button>`).join("")}</div>
          <div class="burdle-key-row">${"asdfghjkl".split("").map((letter) => `<button type="button" data-letter="${letter}">${letter}</button>`).join("")}</div>
          <div class="burdle-key-row">
            <button type="button" data-action="backspace" aria-label="Backspace">⌫</button>
            ${"zxcvbnm".split("").map((letter) => `<button type="button" data-letter="${letter}">${letter}</button>`).join("")}
          </div>
        </div>
      </section>
      <section class="burdle-column burdle-history-column" aria-label="Previous guesses">
        <h2><span>PAST</span><button class="burdle-close" type="button" aria-label="Close Burdle">×</button></h2>
        <div class="burdle-rows burdle-history-rows"></div>
      </section>
      <div class="burdle-controls">
        <input class="burdle-input" type="text" maxlength="5" autocomplete="off"
          autocapitalize="characters" spellcheck="false" inputmode="text" enterkeyhint="done"
          aria-label="Type a five-letter guess" />
        <button class="burdle-enter" type="button">ENTER</button>
        <button class="burdle-replay" type="button" hidden>AGAIN</button>
        <span class="burdle-status" aria-live="polite"></span>
      </div>`;

    hintButton = surface.querySelector(".burdle-hint");
    leftRows = surface.querySelector(".burdle-left-rows");
    letterKeyboard = surface.querySelector(".burdle-keyboard");
    historyRows = surface.querySelector(".burdle-history-rows");
    status = surface.querySelector(".burdle-status");
    activeInput = surface.querySelector(".burdle-input");
    doubleLetterDisplay = loadHintPreference();
    updateHintButton();

    activeInput.addEventListener("input", () => {
      currentGuess = activeInput.value.toLowerCase().replace(/[^a-z]/g, "").slice(0, 5);
      activeInput.value = currentGuess;
      renderCurrentGuess();
    });
    activeInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submitGuess();
      }
    });
    letterKeyboard.addEventListener("mousedown", (event) => event.preventDefault());
    letterKeyboard.addEventListener("click", (event) => {
      const key = event.target.closest("button");
      if (!key || gameFinished) return;
      if (key.dataset.letter && currentGuess.length < 5) {
        currentGuess += key.dataset.letter;
        activeInput.value = currentGuess;
        renderCurrentGuess();
      } else if (key.dataset.action === "backspace") {
        currentGuess = currentGuess.slice(0, -1);
        activeInput.value = currentGuess;
        renderCurrentGuess();
      }
      activeInput.focus({ preventScroll: true });
    });
    hintButton.addEventListener("click", () => {
      doubleLetterDisplay = !doubleLetterDisplay;
      saveHintPreference();
      updateHintButton();
      renderBoards();
    });
    surface.querySelector(".burdle-enter").addEventListener("click", submitGuess);
    surface.querySelector(".burdle-replay").addEventListener("click", startRound);
    surface.querySelector(".burdle-close").addEventListener("click", closeGame);
    area.appendChild(surface);
  }

  function startGame() {
    if (window.gameActive || surface) return;
    hadPriorDpadSetting = Object.prototype.hasOwnProperty.call(window, "gameUsesDpad");
    priorDpadSetting = window.gameUsesDpad;
    window.gameActive = true;
    window.gameUsesDpad = false;
    window.stopCurrentGame = closeGame;

    savedCanvasVisibility = Array.from(area.children)
      .filter((child) => child.tagName === "CANVAS")
      .map((canvas) => ({ canvas, visibility: canvas.style.visibility }));
    savedCanvasVisibility.forEach(({ canvas }) => {
      canvas.style.visibility = "hidden";
    });

    buildSurface();
    document.addEventListener("keydown", onDocumentKeyDown);
    startRound();
  }

  trigger.addEventListener("click", startGame);
  trigger.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      startGame();
    }
  });
})();
