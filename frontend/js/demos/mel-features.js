// This script will be loaded by experiment-demo-loader.js
// It's responsible for injecting its HTML structure into #demo-area
// and running the interactive logic for the Pairwise Choice Task.

// Define the HTML structure for the Pairwise Choice demo
const demoHtml = `
    <style>
        /* General styles for the demo container */
        #mel-features-container {
            position: relative;
            width: 800px; /* Fixed width for the game area */
            height: 600px; /* Fixed height for the game area */
            background-color: #F0F8FF; /* AliceBlue - soft background */
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-family: 'Inter', sans-serif;
            color: #333;
        }

        /* User-provided CSS starts here */
        body {
            user-select: none;
        }
        /* Removed header and alert max-height as they conflict with site-wide styles */

        #container {
            display: grid;
            margin: auto;
            grid-gap: 50px;
            column-gap: 25px;
            text-align: center;
            align-items: center;
            justify-items: center;
            grid-template-columns: 1fr 1fr; /* Two columns for images */
            grid-template-rows: auto auto; /* For images and controls */
            width: 100%;
            height: 100%;
        }

        .display {
            width: 256px;
            height: 192px;
            grid-row: 1;
            border: 4px solid;
            border-color: black;
            display: none;
            cursor: pointer; /* Indicate clickable */
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
        }

        .display.shown {
            display: block;
        }
        .display.border {
            border-color:rgb(0, 184, 70); /* Red border for selection */
        }

        /* Footer styles for trial counter */
        .experiment-footer {
            grid-column: 1 / span 2; /* Span both columns */
            grid-row: 2; /* Below images */
            font-family: 'Press Start 2P', cursive;
            font-size: 0.9em;
            color: #6A5ACD;
            margin-top: 15px;
            text-align: center;
        }
        .experiment-footer span {
            color: #333;
            margin-left: 5px;
        }

        /* Overlay for dimension selection */
        .overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(255, 250, 205, 0.95); /* Semi-transparent Lemon Chiffon */
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            z-index: 100;
            padding: 20px;
            box-sizing: border-box;
        }

        .overlay-content {
            background-color: #fffacd;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
            max-width: 600px;
            width: 100%;
            text-align: center;
        }

        .overlay-content h2 {
            margin-bottom: 20px;
            color: #6A5ACD;
            font-size: 1.8em;
        }

        .dimension-buttons {
            display: flex;
            flex-wrap: wrap;
            justify-content: center;
            gap: 15px;
            margin-top: 20px;
        }

        .dimension-button {
            background-color: #ADD8E6; /* LightBlue */
            color: #4682B4; /* SteelBlue */
            font-family: 'Press Start 2P', cursive;
            padding: 15px 25px;
            font-size: 1em;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 3px 6px rgba(0,0,0,0.2);
        }

        .dimension-button:hover, .dimension-button.selected {
            background-color: #7B68EE; /* MediumSlateBlue */
            color: #E0FFFF;
            transform: translateY(-3px);
            box-shadow: 0 5px 10px rgba(0,0,0,0.3);
            text-shadow:
                -1px -1px 0 black,   /* Top-left shadow */
                1px -1px 0 black,    /* Top-right shadow */
                -1px 1px 0 black,    /* Bottom-left shadow */
                1px 1px 0 black;     /* Bottom-right shadow */
        }

        .start-experiment-button {
            margin-top: 30px;
            background-color: #98FB98; /* PaleGreen */
            color: #E0FFFF; /* Changed to LightCyan for contrast with black text-shadow */
            font-family: 'Press Start 2P', cursive;
            padding: 18px 35px;
            font-size: 1.3em;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 5px 10px rgba(0,0,0,0.2);
            text-shadow:
                -1px -1px 0 black,   /* Top-left shadow */
                1px -1px 0 black,    /* Top-right shadow */
                -1px 1px 0 black,    /* Bottom-left shadow */
                1px 1px 0 black;     /* Bottom-right shadow */
        }
        .start-experiment-button:hover {
            background-color: #3CB371; /* MediumSeaGreen */
            color: #FFF;
            transform: translateY(-3px);
            box-shadow: 0 8px 15px rgba(0,0,0,0.3);
        }
    </style>

    <div id="mel-features-container">
        <div id="dimension-selection-overlay" class="overlay">
            <div class="overlay-content">
                <h2>Select a Dimension to Judge</h2>
                <p>Please choose which visual feature you would like to judge in the upcoming trials. You will be asked to select the image that appears "greater" along your chosen dimension.</p>
                <div class="dimension-buttons">
                    <button class="dimension-button" data-dimension="asymmetry">Asymmetry</button>
                    <button class="dimension-button" data-dimension="border-irregularity">Border Irregularity</button>
                    <button class="dimension-button" data-dimension="color-variance">Color Variance</button>
                </div>
                <button id="start-experiment-button" class="start-experiment-button" disabled>Start Experiment</button>
            </div>
        </div>

        <div id="experiment-area" style="display:none;">
            <div id="container">
                <img id="display_left" class="display" src="" alt="Left Image">
                <img id="display_right" class="display" src="" alt="Right Image">
                <div class="experiment-footer">
                    <span id="foot_instruction">Select the image that is GREATER in <span id="current-dimension-text"></span></span>
                    <span id="trial_counter">Trial: 0/0</span>
                </div>
            </div>
        </div>

        <div id="experiment-complete-overlay" class="overlay" style="display:none;">
            <div class="overlay-content">
                <h2>Experiment Complete!</h2>
                <p>Thank you for participating.</p>
                <button id="restart-full-experiment-button" class="exit_button">Restart Experiment</button>
            </div>
        </div>
    </div>
`;

// Inject the HTML into the #demo-area of the viewer page
const demoArea = document.getElementById("demo-area");
if (demoArea) {
  demoArea.innerHTML = demoHtml; // HTML is injected here
} else {
  console.error("Could not find #demo-area to inject Mel Features demo.");
}

// --- Configuration ---
const conf = {
  imageRoot: "assets/images/melanoma/", // Base path for images
  dimensions: {
    asymmetry: "Asymmetry",
    "border-irregularity": "Border Irregularity",
    "color-variance": "Color Variance",
  },
  // Single set of 10 images for all conditions
  allImages: [
    "ISIC_0000000.JPG",
    "ISIC_0000001.JPG",
    "ISIC_0000002.JPG",
    "ISIC_0000003.JPG",
    "ISIC_0000008.JPG",
    "ISIC_0000013.JPG",
    "ISIC_0000017.JPG",
    "ISIC_0000018.JPG",
    "ISIC_0000026.JPG",
    "ISIC_0000029.JPG",
  ],
  totalTrialsPerDimension: 6,
  selectionDuration: 10000,
  fastResponseThreshold: 100,
  autoAdvanceDelay: 500,
};

// --- Game State ---
let state = {
  gamePhase: "DIMENSION_SELECTION", // 'DIMENSION_SELECTION', 'RUNNING', 'COMPLETE'
  currentDimension: null,
  blockNo: 0, // Represents the current dimension block (0 to 2)
  trialNo: 0, // Trial number within the current dimension block
  currentTrialStimuli: [], // [leftImgFilename, rightImgFilename]
  response_time: NaN,
  timed_out: false,
  n_fast_responses: 0,
  n_slow_responses: 0,
  n_left_responses: 0,
  n_right_responses: 0,
  one_response_per_trial: true, // Flag to ensure only one response per trial
  timeoutId: null, // Holds the setTimeout ID for trial duration
  autoAdvanceTimeoutId: null, // Holds the setTimeout ID for auto-advancing
  trialStartTime: null, // Timestamp when trial starts
  stimulusRevealTime: null, // Timestamp when images are revealed
};

// --- DOM Element References ---
let $dimensionSelectionOverlay, $dimensionButtons, $startExperimentButton;
let $experimentArea,
  $displayLeft,
  $displayRight,
  $footInstruction,
  $currentDimensionText,
  $trialCounter,
  $exitExperimentButton;
let $experimentCompleteOverlay, $restartFullExperimentButton;

// --- Helper Functions ---
function initializeDemoElements() {
  $dimensionSelectionOverlay = document.getElementById(
    "dimension-selection-overlay"
  );
  $dimensionButtons = document.querySelectorAll(".dimension-button");
  $startExperimentButton = document.getElementById("start-experiment-button");

  $experimentArea = document.getElementById("experiment-area");
  $displayLeft = document.getElementById("display_left");
  $displayRight = document.getElementById("display_right");
  $footInstruction = document.getElementById("foot_instruction");
  $currentDimensionText = document.getElementById("current-dimension-text");
  $trialCounter = document.getElementById("trial_counter");
  $exitExperimentButton = document.getElementById("exit-experiment-button");

  $experimentCompleteOverlay = document.getElementById(
    "experiment-complete-overlay"
  );
  $restartFullExperimentButton = document.getElementById(
    "restart-full-experiment-button"
  );

  // Log all elements for debugging
  console.log("Checking DOM elements after injection:");
  console.log("$dimensionSelectionOverlay:", $dimensionSelectionOverlay);
  console.log("$dimensionButtons (NodeList):", $dimensionButtons);
  console.log("$startExperimentButton:", $startExperimentButton);
  console.log("$displayLeft:", $displayLeft);
  console.log("$displayRight:", $displayRight);
  console.log("$restartFullExperimentButton:", $restartFullExperimentButton);
  console.log("$exitExperimentButton:", $exitExperimentButton);
}

/**
 * Returns a pair of unique random image filenames from the provided pool.
 * @param {Array<string>} imagePool - The array of available image filenames.
 * @returns {Array<string>} An array containing two unique image filenames.
 */
function getRandomUniqueImagePair(imagePool) {
  if (imagePool.length < 2) {
    console.error("Not enough images in the pool to create a unique pair.");
    return [null, null];
  }
  const shuffledPool = [...imagePool].sort(() => 0.5 - Math.random());
  return [shuffledPool[0], shuffledPool[1]];
}

function updateDisplay() {
  // Hide all main sections first
  $dimensionSelectionOverlay.style.display = "none";
  $experimentArea.style.display = "none";
  $experimentCompleteOverlay.style.display = "none";

  // Show relevant section based on gamePhase
  if (state.gamePhase === "DIMENSION_SELECTION") {
    $dimensionSelectionOverlay.style.display = "flex";
    $startExperimentButton.disabled = state.currentDimension === null;
  } else if (state.gamePhase === "RUNNING") {
    $experimentArea.style.display = "block"; // Use block for grid container
    $displayLeft.classList.remove("border"); // Remove feedback borders
    $displayRight.classList.remove("border");
    $footInstruction.textContent = `Select the image that has GREATER ${
      conf.dimensions[state.currentDimension]
    }`;
    $currentDimensionText.textContent = conf.dimensions[state.currentDimension];
    $trialCounter.textContent = `Trial: ${state.trialNo + 1}/${
      conf.totalTrialsPerDimension
    }`;
    // Ensure images are visible when running
    $displayLeft.style.display = "block";
    $displayRight.style.display = "block";
  } else if (state.gamePhase === "COMPLETE") {
    $experimentCompleteOverlay.style.display = "flex";
  }
}

function startTrial() {
  // Clear any previous auto-advance timeout
  clearTimeout(state.autoAdvanceTimeoutId);

  if (state.trialNo >= conf.totalTrialsPerDimension) {
    // All trials for this dimension are complete
    state.blockNo++; // Move to next dimension block
    if (state.blockNo < Object.keys(conf.dimensions).length) {
      // If there are more dimensions, reset for new dimension selection
      state.gamePhase = "DIMENSION_SELECTION";
      state.currentDimension = null; // Reset selection
      state.trialNo = 0; // Reset trial counter for new dimension
      $dimensionButtons.forEach((btn) => btn.classList.remove("selected")); // Deselect buttons
      updateDisplay();
    } else {
      // All dimensions/blocks complete
      state.gamePhase = "COMPLETE";
      updateDisplay();
    }
    return;
  }

  state.gamePhase = "RUNNING";
  state.one_response_per_trial = true;
  state.timed_out = false;
  state.response_time = NaN;

  // Get current trial stimuli by randomly selecting two unique images from the allImages pool
  state.currentTrialStimuli = getRandomUniqueImagePair(conf.allImages);

  state.trialStartTime = performance.now();
  updateDisplay();

  // Immediately reveal images
  $displayLeft.src = conf.imageRoot + state.currentTrialStimuli[0];
  $displayRight.src = conf.imageRoot + state.currentTrialStimuli[1];
  $displayLeft.classList.add("shown");
  $displayRight.classList.add("shown");
  state.stimulusRevealTime = state.trialStartTime;

  // Start the timeout timer for the trial duration
  state.timeoutId = setTimeout(() => {
    state.timed_out = true;
    state.n_slow_responses++;
    recordResponse(null); // No response made
  }, conf.selectionDuration);
}

function recordResponse(responseIndex) {
  if (!state.one_response_per_trial) return; // Already responded
  state.one_response_per_trial = false;

  // Clear the trial timeout so it doesn't fire after a response
  clearTimeout(state.timeoutId);

  if (responseIndex !== null) {
    const responseTime = performance.now() - state.stimulusRevealTime;
    state.response_time = responseTime;

    // Apply visual feedback
    if (responseIndex === 0) {
      $displayLeft.classList.add("border");
      state.n_left_responses++;
    } else if (responseIndex === 1) {
      $displayRight.classList.add("border");
      state.n_right_responses++;
    }
  } else {
    // Timeout - no visual feedback for timeout in this simplified version
  }

  // Increment trial counter for the next trial
  state.trialNo++;

  // Check if experiment is complete or if there are more trials in the current block
  if (
    state.trialNo >= conf.totalTrialsPerDimension &&
    state.blockNo + 1 >= Object.keys(conf.dimensions).length
  ) {
    // All trials and blocks complete
    state.gamePhase = "COMPLETE";
    updateDisplay();
  } else {
    // Auto-advance to the next trial/block after a short delay
    state.autoAdvanceTimeoutId = setTimeout(startTrial, conf.autoAdvanceDelay);
  }
}

// --- Event Listeners ---
function setupEventListeners() {
  // Dimension selection buttons
  $dimensionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      console.log(`Dimension button clicked: ${button.dataset.dimension}`); // Log click
      $dimensionButtons.forEach((btn) => btn.classList.remove("selected"));
      button.classList.add("selected");
      state.currentDimension = button.dataset.dimension;
      updateDisplay(); // Enable start button
    });
  });

  // Start Experiment button
  $startExperimentButton.addEventListener("click", () => {
    console.log("Start Experiment button clicked"); // Log click
    if (state.currentDimension) {
      startTrial();
    }
  });

  // Image click listeners
  $displayLeft.addEventListener("click", () => {
    console.log("Left image clicked"); // Log click
    recordResponse(0);
  });
  $displayRight.addEventListener("click", () => {
    console.log("Right image clicked"); // Log click
    recordResponse(1);
  });

  // Restart Full Experiment button
  $restartFullExperimentButton.addEventListener("click", () => {
    console.log("Restart Experiment button clicked"); // Log click
    resetExperiment();
  });

  // Exit Experiment button (during trials)
  $exitExperimentButton.addEventListener("click", () => {
    console.log("Exiting experiment."); // Log click
    // Clear any pending timeouts before redirecting
    clearTimeout(state.timeoutId);
    clearTimeout(state.autoAdvanceTimeoutId);
    window.location.href = "experiments.html"; // Example: Go back to demos page
  });
}

function resetExperiment() {
  // Clear any pending timeouts
  clearTimeout(state.timeoutId);
  clearTimeout(state.autoAdvanceTimeoutId);

  state = {
    gamePhase: "DIMENSION_SELECTION",
    currentDimension: null,
    blockNo: 0,
    trialNo: 0,
    currentTrialStimuli: [],
    response_time: NaN,
    timed_out: false,
    n_fast_responses: 0,
    n_slow_responses: 0,
    n_left_responses: 0,
    n_right_responses: 0,
    one_response_per_trial: true,
    timeoutId: null,
    autoAdvanceTimeoutId: null,
    trialStartTime: null,
    stimulusRevealTime: null,
  };
  $dimensionButtons.forEach((btn) => btn.classList.remove("selected"));
  updateDisplay();
}

initializeDemoElements();
setupEventListeners();
updateDisplay(); // Initial display setup (show dimension selection)
