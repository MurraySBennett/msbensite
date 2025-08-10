const secretSound = new Audio("assets/audio/steal.mp3");

const header = document.getElementById("doi-header");
const counterDisplay = document.getElementById("doi-counter");
const steal_the_doi = document.getElementById("doi-gif");

let clicksLeft = 27; //distinct grievances and complaints against King George

counterDisplay.addEventListener("click", () => {
  if (clicksLeft === 0) {
    clicksLeft = 27;
    counterDisplay.textContent = `${clicksLeft}`;
    steal_the_doi.style.display = "none";
    return;
  }

  if (clicksLeft > 0) {
    clicksLeft--;
    counterDisplay.textContent = `${clicksLeft}`;

    if (clicksLeft === 0) {
      steal_the_doi.style.display = "block";
      secretSound
        .play()
        .catch((err) => console.error("Audio play failed:", err));
    }
  }
});
