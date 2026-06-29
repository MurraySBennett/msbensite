/**
 * steal-the-doi.js
 * The seeing-eye countdown easter egg in the footer.
 *
 * Waits for the "componentsReady" event from components.js before
 * touching the DOM, because the footer is injected asynchronously.
 */

document.addEventListener("componentsReady", () => {
  const footer             = document.querySelector("footer");
  const countdownInitiator = document.getElementById("doi-countdown-initiator");
  const countdownDisplay   = document.getElementById("countdown-display");
  const steal_the_doi      = document.getElementById("doi-gif");
  const factDisplay        = document.getElementById("doi-fact");

  // Guard: if the footer easter-egg elements aren't present on this page, bail.
  if (!countdownInitiator || !steal_the_doi || !factDisplay) return;

  const secretSound = new Audio("/assets/audio/steal.mp3");

  const countdown_stats = [
    { counter: 10, fact: "10 total award nominations." },
    { counter: 9,  fact: "9 criminally unsuccessful nominations." },
    { counter: 8,  fact: "8 masons signed." },
    { counter: 7,  fact: "7.6 fan rating on Rotten Tomatoes." },
    { counter: 6,  fact: `"Six generations of fools, searching after fool's gold".` },
    { counter: 5,  fact: "56 total signatories." },
    { counter: 4,  fact: "4 important clues, but you'll have to steal it first!" },
    { counter: 3,  fact: "3 times the unstealable was stolen." },
    { counter: 2,  fact: "Be at Independence Hall at 2:22." },
    { counter: 1,  fact: "1 iconic line." },
    { counter: 0,  fact: "" },
  ];

  let gifShowing      = false;
  let timeoutId       = null;
  let clicksLeft      = 0;
  let countdownActive = false;

  countdownInitiator.addEventListener("click", () => {
    // If the gif is showing, a click dismisses it
    if (gifShowing) {
      clearTimeout(timeoutId);
      steal_the_doi.style.display = "none";
      steal_the_doi.src = "";
      gifShowing = false;
      return;
    }

    // First click: start the countdown
    if (!countdownActive) {
      countdownActive = true;
      clicksLeft = countdown_stats[0].counter + 1;
      countdownDisplay.style.display = "block";
      steal_the_doi.style.display = "none";
    }

    // Decrement and show the current fact
    if (clicksLeft > 0) {
      clicksLeft--;
      const currentFact = countdown_stats.find((item) => item.counter === clicksLeft);
      factDisplay.textContent = currentFact ? currentFact.fact : "";
    }

    // Final click: reveal the gif
    if (clicksLeft === 0) {
      steal_the_doi.src = "/assets/images/sprites/declaration-of-independence.gif";
      steal_the_doi.style.display = "block";
      if (footer) footer.scrollIntoView({ behavior: "smooth" });
      secretSound.play().catch((err) => console.warn("Audio play failed:", err));
      countdownDisplay.style.display = "none";
      countdownActive = false;
      gifShowing = true;

      timeoutId = setTimeout(() => {
        steal_the_doi.style.display = "none";
        steal_the_doi.src = "";
        gifShowing = false;
      }, 23000);
    }
  });
});
