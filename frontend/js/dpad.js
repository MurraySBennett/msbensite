(function () {
  // Check for mobile or tablet
  function isMobileOrTablet() {
    const ua = navigator.userAgent;
    if (/Mobi|Tablet|Android|iPad|iPhone|iPod|KFAPWI/i.test(ua)) {
      return true;
    }
    // Additional check for iPadOS
    if (
      navigator.maxTouchPoints &&
      navigator.maxTouchPoints > 2 &&
      /MacIntel/.test(navigator.platform)
    ) {
      return true;
    }
    return false;
  }

  const virtualGamepad = document.getElementById("virtual-gamepad");
  if (!isMobileOrTablet() || !virtualGamepad) {
    // If not a mobile/tablet, or the gamepad element doesn't exist, exit.
    if (virtualGamepad) virtualGamepad.style.display = "none";
    return;
  }

  // Poll for changes to window.gameActive (simple and reliable)
  setInterval(() => {
    if (window.gameActive) {
      virtualGamepad.classList.add("active");
    } else {
      virtualGamepad.classList.remove("active");
    }
  }, 100);

  // Create and dispatch synthetic key events
  function triggerKeyEvent(type, key) {
    // console.log(`Dispatching ${type} event for key: ${key}`); // Debug log
    const event = new KeyboardEvent(type, {
      key,
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
  }

  // Get all D-pad and action buttons
  const buttons = virtualGamepad.querySelectorAll("button");
  buttons.forEach((btn) => {
    const key = btn.dataset.key;

    function pressHandler(e) {
      if (!window.gameActive) return;
      e.preventDefault();
      triggerKeyEvent("keydown", key);
    }

    function releaseHandler(e) {
      if (!window.gameActive) return;
      e.preventDefault();
      triggerKeyEvent("keyup", key);
    }

    // Attach touch events
    btn.addEventListener("touchstart", pressHandler, { passive: false });
    btn.addEventListener("touchend", releaseHandler, { passive: false });
    btn.addEventListener("touchcancel", releaseHandler, { passive: false });
  });

  // Create and manage the Exit button
  const exitBtn = document.createElement("button");
  exitBtn.id = "exit-btn";
  exitBtn.textContent = "X";
  document.body.appendChild(exitBtn);

  exitBtn.addEventListener("click", () => {
    if (window.stopCurrentGame) {
      window.stopCurrentGame();
      window.stopCurrentGame = null;
    }
    window.gameActive = false;
    exitBtn.style.display = "none";
    virtualGamepad.classList.remove("active");
    // Re-enable page scrolling if it was disabled by the game
    document.body.style.overflow = "";
  });

  // Use a single observer for both gamepad and exit button
  const gamepadObserver = new MutationObserver(() => {
    if (virtualGamepad.classList.contains("active")) {
      exitBtn.style.display = "flex";
      // Prevent page scrolling when the game is active
      document.body.style.overflow = "hidden";
    } else {
      exitBtn.style.display = "none";
      document.body.style.overflow = "";
    }
  });
  gamepadObserver.observe(virtualGamepad, {
    attributes: true,
    attributeFilter: ["class"],
  });
})();
