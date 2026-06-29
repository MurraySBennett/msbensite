/// --- Configuration ---
const conf = {
  stimulusCanvasWidth: 200, // pixels
  stimulusCanvasHeight: 200, // pixels
  nTrialsPerBlock: 6, // Simplified: Fewer trials per block for the demo
  nBlocks: 1, // Number of blocks
  stimulusDisplayTime: 1000, // Duration stimulus is shown (ms)
  maskTime: 50, // Duration mask is shown (ms)
  maxResponseTime: 6000, // Max time to respond (ms)

  // Values for the central stimulus (numbers 1-9)
  stimulusValues: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  // Noise levels (0.0 to 1.0, higher = more noise)
  noiseLevels: [2.2], //[0.02, 0.04, 0.06, 0.08, 0.1], // Much smaller noise levels for a subtle effect

  // Mask parameters
  maskPixelSize: 10, // Size of each pixel in the mask grid
  // Stimulus pixelation size
  stimulusPixelSize: 3, // Size of each "pixel" in the noisy stimulus grid
};

const wheelOfFortuneHtml = `
    <style>
        /* New container to center the entire application */
        #main-app-container {
            display: flex;
            flex-direction: column;
            align-items: center; /* Center children horizontally */
            width: 100%; /* Take full width */
            max-width: 900px; /* Match wheel-container's max-width for consistency */
            margin: 20px auto; /* Center the entire app horizontally with some top/bottom margin */
            padding: 10px; /* Add some padding around the whole app */
            box-sizing: border-box; /* Include padding in width calculation */
        }

        #wheel-container {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            background-color: #fffacd; /* Lemon Chiffon */
            border-radius: 15px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
            width: 100%; /* Take full width of its parent (#main-app-container) */
            margin: 0; /* Remove auto margin here, parent handles centering */
            position: relative; /* For absolute positioning of overlays and buttons */
            min-height: 600px; /* Ensure enough space for the canvases */
            border-radius: 0; /* Make edges square */
            border: 4px solid #FFD700; /* Outer orange border */
            box-shadow: 0 0 0 4px #FFA500, /* Inner yellow panel */
                        0 0 0 8px rgb(255, 77, 0); /* Outer red panel (extends beyond the yellow) */
        }

        #trial-info {
            font-family: 'Press Start 2P', cursive;
            color: #6a5acd;
            font-size: 1.2em;
            margin-bottom: 20px; /* Space below trial info */
            text-align: center;
            width: 100%; /* Occupy full width within its parent */
            padding: 10px 0; /* Add some padding for visual separation */
        }

        #stimulus-canvas {
            border: 2px solid #4682B4; /* SteelBlue border */
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            background-color: white; /* Ensure a white background for drawing */
            /* Added fluid sizing for responsiveness */
            max-width: 90%;
            height: auto;
        }

        #stimulus-canvas {
            display: block; /* Initially visible */
        }

        /* Overlays */
        #instructions-overlay, #completion-overlay {
            position: absolute; /* Position relative to #wheel-container */
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(255, 250, 205, 0.95); /* Semi-transparent Lemon Chiffon */
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            border-radius: 15px; /* Match container border-radius */
        }

        .overlay-content {
            background-color: #fffacd; /* Light background from your theme */
            padding: 30px;
            border-radius: 15px;
            text-align: center;
            max-width: 600px;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
            /* Added fluid padding for smaller screens */
            padding: 20px;
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
            border: none;
            text-shadow: 1px 1px 0px #000;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
        }

        .overlay-button:hover {
            background-color: #3cb371; /* Hover color */
            color: #fff;
            transform: translateY(-2px);
        }

        /* Styles for response buttons */
        #response-buttons {
            position: absolute; /* Change to absolute positioning */
            top: 50%; /* Center vertically relative to #wheel-container */
            left: 50%; /* Center horizontally relative to #wheel-container */
            transform: translate(-50%, -50%); /* Adjust to truly center the container */
            width: auto; /* Let content define width */
            height: auto; /* Let content define height */
            display: none; /* Still hidden until response phase */
            z-index: 50; /* Ensure buttons are above the canvas if needed */
        }

        .response-button {
            position: absolute; /* Each button is absolutely positioned */
            background-color: #ADD8E6; /* LightBlue */
            color: #4682B4; /* SteelBlue */
            font-family: 'Inter', cursive;
            padding: 10px 15px;
            border-radius: 8px;
            border: 2px solid #4682B4;
            font-size: 1.2em;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 3px 6px rgba(0,0,0,0.1);
            min-width: 45px;
            text-align: center;
            transform: translate(-50%, -50%); /* Add transform to center the button on its calculated point */
        }

        .response-button:hover:not(.correct-feedback-border):not(.incorrect-feedback-border):not(.correct-answer-outline) {
            background-color: #7B68EE; /* MediumSlateBlue */
            color: #E0FFFF; /* LightCyan */
            border-color: #7B68EE;
            box-shadow: 0 5px 10px rgba(0,0,0,0.2);
        }

        /* Feedback border styles */
        .correct-feedback-border {
            border: 4px solid #4CAF50 !important; /* Green */
            padding: 8px 13px !important; /* Reduce padding by 2px on each side (top/bottom, left/right) */
            box-shadow: 0 0 15px #4CAF50;
        }

        .incorrect-feedback-border {
            border: 4px solid #E53935 !important; /* Red */
            padding: 8px 13px !important; /* Reduce padding by 2px on each side (top/bottom, left/right) */
            box-shadow: 0 0 15px #E53935;
        }

        /* Style for outlining the correct answer when an incorrect response is made */
        .correct-answer-outline {
            border: 4px dashed #4CAF50 !important; /* Green dashed border */
            padding: 8px 13px !important; /* Reduce padding by 2px on each side (top/bottom, left/right) */
            box-shadow: 0 0 15px rgba(76, 175, 80, 0.5); /* Subtle green glow */
        }

        /* --- New Media Query for Mobile Responsiveness --- */
        @media (max-width: 600px) {
            #wheel-container {
                /* Reduce the overall border thickness to save space */
                border: 2px solid #FFD700;
                box-shadow: 0 0 0 2px #FFA500,
                            0 0 0 4px rgb(255, 77, 0);
            }
            .overlay-content {
                padding: 15px;
            }
            .overlay-content h2 {
                font-size: 1.5em; /* Scale down headings */
            }
            .overlay-content p {
                font-size: 1em; /* Scale down paragraph text */
            }
            .response-button {
                min-width: 30px; /* Make buttons smaller */
                padding: 8px 10px; /* Reduce button padding */
                font-size: 1em; /* Reduce font size in buttons */
            }
        }
    </style>

    <div id="main-app-container">
        <div id="trial-info">Trial 0 / ${conf.nTrialsPerBlock}</div> <div id="wheel-container">
            <canvas id="stimulus-canvas" width="200" height="200"></canvas>

            <div id="response-buttons">
                </div>

            <div id="instructions-overlay">
                <div class="overlay-content">
                    <h2>Wheel of Fortune Task Demo</h2>
                    <p>Your task is to identify the number displayed in the center, which will be briefly shown and then masked.</p>
                    <p>After the mask, select the number you saw by clicking the corresponding button from the wheel of buttons surrounding the display.</p>
                    <button id="start-demo-button" class="overlay-button">Start Demo</button>
                </div>
            </div>

            <div id="completion-overlay" style="display:none;">
                <div class="overlay-content">
                    <h2>Demo Complete!</h2>
                    <p>You've completed all trials in this demonstration.</p>
                    <p>Thanks for participating!</p>
                    <button id="restart-demo-button" class="overlay-button">Restart Demo</button>
                </div>
            </div>
        </div>
    </div>
`;

// Get the element where the demo HTML will be injected.
let demoArea = document.getElementById("demo-area");

// Inject the HTML into the demo area.
if (demoArea) {
  demoArea.innerHTML = wheelOfFortuneHtml;
} else {
  console.error("Could not find #demo-area to inject Wheel of Fortune demo.");
}
// --- Game State ---
let state = {
  currentTrialIndex: 0, // 0-indexed global trial index
  currentBlock: 0, // 0-indexed current block
  currentTrialInBlock: 0, // 0-indexed trial within the current block
  responseMade: false, // Flag to prevent multiple responses per trial
  correctStimulus: null, // The actual number displayed
  currentNoiseLevel: null, // Noise level for the current stimulus
  responseNumber: null, // Number selected by button
  responseTime: null, // Time taken to respond
  isResponding: false, // Flag to indicate if response phase is active
  responseTimeoutId: null, // To clear the response timeout
  mousePath: [], // For tracking mouse movement (optional, but good for analysis)
};

// --- DOM Element References ---
let $stimulusCanvas, $stimulusCtx;
let $trialInfo;
let $instructionsOverlay, $completionOverlay;
let $startDemoButton, $restartDemoButton;
let $responseButtonsContainer; // Reference to the buttons container
let $responseButtons = []; // Array to hold references to individual buttons

// Function to initialize DOM element references and contexts after HTML is injected
function initializeDemoElements() {
  $stimulusCanvas = document.getElementById("stimulus-canvas");
  $stimulusCtx = $stimulusCanvas.getContext("2d");
  $trialInfo = document.getElementById("trial-info");
  $instructionsOverlay = document.getElementById("instructions-overlay");
  $completionOverlay = document.getElementById("completion-overlay");
  $startDemoButton = document.getElementById("start-demo-button");
  $restartDemoButton = document.getElementById("restart-demo-button");
  $responseButtonsContainer = document.getElementById("response-buttons");

  $responseButtonsContainer.innerHTML = "";
  $responseButtons = [];

  const containerRect =
    $responseButtonsContainer.parentElement.getBoundingClientRect();
  const containerCenterX = containerRect.width / 2;
  const containerCenterY = containerRect.height / 2;
  const canvasRect = $stimulusCanvas.getBoundingClientRect();
  const buttonCircleRadius =
    Math.max(canvasRect.width, canvasRect.height) / 2 + 80;
  const numButtons = 9;
  const angleIncrement = (2 * Math.PI) / numButtons;

  for (let i = 0; i < numButtons; i++) {
    const button = document.createElement("button");
    button.classList.add("response-button");
    button.textContent = i + 1;
    button.dataset.value = i + 1;
    const angle = i * angleIncrement - Math.PI / 2;
    const buttonX =
      containerCenterX + buttonCircleRadius * Math.cos(angle) - 240;
    const buttonY =
      containerCenterY + buttonCircleRadius * Math.sin(angle) - 320;
    button.style.position = "absolute";
    button.style.left = `${buttonX}px`;
    button.style.top = `${buttonY}px`;
    $responseButtonsContainer.appendChild(button);
    $responseButtons.push(button);
  }
}

// --- Helper Functions ---

// Helper to shuffle an array (Fisher-Yates algorithm)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Draws a fixation cross on the canvas.
 * @param {CanvasRenderingContext2D} ctx The 2D rendering context.
 */
function drawFixationCross(ctx) {
  const canvas = ctx.canvas;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const crossSize = 10;
  ctx.fillStyle = "black";
  ctx.fillRect(centerX - crossSize, centerY - 2, crossSize * 2, 4); // Horizontal line
  ctx.fillRect(centerX - 2, centerY - crossSize, 4, crossSize * 2); // Vertical line
}

/**
 * Draws a noisy numerical stimulus on the given canvas with subtle grayscale noise.
 * The noise affects the entire canvas, making it appear grainy, but the number remains visible.
 * @param {HTMLCanvasElement} canvas The canvas to draw on.
 * @param {CanvasRenderingContext2D} ctx The 2D rendering context.
 * @param {number} number The number to display.
 * @param {number} noiseLevel A value from 0 to 1, indicating noise intensity.
 * @param {number} pixelSize The size of each "pixel" in the final display.
 */
function drawNoisyStimulus(canvas, ctx, number, noiseLevel, pixelSize) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 1. Draw the number directly onto the main canvas in pure black
  ctx.font = `${canvas.width * 0.8}px 'Inter', cursive`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "black";
  ctx.fillText(number.toString(), canvas.width / 2, canvas.height / 2);

  // 2. Get the image data of the canvas *after* the number is drawn
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;

  // 3. Apply random grayscale noise to ALL pixels (or pixel blocks)
  for (let y = 0; y < canvas.height; y += pixelSize) {
    for (let x = 0; x < canvas.width; x += pixelSize) {
      // Calculate the average color of the current pixel block
      let sumGray = 0;
      let count = 0;
      for (let dy = 0; dy < pixelSize; dy++) {
        for (let dx = 0; dx < pixelSize; dx++) {
          const currentX = x + dx;
          const currentY = y + dy;
          if (currentX < canvas.width && currentY < canvas.height) {
            const pixelIndex = (currentY * canvas.width + currentX) * 4;
            // Sum the grayscale value (average of R, G, B)
            sumGray +=
              (pixels[pixelIndex] +
                pixels[pixelIndex + 1] +
                pixels[pixelIndex + 2]) /
              3;
            count++;
          }
        }
      }
      const originalGrayOfBlock = sumGray / count;

      // Apply a small random grayscale noise
      // noiseLevel (0-1) controls the *proportion* of the full grayscale range (0-255) that noise can span.
      const noiseRange = noiseLevel * 255; // Max deviation from original color
      const randomNoise = (Math.random() * 2 - 1) * noiseRange; // Noise from -noiseRange to +noiseRange

      let finalColorValue = originalGrayOfBlock + randomNoise;

      // Clamp the value to ensure it stays within 0-255
      finalColorValue = Math.max(0, Math.min(255, finalColorValue));

      // Fill the entire pixel block with the calculated final color
      ctx.fillStyle = `rgb(${finalColorValue}, ${finalColorValue}, ${finalColorValue})`;
      ctx.fillRect(x, y, pixelSize, pixelSize);
    }
  }
}

/**
 * Draws a pixelated mask on the given canvas.
 * @param {HTMLCanvasElement} canvas The canvas to draw on.
 * @param {CanvasRenderingContext2D} ctx The 2D rendering context.
 * @param {number} pixelSize The size of each square pixel in the mask grid.
 */
function drawPixelatedMask(canvas, ctx, pixelSize) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "white"; // Background for the mask
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let x = 0; x < canvas.width; x += pixelSize) {
    for (let y = 0; y < canvas.height; y += pixelSize) {
      // Randomly choose black or white for each pixel block
      ctx.fillStyle = Math.random() > 0.5 ? "black" : "white";
      ctx.fillRect(x, y, pixelSize, pixelSize);
    }
  }
}

// Updates the trial information display
function updateTrialInfo() {
  $trialInfo.textContent = `Trial ${state.currentTrialInBlock + 1} / ${
    conf.nTrialsPerBlock
  }`; // (Block ${state.currentBlock + 1} / ${conf.nBlocks})`;
}

// --- Game Logic ---

// Resets the game to its initial state
function resetGame() {
  state.currentTrialIndex = 0;
  state.currentBlock = 0;
  state.currentTrialInBlock = 0;
  state.responseMade = false;
  state.correctStimulus = null;
  state.currentNoiseLevel = null;
  state.responseNumber = null;
  state.responseTime = null;
  state.isResponding = false;
  state.mousePath = [];

  clearTimeout(state.responseTimeoutId); // Clear any pending timeouts
  $stimulusCanvas.style.display = "none";
  $responseButtonsContainer.style.display = "none"; // Hide buttons
  $completionOverlay.style.display = "none";
  showInstructionsOverlay();
  updateTrialInfo(); // Reset trial info display
}

// Shows a specific overlay
function showOverlay(overlayElem) {
  overlayElem.style.display = "flex";
}

// Hides a specific overlay
function hideOverlay(overlayElem) {
  overlayElem.style.display = "none";
}

function showInstructionsOverlay() {
  showOverlay($instructionsOverlay);
  hideOverlay($completionOverlay);
  $stimulusCanvas.style.display = "none";
  $responseButtonsContainer.style.display = "none"; // Hide buttons
}

function showCompletionOverlay() {
  showOverlay($completionOverlay);
  hideOverlay($instructionsOverlay);
  $stimulusCanvas.style.display = "none";
  //   $responseButtonsContainer.style.display = "none"; // Hide buttons
}

// Starts a new trial with pre-trial sequence (blank, fixation, blank)
async function startTrial() {
  console.log(
    "startTrial() called. Current trial index:",
    state.currentTrialIndex
  );
  console.log(
    `Trial ${state.currentTrialIndex + 1}: Stimulus = ${
      state.correctStimulus
    }, Noise Level = ${state.currentNoiseLevel}`
  );

  if (state.currentTrialInBlock >= conf.nTrialsPerBlock) {
    state.currentBlock++;
    state.currentTrialInBlock = 0;
    if (state.currentBlock >= conf.nBlocks) {
      showCompletionOverlay();
      return;
    }
  }

  state.responseMade = false;
  state.responseNumber = null;
  state.responseTime = null;
  state.isResponding = false;
  state.mousePath = [];
  clearTimeout(state.responseTimeoutId);

  $responseButtons.forEach((button) => {
    button.classList.remove(
      "correct-feedback-border",
      "incorrect-feedback-border",
      "correct-answer-outline"
    );
  });

  updateTrialInfo();

  $stimulusCanvas.style.display = "block";
  $responseButtonsContainer.style.display = "block";
  let ctx = $stimulusCtx;

  // Blank screen
  ctx.clearRect(0, 0, $stimulusCanvas.width, $stimulusCanvas.height);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, $stimulusCanvas.width, $stimulusCanvas.height);
  await new Promise((resolve) => setTimeout(resolve, 250));

  // Fixation cross
  ctx.clearRect(0, 0, $stimulusCanvas.width, $stimulusCanvas.height);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, $stimulusCanvas.width, $stimulusCanvas.height);
  drawFixationCross(ctx);
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Blank screen
  ctx.clearRect(0, 0, $stimulusCanvas.width, $stimulusCanvas.height);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, $stimulusCanvas.width, $stimulusCanvas.height);
  await new Promise((resolve) => setTimeout(resolve, 250));

  state.correctStimulus = shuffleArray([...conf.stimulusValues])[0];
  state.currentNoiseLevel = shuffleArray([...conf.noiseLevels])[0];

  // Phase 1: Display Noisy Stimulus
  drawNoisyStimulus(
    $stimulusCanvas,
    $stimulusCtx,
    state.correctStimulus,
    state.currentNoiseLevel,
    conf.stimulusPixelSize
  );
  console.log(
    "Stimulus canvas displayed with number:",
    state.correctStimulus,
    "Noise level:",
    state.currentNoiseLevel
  );

  await new Promise((resolve) => setTimeout(resolve, conf.stimulusDisplayTime));

  // Phase 2: Display Mask
  drawPixelatedMask($stimulusCanvas, $stimulusCtx, conf.maskPixelSize);
  console.log("Mask displayed.");

  await new Promise((resolve) => setTimeout(resolve, conf.maskTime));

  // Phase 3: Response Phase
  $responseButtonsContainer.style.display = "flex"; // Show buttons
  console.log("Response buttons displayed.");

  state.isResponding = true;
  state.responseStartTime = performance.now();

  state.responseTimeoutId = setTimeout(() => {
    if (!state.responseMade) {
      console.log("Trial timed out. No response.");
      logTrialData({
        stimulus: state.correctStimulus,
        noise: state.currentNoiseLevel,
        response: "timeout",
        accuracy: "N/A",
        rt: conf.maxResponseTime,
        mousePath: state.mousePath,
      });
      endTrial();
    }
  }, conf.maxResponseTime);
}

// Function to handle response triggered by button click
function handleButtonClick(event) {
  if (!state.isResponding || state.responseMade) return; // Only process if responding and no response yet

  const clickedButton = event.target;
  const responseValue = parseInt(clickedButton.dataset.value); // Get the number from data-value

  processResponse(responseValue, clickedButton);
}

// Refactored function to process the response, now called by button click
function processResponse(responseValue, clickedButton) {
  state.responseMade = true;
  state.isResponding = false;
  clearTimeout(state.responseTimeoutId); // Clear timeout as response is made

  state.responseTime = performance.now() - state.responseStartTime;
  state.responseNumber = responseValue;

  const isCorrect = state.responseNumber === state.correctStimulus;
  const accuracy = isCorrect ? 1 : 0;

  // Log trial data (for demonstration purposes, output to console)
  logTrialData({
    stimulus: state.correctStimulus,
    noise: state.currentNoiseLevel,
    response: state.responseNumber,
    accuracy: accuracy,
    rt: state.responseTime,
    mousePath: state.mousePath,
  });

  // Apply feedback border to the clicked button
  if (clickedButton) {
    if (isCorrect) {
      clickedButton.classList.add("correct-feedback-border");
    } else {
      // If incorrect, apply red border to selected button
      clickedButton.classList.add("incorrect-feedback-border");
      // Also, apply green outline to the correct answer
      $responseButtons.forEach((button) => {
        if (parseInt(button.dataset.value) === state.correctStimulus) {
          button.classList.add("correct-answer-outline"); // Changed to correct-answer-outline
        }
      });
    }
  }

  // Show the mask immediately after the response
  drawPixelatedMask($stimulusCanvas, $stimulusCtx, conf.maskPixelSize);

  // After the mask, proceed to next trial
  setTimeout(() => {
    endTrial();
  }, conf.maskTime);
}

// Logs trial data to the console (in a real experiment, this would be sent to a server)
function logTrialData(data) {
  console.log("Trial Data:", data);
}

// Ends the current trial and prepares for the next
function endTrial() {
  state.currentTrialIndex++;
  state.currentTrialInBlock++;

  // Clear canvases
  $stimulusCtx.clearRect(0, 0, $stimulusCanvas.width, $stimulusCanvas.height);

  // If there are more trials, start the next one after a brief delay
  if (state.currentTrialIndex < conf.nTrialsPerBlock * conf.nBlocks) {
    setTimeout(startTrial, 1000); // 1-second inter-trial interval
  } else {
    showCompletionOverlay(); // All trials complete
  }
}

// --- Event Listeners ---
function setupEventListeners() {
  $startDemoButton.addEventListener("click", () => {
    console.log("Start Demo button clicked.");
    hideOverlay($instructionsOverlay);
    console.log("Instructions overlay hidden.");
    startTrial();
    console.log("startTrial() called.");
  });

  $restartDemoButton.addEventListener("click", () => {
    resetGame();
  });

  // Add click listeners to all response buttons
  $responseButtons.forEach((button) => {
    button.addEventListener("click", handleButtonClick);
  });

  // Global keydown listener for instructions/start
  document.addEventListener("keydown", (event) => {
    // Prevent default spacebar behavior (scrolling)
    if (event.key === " ") {
      event.preventDefault();
    }

    // If instructions are visible and space is pressed, start the demo
    if ($instructionsOverlay.style.display === "flex" && event.key === " ") {
      $startDemoButton.click(); // Simulate click on start button
    }
  });
}

// Main initialization sequence
initializeDemoElements(); // Call this AFTER demoHtml is injected

// Load all necessary resources before starting
async function initDemo() {
  try {
    console.log("Demo ready (no external images to load).");
    showInstructionsOverlay(); // Show instructions after everything is ready
    setupEventListeners(); // Setup event listeners
  } catch (error) {
    console.error("Failed to initialize demo:", error);
    demoArea.innerHTML = `<p style="color: red; text-align: center;">Error: Failed to load demo resources. Please try again later.</p>`;
  }
}

initDemo(); // Call the async initialization function
