// This script will be loaded by experiment-demo-loader.js
// It's responsible for injecting its HTML structure into #demo-area
// and running the interactive logic for the Discrete Choice Task.

// Define the HTML structure for the Discrete Choice demo, including embedded CSS.
const discreteChoiceHtml = `
    <style>
        #container {
            display: grid;
            grid-template-columns: repeat(3, 200px); /* Three columns for displays */
            grid-template-rows: auto 200px auto; /* Trial info, displays, feedback */
            gap: 20px 50px; /* Row gap, Column gap */
            margin: auto;
            text-align: center;
            align-items: center;
            justify-items: center;
            padding: 20px;
            background-color: #fffacd; /* Lemon Chiffon */
            border-radius: 15px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
            max-width: 800px; /* Limit max width of the main container */
            width: 100%; /* Responsive width */
            justify-content: center;
        }

        #trial-info {
            grid-column: 1 / span 3; /* Span across all three columns */
            grid-row: 1;
            font-family: 'Press Start 2P', cursive;
            color: #6a5acd;
            font-size: 1.2em;
            margin-bottom: 10px;
        }

        .display {
            image-rendering: pixelated;
            image-rendering: -moz-crisp-edges;
            width: 200px;
            height: 200px;
            grid-row: 2;
            border: 1px solid #4682B4; /* SteelBlue default border */
            /* Square edges - no border-radius */
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            cursor: pointer; /* Make displays clickable */
            /* Removed transition for immediate border change */
        }

        .display:hover {
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2); /* Slight lift on hover */
        }

        .display.correct-border {
            border: 8px solid #4CAF50; /* Solid 5px green border */
            box-shadow: none; /* No special effects */
        }
        .display.incorrect-border {
            border: 8px solid #E53935; /* Solid 5px red border */
            box-shadow: none; /* No special effects */
        }
        .display.indicated-display { /* Visual for rating scale indicated square */
            box-shadow: 0 5px 0 0px #7b68ee; /* offset-x offset-y blur-radius spread-radius color */
            border: none; /* 2px solidrgb(22, 23, 22); /* Keep default border to maintain initial size/position */
        }

        #instructions-overlay, #completion-overlay, #block-transition-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: transparent /* rgba(0, 0, 0, 0.7);  Dark semi-transparent background */
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000; /* Ensure it's on top */
        }

        .overlay-content {
            background-color: #fffacd; /* Light background from your theme */
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            max-width: 600px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        }

        .overlay-content h2 {
            font-family: 'Press Start 2P', cursive;
            color: #6a5acd;
            margin-top: 0;
            margin-bottom: 20px;
        }

        .overlay-content p {
            font-family: 'Inter', sans-serif;
            font-size: 1.1em;
            line-height: 1.6;
            margin-bottom: 25px;
        }

        .overlay-button {
            background-color: #98fb98; /* Button color from your theme */
            color: #fff; /* White text */
            font-family: 'Press Start 2P', cursive;
            padding: 12px 25px;
            border-radius: 8px;
            border: none; /* Removed 1px black border from button itself */
            text-shadow: 1px 1px 0px #000; /* Black outline for the text */
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .overlay-button:hover {
            background-color: #3cb371; /* Hover color */
            color: #fff;
            transform: translateY(-2px);
        }

        #rating-scale-container {
            grid-column: 1 / span 3;
            grid-row: 4; /* Place below feedback/markers */
            display: flex;
            justify-content: center;
            align-items: center; /* Align items vertically */
            gap: 10px;
            margin-top: 20px;
            visibility: hidden; /* Hidden by default */
            opacity: 0;
            transition: visibility 0s, opacity 0.3s ease;
        }

        #rating-scale-container.shown {
            visibility: visible;
            opacity: 1;
        }

        .rating-button {
            background-color: #e6e6fa; /* Lavender */
            color: #4682B4; /* SteelBlue */
            font-family: 'Press Start 2P', cursive;
            padding: 10px 15px;
            border-radius: 8px;
            border: 2px solid #4682B4;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            font-size: 0.9em;
        }

        .rating-button:hover {
            background-color: #d8bfd8; /* Thistle */
            transform: translateY(-2px);
        }

        .rating-button.selected {
            background-color: #7b68ee; /* MediumSlateBlue */
            color: #e0ffff;
            border-color: #6a5acd;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
        }

        .condition-prompt {
            grid-column: 1 / span 3;
            grid-row: 3;
            font-family: 'Inter', sans-serif;
            font-size: 1.1em;
            color: #333;
            margin-bottom: 10px;
            text-align: center;
            visibility: hidden;
            opacity: 0;
            transition: visibility 0s, opacity 0.3s ease;
        }
        .condition-prompt.shown {
            visibility: visible;
            opacity: 1;
        }

        .rating-label { /* Styles for the new rating scale labels */
            font-family: 'Inter', sans-serif;
            font-size: 0.9em;
            color: #555;
            white-space: nowrap; /* Prevent text from wrapping */
        }
        #rating-label-left {
            margin-right: 10px; /* Space between label and button 1 */
        }
        #rating-label-right {
            margin-left: 10px; /* Space between label and button 7 */
        }

    </style>

    <!-- NEW: Instructions Overlay -->
    <div id="instructions-overlay">
        <div class="overlay-content">
            <h2>Discrete Choice Task Demo</h2>
            <p>Your task is to identify the display with the <strong>most filled pixels</strong> out of the three options presented.</p>
            <p>Click on the display you believe has the most filled pixels. After your choice, feedback will be shown.</p>
            <p>This demo has a simplified number of trials for quick demonstration.</p>
            <button id="start-demo-button" class="overlay-button">Start Demo</button>
        </div>
    </div>

    <!-- NEW: Completion Overlay (hidden initially) -->
    <div id="completion-overlay" style="display:none;">
        <div class="overlay-content">
            <h2>Demo Complete!</h2>
            <p>You've completed all trials in this demonstration.</p>
            <p>Thanks for participating!</p>
            <button id="restart-demo-button" class="overlay-button">Restart Demo</button>
        </div>
    </div>

    <div id="block-transition-overlay" style="display:none;">
        <div class="overlay-content">
            <h2 id="block-transition-title">Block Complete!</h2>
            <p id="block-transition-message">Ready for the next block?</p>
            <button id="continue-block-button" class="overlay-button">Continue</button>
        </div>
    </div>

    <div id="container">
        <div id="trial-info">Trial 0 / 0</div>
        <!-- Displays for Discrete Choice and Rating Scale -->
        <canvas id="display0" class="display" data-display-index="0"></canvas>
        <canvas id="display1" class="display" data-display-index="1"></canvas>
        <canvas id="display2" class="display" data-display-index="2"></canvas>
        <div id="condition-prompt" class="condition-prompt"></div>

        <!-- Rating Scale Prompt and Buttons (initially hidden) -->
        <div id="rating-scale-container">
            <span class="rating-label" id="rating-label-left">Definitely NOT the darkest</span>
            <button class="rating-button" data-rating="1">1</button>
            <button class="rating-button" data-rating="2">2</button>
            <button class="rating-button" data-rating="3">3</button>
            <button class="rating-button" data-rating="4">4</button>
            <button class="rating-button" data-rating="5">5</button>
            <button class="rating-button" data-rating="6">6</button>
            <button class="rating-button" data-rating="7">7</button>
            <span class="rating-label" id="rating-label-right">Definitely the darkest</span>
        </div>
    </div>
`;

// Get the element where the demo HTML will be injected.
let demoArea = document.getElementById("demo-area");

// Inject the HTML into the demo area.
if (demoArea) {
  demoArea.innerHTML = discreteChoiceHtml;
} else {
  console.error("Could not find #demo-area to inject Discrete Choice demo.");
}

// --- Configuration ---
const conf = {
  canvasWidth: 200,
  canvasHeight: 200,
  nBlocks: 2,
  feedbackDuration: 1000,
  practiceFeedbackDuration: 1500,

  // Proportions for the filled pixels (0.0 to 1.0)
  proportions: [
    null, // Index 0 unused for 1-based indexing in original (keeping for consistency if needed elsewhere)
    0.45, // Proportion 1
    0.475, // Proportion 2
    0.5, // Proportion 3
    0.525, // Proportion 4
    0.55, // Proportion 5
  ],
  proportionSets: [
    [1, 2, 3],
    [4, 2, 1],
    [2, 5, 3],
    [3, 1, 4],
    [5, 4, 1],
    [1, 3, 5],
    [4, 5, 2],
    [3, 2, 4],
  ],
  trialConfigs: [
    { blockType: "discrete", proportionSetIndex: 0 },
    { blockType: "discrete", proportionSetIndex: 1 },
    { blockType: "discrete", proportionSetIndex: 2 },
    { blockType: "discrete", proportionSetIndex: 3 },
    // Add more trials for discrete block if desired, referencing different proportionSets
    { blockType: "discrete", proportionSetIndex: 4 },
    { blockType: "discrete", proportionSetIndex: 5 },
    // { blockType: "discrete", proportionSetIndex: 6 },
    // { blockType: "discrete", proportionSetIndex: 7 },

    // Block 2: Rating Scale Trials
    { blockType: "rating", proportionSetIndex: 0 },
    { blockType: "rating", proportionSetIndex: 1 },
    { blockType: "rating", proportionSetIndex: 2 },
    { blockType: "rating", proportionSetIndex: 3 },
    // Add more trials for rating block if desired, referencing different proportionSets
    { blockType: "rating", proportionSetIndex: 4 },
    { blockType: "rating", proportionSetIndex: 5 },
    // { blockType: "rating", proportionSetIndex: 6 },
    // { blockType: "rating", proportionSetIndex: 7 },
  ],
};
conf["nTrialsPerBlock"] = conf.trialConfigs.length / conf.nBlocks;

// --- Game State ---
let state = {
  currentTrialIndex: 0,
  currentBlock: 0,
  currentTrialInBlock: 0,
  responseMade: false,
  correctResponse: null,
  indicatedDisplayForRating: null,
  blockType: "discrete",
  currentDisplayProps: [], // NEW: Store the actual proportions drawn on the displays
};

// --- DOM Element References ---
let $display0, $display1, $display2;
// Removed feedback element references as they are now hidden
let $trialInfo;
let $instructionsOverlay, $completionOverlay, $blockTransitionOverlay;
let $startDemoButton, $restartDemoButton, $continueBlockButton;
let $conditionPrompt;
let $ratingScaleContainer;
let $ratingButtons; // NodeList of all rating buttons

// Map for easier access to display elements by index (0, 1, 2)
const displays = {};
// Removed feedbacks map

// Function to initialize DOM element references after HTML is injected
function initializeDemoElements() {
  $display0 = document.getElementById("display0");
  $display1 = document.getElementById("display1");
  $display2 = document.getElementById("display2");

  // Removed feedback element assignments

  $trialInfo = document.getElementById("trial-info");
  $instructionsOverlay = document.getElementById("instructions-overlay");
  $completionOverlay = document.getElementById("completion-overlay");
  $blockTransitionOverlay = document.getElementById("block-transition-overlay");
  $startDemoButton = document.getElementById("start-demo-button");
  $restartDemoButton = document.getElementById("restart-demo-button");
  $continueBlockButton = document.getElementById("continue-block-button");

  $conditionPrompt = document.getElementById("condition-prompt");
  $ratingScaleContainer = document.getElementById("rating-scale-container");
  $ratingButtons = document.querySelectorAll(
    "#rating-scale-container .rating-button"
  );

  displays[0] = $display0;
  displays[1] = $display1;
  displays[2] = $display2;
}

// --- Pixelated Drawing Function ---
function fill(canvas, prop) {
  let width = conf.canvasWidth;
  let height = conf.canvasHeight;

  let nPixels = width * height;
  let nFilled = parseInt(prop * nPixels);

  canvas.width = width;
  canvas.height = height;
  let ctx = canvas.getContext("2d");

  let pixels = Array.from({ length: nPixels }, (v, i) => false);

  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "black";

  for (let i = 0; i < nFilled; i++) {
    let index;
    do {
      index = parseInt(Math.random() * pixels.length);
    } while (pixels[index]);
    pixels[index] = true;
    let x = parseInt(index % width);
    let y = parseInt(index / width);
    ctx.fillRect(x, y, 1, 1);
  }
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// --- Game Logic ---

// Resets the visual state of the displays and feedback
function resetTrialDisplays() {
  [...document.querySelectorAll(".display")].forEach((d) => {
    let ctx = d.getContext("2d");
    ctx.clearRect(0, 0, d.width, d.height);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, d.width, d.height);
    d.classList.remove(
      "correct-border",
      "incorrect-border",
      "indicated-display"
    );
    d.style.pointerEvents = "auto";
  });
  [...$ratingButtons].forEach((btn) => {
    btn.classList.remove("selected");
    btn.style.pointerEvents = "auto";
  });
  $ratingScaleContainer.classList.remove("shown");
  $conditionPrompt.classList.remove("shown");
}

// Starts a new trial or ends the demo if all trials are complete
function startTrial() {
  // Check for block transition or completion
  if (state.currentTrialInBlock >= conf.nTrialsPerBlock) {
    state.currentBlock++;
    state.currentTrialInBlock = 0;
    if (state.currentBlock >= conf.nBlocks) {
      showCompletionOverlay(); // All blocks complete
      return;
    } else {
      // Transition to next block
      showBlockTransitionOverlay();
      return;
    }
  }

  resetTrialDisplays();
  state.responseMade = false;

  // Get the base proportion indices for the current trial from the configured set
  const currentTrialConfig = conf.trialConfigs[state.currentTrialIndex];
  state.blockType = currentTrialConfig.blockType;

  // NEW: Get the proportion indices for this trial and shuffle them
  const baseProportionsIndices = [
    ...conf.proportionSets[currentTrialConfig.proportionSetIndex],
  ]; // Copy to avoid modifying original
  shuffleArray(baseProportionsIndices); // Randomize the order of proportions

  // Assign the randomized proportions to displays
  const prop0 = conf.proportions[baseProportionsIndices[0]];
  const prop1 = conf.proportions[baseProportionsIndices[1]];
  const prop2 = conf.proportions[baseProportionsIndices[2]];

  fill(displays[0], prop0);
  fill(displays[1], prop1);
  fill(displays[2], prop2);

  // Store the actual proportions for this trial
  state.currentDisplayProps = [prop0, prop1, prop2]; // NEW

  // Determine the darkest square (correct response for discrete choice)
  const maxProp = Math.max(...state.currentDisplayProps); // Use the stored props
  state.correctResponse = state.currentDisplayProps.indexOf(maxProp); // Use the stored props

  // For Rating Scale block: indicate which display to rate
  if (state.blockType === "rating") {
    // NEW: Randomly select one of the three displays to be indicated for rating
    state.indicatedDisplayForRating = Math.floor(Math.random() * 3); // Randomly 0, 1, or 2
    if (displays[state.indicatedDisplayForRating]) {
      displays[state.indicatedDisplayForRating].classList.add(
        "indicated-display"
      );
    }
    $conditionPrompt.innerHTML = "Is the indicated square the darkest?";
    $conditionPrompt.classList.add("shown");
    $ratingScaleContainer.classList.add("shown");
    displays[0].style.pointerEvents = "none";
    displays[1].style.pointerEvents = "none";
    displays[2].style.pointerEvents = "none";
  } else {
    // Discrete Choice block
    $conditionPrompt.innerHTML = "Click the darkest square";
    $conditionPrompt.classList.add("shown");
    displays[0].style.pointerEvents = "auto";
    displays[1].style.pointerEvents = "auto";
    displays[2].style.pointerEvents = "auto";
  }

  // Update trial info display
  $trialInfo.textContent = `Trial ${state.currentTrialInBlock + 1} / ${
    conf.nTrialsPerBlock
  } (Block ${state.currentBlock + 1} / ${conf.nBlocks})`;
}

// Handles a user's choice (click on a display for discrete, or rating for rating scale)
function handleChoice(choiceMade) {
  if (state.responseMade) return; // Prevent multiple responses for the same trial
  state.responseMade = true;

  // Disable interaction after a response is made
  displays[0].style.pointerEvents = "none";
  displays[1].style.pointerEvents = "none";
  displays[2].style.pointerEvents = "none";
  [...$ratingButtons].forEach((btn) => (btn.style.pointerEvents = "none"));

  let waitDuration = conf.feedbackDuration;

  if (state.blockType === "discrete") {
    // Discrete Choice Logic
    const isCorrect = choiceMade === state.correctResponse;

    if (isCorrect) {
      displays[choiceMade].classList.add("correct-border");
    } else {
      // If incorrect, the chosen display gets red, the correct one gets green
      displays[choiceMade].classList.add("incorrect-border");
      displays[state.correctResponse].classList.add("correct-border"); // Highlight correct answer
    }
  } else if (state.blockType === "rating") {
    const currentTrialConfig = conf.trialConfigs[state.currentTrialIndex];
    const baseProportionsIndices = [
      ...conf.proportionSets[currentTrialConfig.proportionSetIndex],
    ];
    const indicatedProp =
      state.currentDisplayProps[state.indicatedDisplayForRating];
    const highestProp = Math.max(...state.currentDisplayProps);

    let isIndicatedDarkest = indicatedProp === highestProp;

    if (isIndicatedDarkest) {
      // If the indicated is the darkest, a high rating (e.g., >= 6) is "correct"
      if (choiceMade >= 6) {
        displays[state.indicatedDisplayForRating].classList.add(
          "correct-border"
        );
      } else {
        displays[state.indicatedDisplayForRating].classList.add(
          "incorrect-border"
        );
      }
    } else {
      // If the indicated is NOT the darkest, a low rating (e.g., <= 2) is "correct"
      if (choiceMade <= 2) {
        displays[state.indicatedDisplayForRating].classList.add(
          "correct-border"
        );
      } else {
        displays[state.indicatedDisplayForRating].classList.add(
          "incorrect-border"
        );
      }
    }
  }

  // After feedback, advance to the next trial
  setTimeout(() => {
    state.currentTrialIndex++; // Increment global trial index
    state.currentTrialInBlock++; // Increment trial within current block
    startTrial(); // Start the next trial or show completion screen
  }, waitDuration);
}

// --- Overlay Management Functions ---
function showInstructionsOverlay() {
  $instructionsOverlay.style.display = "flex";
  $completionOverlay.style.display = "none";
  $blockTransitionOverlay.style.display = "none";
  document.getElementById("container").style.display = "none"; // Hide main container
}

function hideInstructionsOverlay() {
  $instructionsOverlay.style.display = "none";
  document.getElementById("container").style.display = "grid"; // Show main container
}

function showCompletionOverlay() {
  $completionOverlay.style.display = "flex";
  $instructionsOverlay.style.display = "none";
  $blockTransitionOverlay.style.display = "none";
  document.getElementById("container").style.display = "none"; // Hide main container
}

function showBlockTransitionOverlay() {
  $blockTransitionOverlay.style.display = "flex";
  $instructionsOverlay.style.display = "none";
  $completionOverlay.style.display = "none";
  document.getElementById("container").style.display = "none"; // Hide main container

  // Update block transition message
  const nextBlockType =
    conf.trialConfigs[state.currentTrialIndex]?.blockType || "unknown";
  document.getElementById(
    "block-transition-title"
  ).textContent = `Block ${state.currentBlock} Complete!`;
  document.getElementById(
    "block-transition-message"
  ).innerHTML = `You've finished the ${
    state.blockType
  } trials. <br> Next up: <strong>${
    nextBlockType.charAt(0).toUpperCase() + nextBlockType.slice(1)
  }</strong> trials.`;
}

function hideBlockTransitionOverlay() {
  $blockTransitionOverlay.style.display = "none";
  document.getElementById("container").style.display = "grid"; // Show main container
}

// Resets the game to its initial state (before the first trial)
function resetGame() {
  state.currentTrialIndex = 0;
  state.currentBlock = 0;
  state.currentTrialInBlock = 0;
  state.responseMade = false;
  state.correctResponse = null;
  state.indicatedDisplayForRating = null;
  state.blockType = "discrete"; // Reset to default block type for instructions
  resetTrialDisplays(); // Clear any existing visuals
  showInstructionsOverlay(); // Go back to the instructions screen
}

// --- Event Listeners ---
function setupEventListeners() {
  // Listener for the "Start Demo" button on the instructions overlay
  $startDemoButton.addEventListener("click", () => {
    hideInstructionsOverlay(); // Hide instructions
    startTrial(); // Begin the first trial
  });

  // Listener for the "Restart Demo" button on the completion overlay
  $restartDemoButton.addEventListener("click", () => {
    resetGame(); // Reset game state and show instructions
  });

  // Listener for the "Continue" button on the block transition overlay
  $continueBlockButton.addEventListener("click", () => {
    hideBlockTransitionOverlay();
    startTrial(); // Start the first trial of the new block
  });

  // Attach event listeners to the displays themselves for Discrete Choice
  displays[0].addEventListener("click", () => {
    if (state.blockType === "discrete") handleChoice(0);
  });
  displays[1].addEventListener("click", () => {
    if (state.blockType === "discrete") handleChoice(1);
  });
  displays[2].addEventListener("click", () => {
    if (state.blockType === "discrete") handleChoice(2);
  });

  // Attach event listeners to the rating buttons for Rating Scale
  $ratingButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (state.blockType === "rating") {
        // Remove 'selected' from all rating buttons
        $ratingButtons.forEach((btn) => btn.classList.remove("selected"));
        // Add 'selected' to the clicked button
        button.classList.add("selected");
        handleChoice(parseInt(button.dataset.rating));
      }
    });
  });
}

initializeDemoElements();
showInstructionsOverlay();
setupEventListeners();
