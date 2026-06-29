/**
 * experiment-demo-loader.js
 * Reads the ?demo= query parameter and dynamically loads the corresponding
 * demo script from /js/demos/.
 *
 * To add a new demo:
 *   1. Create /js/demos/your-demo-id.js
 *   2. Add an entry to demoMap below.
 *   3. Add a tile to experiments.html.
 *   4. Add an entry to /data/projects-index.json with a matching experiment_demo link.
 */

document.addEventListener("DOMContentLoaded", () => {
  function getQueryParam(param) {
    return new URLSearchParams(window.location.search).get(param);
  }

  const demoId = getQueryParam("demo");
  const demoTitleEl = document.getElementById("demo-title");
  const demoAreaEl = document.getElementById("demo-area");
  const demoErrorEl = document.getElementById("demo-error");

  const demoMap = {
    "dutch-auction": {
      title: "Dutch Auction Experiment",
      scriptPath: "/js/demos/dutch-auction.js",
    },
    "dc-rs": {
      title: "Discrete Choice vs Rating Scale Decisions",
      scriptPath: "/js/demos/dc-rs.js",
    },
    "wheel-of-fortune": {
      title: "Wheel of Fortune Experiment",
      scriptPath: "/js/demos/wheel-of-fortune.js",
    },
    "team-spirit-hh": {
      title: "Team Spirit: Human Teams",
      scriptPath: "/js/demos/team-spirit-hh.js",
    },
    "mel-features": {
      title: "Melanoma Lesion Feature Rating",
      scriptPath: "/js/demos/mel-features.js",
    },
    // Add more demos here:
    // "my-new-demo": { title: "My New Demo", scriptPath: "/js/demos/my-new-demo.js" },
  };

  if (!demoId || !demoMap[demoId]) {
    demoTitleEl.textContent = "Demo Not Found";
    demoAreaEl.innerHTML = "";
    demoErrorEl.style.display = "block";
    return;
  }

  const { title, scriptPath } = demoMap[demoId];
  demoTitleEl.textContent = title;
  document.title = `${title} — Murray S. Bennett`;

  const script = document.createElement("script");
  script.src = scriptPath;
  script.onerror = () => {
    console.error(`Error loading demo script: ${scriptPath}`);
    demoTitleEl.textContent = "Error Loading Demo";
    demoAreaEl.innerHTML = "";
    demoErrorEl.style.display = "block";
  };
  document.body.appendChild(script);
});
