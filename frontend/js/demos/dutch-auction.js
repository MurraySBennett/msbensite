// --- Configuration ---
const conf = {
  money: 350, // starting money
  maxGoods: 400, // 'warehouse' capacity
  nBlocks: 1, // Reduced for demo purposes
  nTrials: 6, // Reduced for demo purposes
  qtyMax: 600, // only used for sizing the goods
  auctionDuration: 5000, // auction duration in ms (5 seconds) - THIS IS YOUR TARGET
  nDPs: 0, // decimal places for money
  delayBefore: 1500, // delay before auction begins (reduced for demo)
  delayAfter: 1000, // delay after winning bid (reduced for demo)
  fogOfWarehouse: true,
  goodsQty: (prop) => parseInt(100 * prop + 50),
  endPrice: (qty) => 0,
  oppBid: (qty, price) => Math.round(price * Math.random()),
  minTotalGoods: 600,
  continuousPriceSteps: 100,
  discretePriceSteps: 10,
};
conf["nPriceSteps"] = conf.continuousPriceSteps;
conf["priceStepDuration"] = Math.round(conf.auctionDuration / conf.nPriceSteps);
conf["startPrice"] = (qty) => {
  const baseValuePerUnit = conf.money / conf.maxGoods;
  const basePriceForThisItem = baseValuePerUnit * qty;
  const minFactor = 1.2;
  const maxFactor = 1.8;
  let calculatedStartPrice =
    basePriceForThisItem *
    (minFactor + Math.random() * (maxFactor - minFactor));
  const absoluteMinStartPrice = 100;
  return Math.round(Math.max(absoluteMinStartPrice, calculatedStartPrice));
};
const trials = [];

let state = {
  user: {
    name: "Player 1",
    address: "Local Demo",
    money: conf.money,
    goods: 0,
  },
  opponents: [
    { name: "Skeletor", goods: 0, money: conf.money },
    { name: "Mumm-Ra", goods: 0, money: conf.money },
  ],
  trial: null,
  status: "none", // 'none', 'starting', 'running', 'paused', 'break', 'complete'
  trialNo: 0,
  blockNo: 0,
  blocksData: [], // To store block summaries for feedback
  auctionType: "continuous",
};

const demoHtml = `
    <style>
        /* Specific styles for the Dutch Auction Demo */
        #dutch-auction-main {
            position: relative;
            width: 800px; /* Increased width */
            height: 600px; /* Increased height */
            margin-left: auto;
            margin-right: auto;
            background-color: #FFD700; /* Gold */
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            overflow: hidden; /* Ensure elements stay within bounds */
        }

        #dutch-auction-main * {
            box-sizing: border-box;
            font-family: 'Inter', sans-serif; /* Use Inter for general text */
            color: #333; /* Dark text for readability */
        }

        h1, h2, h3, h4, h5 {
            font-family: 'Press Start 2P', cursive; /* Retro font for headings */
            color: #6A5ACD; /* SlateBlue */
            text-shadow: 1px 1px 0px rgba(0,0,0,0.1);
        }

        #info-box {
            position: absolute;
            right: 12px;
            top: 12px;
            color: #7B68EE; /* MediumSlateBlue */
            font-size: 0.8em;
            text-align: right;
        }

        #goods-box {
            position: absolute;
            background-color: #ADD8E6; /* LightBlue */
            height: 450px; /* Adjusted for new main height */
            width: 180px; /* Adjusted width */
            left: 100px; /* Adjusted position */
            top: 50px; /* Adjusted position */
            border-radius: 8px;
            overflow: hidden;
            border: 2px solid #4682B4; /* SteelBlue border */
        }

        #goods-accum,
        .goods-accum {
            position: absolute;
            width: 100%; /* Fill parent width */
            height: 0px;
            bottom: 0px;
            background-color: rgba(123, 104, 238, 0.7); /* MediumSlateBlue with transparency */
            transition: height 0.5s ease-out;
        }

        #goods-hypo {
            position: absolute;
            width: 100%;
            bottom: 0;
            left: 0;
            height: 0;
            background-color: #FF69B4; /* HotPink */
            opacity: 0.7;
        }

        .score {
            position: absolute;
            background-color: #7B68EE; /* MediumSlateBlue */
            height: 50px; /* Adjusted size */
            width: 140px; /* Adjusted size */
            line-height: 50px;
            text-align: center;
            color: #E0FFFF; /* LightCyan */
            border-radius: 8px;
            font-family: 'Press Start 2P', cursive;
            font-size: 1em; /* Adjusted font size */
            text-shadow: 1px 1px 0px rgba(0,0,0,0.1);
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }

        #goods-score {
            bottom: 30px; /* Adjusted position */
            left: 125px; /* Adjusted position */
            color: #E0FFFF; /* LightCyan */
            font-family: 'Press Start 2P', cursive;
            font-size: 1em; /* Adjusted font size */
            text-shadow:
                -1px -1px 0 black,  /* Top-left shadow */
                1px -1px 0 black,   /* Top-right shadow */
                -1px 1px 0 black,   /* Bottom-left shadow */
                1px 1px 0 black;    /* Bottom-right shadow */
        }

        #money-score {
            bottom: 30px; /* Adjusted position */
            right: 125px; /* Adjusted position */
            color: #E0FFFF; /* LightCyan */
            font-family: 'Press Start 2P', cursive;
            font-size: 1em; /* Adjusted font size */
            text-shadow:
                -1px -1px 0 black,  /* Top-left shadow */
                1px -1px 0 black,   /* Top-right shadow */
                -1px 1px 0 black,   /* Bottom-left shadow */
                1px 1px 0 black;    /* Bottom-right shadow */
        }

        #price-box {
            position: absolute;
            background-color: #F0F8FF; /* AliceBlue */
            height: 450px; /* Adjusted for new main height */
            width: 180px; /* Adjusted width */
            right: 100px; /* Adjusted position */
            top: 50px; /* Adjusted position */
            border-radius: 8px;
            overflow: hidden;
            border: 2px solid #ADD8E6; /* LightBlue border */
        }

        .price-accum {
            position: absolute;
            height: 100%;
            width: 100%;
            bottom: 0;
            background-color: rgb(255, 252, 168); /* Gold */
            transition: height 0.05s linear; /* Smooth price drop */
        }

        #price-accum[data-state='won']{
            background-color: #98FB98; /* PaleGreen */
        }

        #price-accum[data-state='lost']{
            background-color: #FF6347; /* Tomato */
        }

        #price-score {
            position: absolute;
            width: 100%;
            height: 100%;
            display: flex; /* Use flex for centering */
            align-items: center;
            justify-content: center;
            font-size: 1.2em;
            color: #333;
            font-family: 'Press Start 2P', cursive;
            text-shadow:
                -1px -1px 0 #E0FFFF,  /* Top-left shadow */
                1px -1px 0 #E0FFFF,   /* Top-right shadow */
                -1px 1px 0 #E0FFFF,   /* Bottom-left shadow */
                1px 1px 0 #E0FFFF;    /* Bottom-right shadow */
        }

        #item-box {
            position: absolute;
            width: 125px; /* Adjusted size */
            height: 125px;
            top: 175px; /* Centered vertically for new height */
            left: 50%;
            transform: translateX(-50%); /* Center horizontally */
            border: 2px solid #FF69B4; /* HotPink border */
            background-color: #E0FFFF; /* LightCyan background */
            border-radius: 10px;
            display: flex; /* Use flex for centering content */
            align-items: center;
            justify-content: center;
            overflow: hidden;
        }

        #item {
            width: 80%; /* Item size relative to its box */
            height: 80%;
            background-color: #7B68EE; /* MediumSlateBlue */
            border-radius: 50%; /* Make it a circle */
            display: flex;
            align-items: center;
            justify-content: center;
            color: #E0FFFF;
            text-shadow:
                -1px -1px 0 black,  /* Top-left shadow */
                1px -1px 0 black,   /* Top-right shadow */
                -1px 1px 0 black,   /* Bottom-left shadow */
                1px 1px 0 black;    /* Bottom-right shadow */
            font-size: 1.2em; /* Larger font for item quantity */
            font-family: 'Press Start 2P', cursive;
            // text-shadow: 1px 1px 0px rgba(0,0,0,0.1);
        }

        #progress-box {
            position: absolute;
            width: 200px; /* Adjusted width */
            bottom: 450px; /* Adjusted position */
            height: 50px; /* Adjusted height */
            left: 50%;
            margin-left: -100px; /* Half of new width */
            color: #333;
            display: flex;
            justify-content: space-around;
            align-items: center;
            background-color: #F0F8FF; /* AliceBlue */
            border-radius: 8px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            font-family: 'Press Start 2P', cursive;
            font-size: 0.9em; /* Adjusted font size */
        }

        .progress-accum {
            display: inline-block;
            padding: 0 12px; /* Adjusted padding */
        }

        #feedback {
            position: absolute;
            left: 50%;
            margin-left: -275px; /* Half of new width */
            top: 25px; /* Adjusted position */
            width: 550px; /* Adjusted width */
            background-color: #FFD700; /* Gold */
            border: 2px solid #B8860B; /* DarkGoldenrod */
            border-radius: 10px;
            z-index: 10;
            text-align: center;
            padding: 25px; /* Adjusted padding */
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        }

        #feedback h2 {
            color: #6A5ACD;
            margin-top: 0;
            font-size: 1.5em; /* Adjusted font size */
            font-family: 'Press Start 2P', cursive;
        }

        #feedback p {
            margin-bottom: 20px; /* Adjusted margin */
            font-size: 1em; /* Adjusted font size */
            line-height: 1.5;
        }

        #feedback table {
            margin: auto;
            text-align: center;
            width: 100%;
            border-collapse: collapse;
        }

        #feedback td,
        #feedback th {
            padding: 10px 15px; /* Adjusted padding */
            border: 1px solid #B8860B; /* DarkGoldenrod */
            color: #333;
        }

        #feedback thead th {
            background-color: #7B68EE; /* MediumSlateBlue */
            color: #E0FFFF;
            font-family: 'Press Start 2P', cursive;
            font-size: 0.9em; /* Adjusted font size */
        }

        #feedback tbody tr:nth-child(odd) {
            background-color: #F8F8FF; /* GhostWhite */
        }

        #feedback tbody tr:nth-child(even) {
            background-color: #E6E6FA; /* Lavender */
        }

        #start-button, #restart-button { /* Applied to both buttons */
            background-color: #98FB98; /* PaleGreen */
            color: #E0FFFF;
            font-family: 'Press Start 2P', cursive;
            padding: 18px 35px; /* Adjusted padding */
            font-size: 1.3em; /* Adjusted font size */
            border: none;
            border-radius: 10px;
            cursor: pointer;
            transition: all 0.2s ease;
            box-shadow: 0 5px 10px rgba(0,0,0,0.2);
            margin-top: 25px; /* Adjusted margin */
            text-shadow:
                -1px -1px 0 black,  /* Top-left shadow */
                1px -1px 0 black,   /* Top-right shadow */
                -1px 1px 0 black,   /* Bottom-left shadow */
                1px 1px 0 black;    /* Bottom-right shadow */
 
        }

        #start-button:hover, #restart-button:hover {
            background-color: #3CB371; /* MediumSeaGreen */
            color: #FFF;
            transform: translateY(-3px);
            box-shadow: 0 8px 15px rgba(0,0,0,0.3);
        }

        #instructions {
            position: absolute;
            left: 50%;
            margin-left: -300px; /* Half of new width */
            top: 50px; /* Adjusted position */
            width: 600px; /* Adjusted width */
            background-color: #F0F8FF; /* AliceBlue */
            border: 2px solid #4682B4; /* SteelBlue */
            border-radius: 10px;
            z-index: 10;
            text-align: center;
            padding: 25px; /* Adjusted padding */
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
        }

        #instructions h2 {
            color: #6A5ACD;
            margin-top: 0;
            font-size: 1.5em; /* Adjusted font size */
        }

        #instructions p {
            margin-bottom: 12px; /* Adjusted margin */
            font-size: 1em; /* Adjusted font size */
            line-height: 1.5;
        }
        .auction-type-selector {
            margin-top: 15px;
            margin-bottom: 15px;
        }
        .type-button {
            background-color: #E6E6FA;
            color: #4682B4;
            font-family: 'PressStart 2P', cursive;
            padding: 8px 15px;
            font-size: 0.8em;
            border: 2px solid #4682B4;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s ease;
            margin: 0 5px;
        }
        .type-button:hover {
            background-color: #D8BFD8;
            transform: translateY(-2px);
        }
        .type-button.active {
            background-color: #7B68EE;
            color: #E0FFFF;
            border-color: #6A5ACD;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        
    </style>
    <div id="dutch-auction-main">
        <div id="info-box">
            <span id="info-name"></span><br>
            <span id="info-address"></span>
        </div>
        <div id="item-box">
            <div id="item"></div>
        </div>
        <div id="goods-box">
            <div id="goods-accum" class="accum"></div>
            <div class="goods-accum"></div>
            <div class="goods-accum"></div>
            <div class="goods-accum"></div>
            <div id="goods-hypo" class="accum"></div>
        </div>
        <div id="price-box">
            <div id="price-accum" class="price-accum"></div>
            <div id="price-score"></div>
        </div>
        <div id="progress-box">
            Auction <div id="progress-accum-trials" class="progress-accum">0 / 0</div>
        </div>
        <div id="goods-score" class="score"></div>
        <div id="money-score" class="score"></div>

        <div id="instructions">
            <h2>Welcome to the Dutch Auction!</h2>
            <p><strong>Game:</strong> You will compete against two opponents in a Dutch Auction bidding game. Items start at a high price and decrease over time. The <strong>first</strong> to bid wins the item at the current price.</p>
            <p><strong>Goal:</strong> Fill your warehouse (${conf.maxGoods} units, blue box; left) while managing your funds ($${conf.money}, purple box; bottom right). </p> 
            <p><strong>How to Play:</strong> The amount of available units will appear (center) with a starting price (yellow box; right) and the price will begin to drop. Press the <strong>SPACEBAR</strong> to bid and purchase the units at the current price. Be quick, but don't overspend!</p>
            <div class="auction-type-selector">
            <p>Select Auction Type:</p>
                <button id="select-smooth-button" class="type-button active">Small and Fast</button>
                <button id="select-discrete-button" class="type-button">Large and Slow</button>
            </div>
            <button id="start-button">Start Game</button>
        </div>

        <div id="feedback" style="display:none;">
            <h2>Block complete</h2>
            <p id="feedback-success" style="display:none;">You successfully filled your warehouse!</p>
            <p id="feedback-failure" style="display:none;">You did <strong>not</strong> fill your warehouse.</p>
            <table>
                <thead>
                    <tr>
                        <th>Player</th><th>Warehouse Qty</th><th>Funds Remaining</th>
                    </tr>
                </thead>
                <tbody>
                    <tr><td>You</td><td id="feedback-you-goods">0</td><td id="feedback-you-money">$0.00</td></tr>
                    <tr><td>Skeletor</td><td id="feedback-opp1-goods">0</td><td id="feedback-opp1-money">$0.00</td></tr>
                    <tr><td>Mumm-Ra</td><td id="feedback-opp2-goods">0</td><td id="feedback-opp2-money">$0.00</td></tr>
                </tbody>
            </table>
            <button id="restart-button">Play Again?</button>
        </div>
    </div>
`;

// Declare demoArea with 'let' so it can be assigned after HTML injection
let demoArea = document.getElementById("demo-area");
if (demoArea) {
  demoArea.innerHTML = demoHtml;
} else {
  console.error("Could not find #demo-area to inject Dutch Auction demo.");
}

// --- DOM Element References (Declared with let, assigned in initializeDemoElements) ---
let $goodsAccum;
let $goodsHypo;
let $goodsOppAccums;
let $priceAccum;
let $priceScore;
let $item;
let $feedback;
let $feedbackSuccess;
let $feedbackFailure;
let $progressAccumTrials;
// let $progressAccumBlocks;
let $startButton; // Renamed from $startButton to clarify initial button
let $restartButton; // New reference for the button in feedback
let $instructions; // New reference for the instructions div

let $feedbackYouGoods;
let $feedbackYouMoney;
let $feedbackOpp1Goods;
let $feedbackOpp1Money;
let $feedbackOpp2Goods;
let $feedbackOpp2Money;

let $selectSmoothButton;
let $selectDiscreteButton;

// Function to initialize DOM element references after HTML is injected
function initializeDemoElements() {
  // These assignments MUST happen AFTER demoHtml is injected into demoArea
  $goodsAccum = document.getElementById("goods-accum");
  $goodsHypo = document.getElementById("goods-hypo");
  $goodsOppAccums = document.querySelectorAll("#goods-box .goods-accum");
  $priceAccum = document.getElementById("price-accum");
  $priceScore = document.getElementById("price-score");
  $item = document.getElementById("item");
  $feedback = document.getElementById("feedback");
  $feedbackSuccess = document.getElementById("feedback-success");
  $feedbackFailure = document.getElementById("feedback-failure");
  $progressAccumTrials = document.getElementById("progress-accum-trials");
  //   $progressAccumBlocks = document.getElementById("progress-accum-blocks");
  $startButton = document.getElementById("start-button"); // Initial start button (in instructions)
  $restartButton = document.getElementById("restart-button"); // restart Button in feedback
  $instructions = document.getElementById("instructions"); // Instructions div

  $feedbackYouGoods = document.getElementById("feedback-you-goods");
  $feedbackYouMoney = document.getElementById("feedback-you-money");
  $feedbackOpp1Goods = document.getElementById("feedback-opp1-goods");
  $feedbackOpp1Money = document.getElementById("feedback-opp1-money");
  $feedbackOpp2Goods = document.getElementById("feedback-opp2-goods");
  $feedbackOpp2Money = document.getElementById("feedback-opp2-money");

  $selectSmoothButton = document.getElementById("select-smooth-button");
  $selectDiscreteButton = document.getElementById("select-discrete-button");
}

// Function to update configuration based on auction type
function setAuctionTypeConfig(type) {
  state.auctionType = type;
  if (type === "continuous") {
    conf.nPriceSteps = conf.continuousPriceSteps;
  } else {
    // type === 'discrete'
    conf.nPriceSteps = conf.discretePriceSteps;
  }
  conf.priceStepDuration = Math.round(conf.auctionDuration / conf.nPriceSteps);

  if ($selectSmoothButton) {
    // Check if elements exist before manipulating
    $selectSmoothButton.classList.toggle("active", type === "continuous");
    $selectDiscreteButton.classList.toggle("active", type === "discrete");
  }
  generateTrials();
}

// --- Trial Generation (Client-side) ---
function generateTrials() {
  let totalGeneratedGoods = 0;
  let attempts = 0;

  do {
    trials.length = 0; // Clear the array for regeneration
    totalGeneratedGoods = 0; // Reset total for this attempt
    attempts++;

    for (let i = 0; i < conf.nTrials * conf.nBlocks; i++) {
      let qty = conf.goodsQty(Math.random());
      let startPrice = conf.startPrice(qty); // startPrice depends on qty
      let endPrice = conf.endPrice(qty);
      let prop = qty / conf.qtyMax;

      trials.push({
        blockNo: Math.floor(i / conf.nTrials),
        trialNo: i % conf.nTrials,
        prop,
        qty,
        startPrice,
        endPrice,
        step: "",
        price: "",
        winner: "",
      });
      totalGeneratedGoods += qty; // Accumulate total goods
    }

    if (attempts > 1000 && totalGeneratedGoods < conf.minTotalGoods) {
      console.warn(
        "Could not meet minTotalGoods requirement after many attempts. Consider adjusting conf.minTotalGoods or goodsQty generation."
      );
      break;
    }
  } while (totalGeneratedGoods < conf.minTotalGoods);
}

// --- Game Logic Functions ---
function resetGame() {
  state.user.money = conf.money;
  state.user.goods = 0;

  state.opponents.forEach((opp) => {
    opp.money = conf.money;
    opp.goods = 0;
  });

  state.trial = null;
  state.trialNo = 0;
  state.blockNo = 0;
  state.blocksData = [];
  clearInterval(priceIntervalId);
  state.status = "none";
}

function updateDisplay() {
  if (!$goodsAccum) {
    console.error(
      "DOM elements not initialized. Call initializeDemoElements() first."
    );
    return;
  }

  // Update player's goods and money
  document.getElementById("money-score").textContent =
    "$" + state.user.money.toFixed(conf.nDPs);
  document.getElementById("goods-score").textContent =
    "" + state.user.goods.toFixed(0);

  // Update warehouse fill level
  $goodsAccum.style.height = `${(100 * state.user.goods) / conf.maxGoods}%`;
  $goodsHypo.style.bottom = `${(100 * state.user.goods) / conf.maxGoods}%`;

  // Update progress indicators
  if (state.trial) {
    $progressAccumTrials.textContent = `${state.trial.trialNo + 1} / ${
      conf.nTrials
    }`;
    // $progressAccumBlocks.textContent = `${state.blockNo + 1} / ${conf.nBlocks}`;
  } else {
    $progressAccumTrials.textContent = `0 / ${conf.nTrials}`;
    // $progressAccumBlocks.textContent = `0 / ${conf.nBlocks}`;
  }

  // Update opponent warehouses (if not fogged)
  if (conf.fogOfWarehouse !== true) {
    state.opponents.forEach((opp, i) => {
      if ($goodsOppAccums[i]) {
        $goodsOppAccums[i].style.height = `${
          (100 * opp.goods) / conf.maxGoods
        }%`;
      }
    });
  }

  // Update feedback table
  $feedbackYouGoods.textContent = state.user.goods.toFixed(0);
  $feedbackYouMoney.textContent = "$" + state.user.money.toFixed(conf.nDPs);
  // Loop through opponents to update their feedback rows
  state.opponents.forEach((opp, i) => {
    const oppGoodsElem = document.getElementById(`feedback-opp${i + 1}-goods`);
    const oppMoneyElem = document.getElementById(`feedback-opp${i + 1}-money`);
    if (oppGoodsElem) oppGoodsElem.textContent = opp.goods.toFixed(0);
    if (oppMoneyElem)
      oppMoneyElem.textContent = "$" + opp.money.toFixed(conf.nDPs);
  });

  // Handle game status display
  if (state.status === "paused") {
    $priceScore.textContent = "PAUSED";
    $priceAccum.style.height = "100%";
    $priceAccum.removeAttribute("data-state");
    $feedback.style.display = "none";
    $instructions.style.display = "none"; // Ensure instructions are hidden
    $startButton.style.display = "inline-block"; // This is the 'Start Game' button in instructions
    $restartButton.style.display = "none"; // Ensure feedback button is hidden
    document
      .querySelectorAll(".auction-type-selector")
      .forEach((el) => (el.stype.display = "none"));
  } else if (state.status === "break") {
    $priceScore.textContent = "Block complete! Time for a break";
    $priceAccum.style.height = "100%";
    $priceAccum.removeAttribute("data-state");
    $feedbackSuccess.style.display =
      state.user.goods >= conf.maxGoods ? "block" : "none";
    $feedbackFailure.style.display =
      state.user.goods < conf.maxGoods ? "block" : "none";
    $feedback.style.display = "block";
    $instructions.style.display = "none"; // Ensure instructions are hidden
    $startButton.style.display = "none"; // Hide the initial start button
    $restartButton.textContent = "Play again?";
    $restartButton.style.display = "inline-block"; // Show the feedback button
    document
      .querySelectorAll(".auction-type-selector")
      .forEach((el) => (el.style.display = "block"));
    $startButton.style.display = "none"; // Hide the initial start button
    $restartButton.textContent = "Play again?"; // Ensure button text is correct
    $restartButton.style.display = "inline-block";
  } else if (state.status === "starting") {
    $priceAccum.style.transition = "none";
    $priceAccum.style.height = "100%";
    setTimeout(() => {
      $priceScore.textContent = "Starting";
      $priceAccum.style.height = "0";
      $priceAccum.style.transition = `${conf.delayBefore}ms height linear`;
    }, 0);
    $feedback.style.display = "none";
    $instructions.style.display = "none"; // Ensure instructions are hidden
    $startButton.style.display = "none";
    $restartButton.style.display = "none";
    document
      .querySelectorAll(".auction-type-selector")
      .forEach((el) => (el.style.display = "none"));
  } else if (state.trial && state.trial.status === "ready") {
    $priceScore.textContent = "$" + state.trial.startPrice.toFixed(conf.nDPs);
    $priceAccum.style.transition = "none";
    $priceAccum.style.height = "100%";
    $priceAccum.removeAttribute("data-state");
    $goodsHypo.style.height = `${parseInt(
      (100 * state.trial.qty) / conf.maxGoods
    )}%`;
    $item.textContent = state.trial.qty;
    let lw = Math.sqrt(state.trial.prop);
    $item.style.width = `${parseInt(100 * lw)}%`;
    $item.style.height = `${parseInt(100 * lw)}%`;
    $feedback.style.display = "none";
    $instructions.style.display = "none"; // Ensure instructions are hidden
    $startButton.style.display = "none";
    $restartButton.style.display = "none";
    document
      .querySelectorAll(".auction-type-selector")
      .forEach((el) => (el.style.display = "none"));
  } else if (state.trial && state.trial.status === "running") {
    // Price drop animation handled by interval
    $feedback.style.display = "none";
    $instructions.style.display = "none"; // Ensure instructions are hidden
    $startButton.style.display = "none";
    $restartButton.style.display = "none";
    document
      .querySelectorAll(".auction-type-selector")
      .forEach((el) => (el.style.display = "none"));
  } else if (state.trial && state.trial.status === "won") {
    let proportion =
      (state.trial.price - state.trial.endPrice) /
      (state.trial.startPrice - state.trial.endPrice);
    let percent = 100 * proportion;

    if (state.trial.winner === state.user.name) {
      $priceAccum.setAttribute("data-state", "won");
    } else {
      $priceAccum.setAttribute("data-state", "lost");
    }

    $priceScore.textContent = "$" + state.trial.price.toFixed(conf.nDPs);
    $priceAccum.style.transition = "none";
    $priceAccum.style.height = `${percent}%`;
    $goodsHypo.style.height = "0";
    $feedback.style.display = "none"; // Ensure feedback is hidden until break
    $instructions.style.display = "none"; // Ensure instructions are hidden
    $startButton.style.display = "none";
    $restartButton.style.display = "none";
    document
      .querySelectorAll(".auction-type-selector")
      .forEach((el) => (el.style.display = "none"));
  } else if (state.status === "complete") {
    $priceScore.textContent = "DEMO COMPLETE!";
    $priceAccum.style.height = "100%";
    $priceAccum.removeAttribute("data-state");
    $feedbackSuccess.style.display =
      state.user.goods >= conf.maxGoods ? "block" : "none";
    $feedbackFailure.style.display =
      state.user.goods < conf.maxGoods ? "block" : "none";
    $feedback.style.display = "block";
    $instructions.style.display = "none"; // Ensure instructions are hidden
    $startButton.style.display = "none";
    $restartButton.style.display = "none"; // No more blocks to start
    // Show type selectors in feedback/complete screen
    document
      .querySelectorAll(".auction-type-selector")
      .forEach((el) => (el.style.display = "block"));
    $startButton.style.display = "none";
    $restartButton.style.display = "inline-block";
  } else if (state.status === "none") {
    // Show type selectors in instructions
    document
      .querySelectorAll(".auction-type-selector")
      .forEach((el) => (el.style.display = "block"));
    $feedback.style.display = "none";
    $instructions.style.display = "block";
    $startButton.style.display = "inline-block";
    $restartButton.style.display = "none";
  }
}

let priceIntervalId = null; // To store the interval ID for price drop

function bid(bidderName, bidPrice) {
  if (state.trial.status === "running") {
    clearInterval(priceIntervalId); // Stop the price drop

    state.trial.status = "won";
    state.trial.winner = bidderName;
    state.trial.price = bidPrice;

    state.trial.step = parseInt(
      (conf.nPriceSteps * (state.trial.startPrice - bidPrice)) /
        (state.trial.startPrice - state.trial.endPrice)
    );

    // Update winner's goods and money
    if (bidderName === state.user.name) {
      state.user.money -= bidPrice;
      state.user.goods += state.trial.qty;
      if (state.user.goods > conf.maxGoods) {
        state.user.goods = conf.maxGoods;
      }
    } else {
      // For a simple demo, opponents also 'receive' goods/money,
      // but their state isn't visually tracked in detail for the user.
      // This is simplified from the multi-user server logic.
      const winningOpponent = state.opponents.find(
        (opp) => opp.name === bidderName
      );
      if (winningOpponent) {
        winningOpponent.money -= bidPrice;
        winningOpponent.goods += state.trial.qty;
        if (winningOpponent.goods > conf.maxGoods) {
          winningOpponent.goods = conf.maxGoods;
        }
      }
    }

    updateDisplay(); // Update display immediately after bid

    // Check for block completion
    if (state.trial.trialNo === conf.nTrials - 1) {
      // Record block data for feedback
      state.blocksData.push({
        blockNo: state.blockNo + 1,
        userGoods: state.user.goods,
        userMoney: state.user.money,
        opponentGoods: state.opponents.map((o) => o.goods),
        opponentMoney: state.opponents.map((o) => o.money),
      });
      state.status = "break";
      updateDisplay(); // Show break feedback
    } else {
      // Move to next trial
      setTimeout(runTrial, conf.delayAfter);
    }
  }
}

function runTrial() {
  if (state.blockNo >= conf.nBlocks) {
    state.status = "complete";
    updateDisplay();
    return;
  }

  if (state.trialNo >= conf.nTrials) {
    state.blockNo++;
    state.trialNo = 0;
    // Reset user/opponent goods/money for new block if desired, or keep cumulative
    // For this demo, we'll keep it cumulative but show block summary.
    if (state.blockNo >= conf.nBlocks) {
      state.status = "complete";
      updateDisplay();
      return;
    }
  }

  state.trial = trials[state.blockNo * conf.nTrials + state.trialNo];
  state.trial.status = "ready";
  state.trialNo++;

  // Calculate the opponent's desired bidding range once per trial
  const baseValuePerUnit = conf.money / conf.maxGoods;
  const meanOpponentBidValue = Math.round(baseValuePerUnit * state.trial.qty);
  const bidRangeOffset = Math.round(meanOpponentBidValue * 0.2);
  const minOpponentBid = Math.max(10, meanOpponentBidValue - bidRangeOffset);
  const maxOpponentBid = meanOpponentBidValue + bidRangeOffset;
  const actualOpponentBidPrice =
    minOpponentBid + Math.random() * (maxOpponentBid - minOpponentBid);
  state.trial.oppBid = actualOpponentBidPrice.toFixed(conf.nDPs);
  const biddingOpponentIndex = Math.floor(
    Math.random() * state.opponents.length
  );
  let biddingOpponent = state.opponents[biddingOpponentIndex];
  let opponentHasBidThisTrial = false; // Flag to ensure only one bid from the chosen opponent per trial

  updateDisplay();

  setTimeout(() => {
    state.trial.status = "running";
    updateDisplay();

    let startPrice = state.trial.startPrice;
    let endPrice = state.trial.endPrice;
    let priceRange = startPrice - endPrice;

    let startTime = performance.now();

    priceIntervalId = setInterval(() => {
      if (state.trial.status !== "running") {
        clearInterval(priceIntervalId);
        return;
      }

      let elapsedTime = performance.now() - startTime; // Time elapsed since auction started
      let currentPrice =
        startPrice - (priceRange / conf.auctionDuration) * elapsedTime;
      currentPrice = Math.max(endPrice, currentPrice); // Clamp to endPrice (0)
      $priceScore.textContent = "$" + currentPrice.toFixed(conf.nDPs);
      state.trial.price = currentPrice;

      let currentPriceRelativeToEnd = currentPrice - endPrice;
      let currentFillPercentage =
        (currentPriceRelativeToEnd / priceRange) * 100;
      $priceAccum.style.height = `${currentFillPercentage}%`;

      if (!opponentHasBidThisTrial && currentPrice <= actualOpponentBidPrice) {
        if (biddingOpponent.money > currentPrice) {
          bid(biddingOpponent.name, currentPrice);
          opponentHasBidThisTrial = true;
        } else {
          biddingOpponent = state.opponents[Math.abs(biddingOpponentIndex - 1)];
          if (biddingOpponent.money > currentPrice) {
            bid(biddingOppoenent.name, currentPrice);
            opponentHasBidThisTrial = true;
          }
        }
      }

      if (elapsedTime >= conf.auctionDuration) {
        clearInterval(priceIntervalId);
        if (state.trial.status === "running") {
          state.trial.status = "lost"; // No winner
          state.trial.winner = "No one";
          state.trial.price = endPrice; // Ensure price is exactly endPrice at the end
          updateDisplay();
          setTimeout(runTrial, conf.delayAfter);
        }
      }
    }, conf.priceStepDuration);
  }, conf.delayBefore);
}

// --- Event Listeners ---
const setupEventListeners = () => {
  // Listener for the initial 'Start Game' button within instructions
  if ($startButton) {
    $startButton.addEventListener("click", () => {
      if (state.status === "none") {
        // Only start game if it hasn't started yet
        state.status = "starting";
        updateDisplay();
        setTimeout(() => {
          state.status = "running";
          runTrial();
        }, conf.delayBefore);
      }
    });
  } else {
    console.error("Initial Start button not found.");
  }

  // Listener for the 'restart' button within feedback
  if ($restartButton) {
    $restartButton.addEventListener("click", () => {
      resetGame(); // This button now always triggers a full game reset and restart
      updateDisplay();
    });
  } else {
    console.error("Restart button not found.");
  }
  if ($selectSmoothButton) {
    $selectSmoothButton.addEventListener("click", () =>
      setAuctionTypeConfig("continuous")
    );
  }
  if ($selectDiscreteButton) {
    $selectDiscreteButton.addEventListener("click", () =>
      setAuctionTypeConfig("discrete")
    );
  }

  document.addEventListener("keydown", (event) => {
    // Prevent default spacebar behavior (scrolling)
    if (event.key === " ") {
      event.preventDefault();
    }

    if (!state || !state.trial || state.trial.status !== "running") {
      return;
    }
    // The check for event.key === ' ' is handled above
    if (event.key !== " ") {
      return;
    }
    if (state.trial.price > state.user.money) {
      // Optionally, provide feedback that user cannot afford it
      console.log("Cannot bid: Insufficient funds!");
      return;
    }
    if (state.user.goods >= conf.maxGoods) {
      // Optionally, provide feedback that warehouse is full
      console.log("Cannot bid: Warehouse full!");
      return;
    }

    bid(state.user.name, state.trial.price);
  });
};

initializeDemoElements(); // Call this AFTER demoHtml is injected

// Initial display settings
document.getElementById("info-name").textContent = state.user.name;
document.getElementById("info-address").textContent = state.user.address;
$feedback.style.display = "none"; // Hide feedback initially
$instructions.style.display = "block"; // Show instructions initially
// The start button is now part of the instructions div and will be visible with it.
$priceScore.textContent = "Press Start to Begin"; // Initial message
$priceAccum.style.height = "100%"; // Price bar full at start

// updateDisplay(); // Initial display update to set up scores etc.

setAuctionTypeConfig(state.auctionType);
setupEventListeners(); // Call this AFTER elements are initialized and initial display is set
