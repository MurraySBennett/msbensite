const konamiCode = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];
let inputSequence = [];

function toggleKonamiMode() {
  document.body.classList.toggle("konami-mode");
  showKonamiToggleButton();
}

// Listen for the Konami Code
window.addEventListener("keydown", (e) => {
  inputSequence.push(e.key);
  inputSequence.splice(
    -konamiCode.length - 1,
    inputSequence.length - konamiCode.length
  );

  if (inputSequence.join("") === konamiCode.join("")) {
    toggleKonamiMode();
  }
});

// Show a toggle button to exit Konami Mode
function showKonamiToggleButton() {
  let toggleButton = document.getElementById("konami-toggle");
  if (!toggleButton) {
    toggleButton = document.createElement("button");
    toggleButton.id = "konami-toggle";
    toggleButton.textContent = "Exit Retro Mode";
    toggleButton.style.position = "fixed";
    toggleButton.style.bottom = "20px";
    toggleButton.style.right = "20px";
    toggleButton.style.zIndex = "10000";
    toggleButton.style.padding = "10px 15px";
    toggleButton.style.fontFamily = "'Press Start 2P', cursive";
    toggleButton.style.backgroundColor = "lime";
    toggleButton.style.color = "black";
    toggleButton.style.border = "2px solid black";
    toggleButton.style.borderRadius = "8px";
    toggleButton.style.cursor = "pointer";
    toggleButton.style.boxShadow = "0 4px 10px rgba(0,0,0,0.5)";

    toggleButton.addEventListener("click", () => {
      document.body.classList.remove("konami-mode");
      toggleButton.remove();
    });

    document.body.appendChild(toggleButton);
  }
}
