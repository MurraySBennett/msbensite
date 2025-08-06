document.addEventListener("DOMContentLoaded", () => {
  // Function to get query parameters from the URL
  function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  }

  // Get the demo ID from the URL (e.g., 'dutch-auction' from ?demo=dutch-auction)
  const demoId = getQueryParam("demo");

  // Get references to HTML elements
  const demoTitleElem = document.getElementById("demo-title");
  const demoAreaElem = document.getElementById("demo-area");
  const demoErrorElem = document.getElementById("demo-error");

  // Define a map of demo IDs to their corresponding JavaScript file paths
  // These JS files will contain the actual demo logic and UI
  const demoMap = {
    "dutch-auction": {
      title: "Dutch Auction Experiment",
      scriptPath: "js/demos/dutch-auction.js",
    },
    "dc-rs": {
      title: "Discrete Choice vs Rating Scale Decisions",
      scriptPath: "js/demos/dc-rs.js",
    },
    "wheel-of-fortune": {
      title: "Wheel of Fortune Experiment",
      scriptPath: "js/demos/wheel-of-fortune.js",
    },
    "team-spirit-hh": {
      title: "Team Spirit: Human Teams",
      scriptPath: "js/demos/team-spirit-hh.js",
    },
    // Add more demos here as you create them:
  };

  // Function to load a specific demo
  async function loadDemo() {
    if (!demoId || !demoMap[demoId]) {
      // If no demo ID or an invalid ID is provided
      demoTitleElem.textContent = "Demo Not Found";
      demoAreaElem.innerHTML = ""; // Clear any loading message
      demoErrorElem.style.display = "block"; // Show error message
      return;
    }

    const demoInfo = demoMap[demoId];
    demoTitleElem.textContent = demoInfo.title; // Set the title immediately

    try {
      const script = document.createElement("script");
      script.src = demoInfo.scriptPath;
      //   script.type = "module"; // Use type="module" if your demo JS uses ES modules (recommended)
      script.onerror = () => {
        console.error(`Error loading demo script: ${demoInfo.scriptPath}`);
        demoTitleElem.textContent = "Error Loading Demo";
        demoAreaElem.innerHTML = "";
        demoErrorElem.style.display = "block";
      };
      document.body.appendChild(script);
    } catch (error) {
      console.error("Failed to load demo:", error);
      demoTitleElem.textContent = "Error Loading Demo";
      demoAreaElem.innerHTML = "";
      demoErrorElem.style.display = "block";
    }
  }

  loadDemo();
});
