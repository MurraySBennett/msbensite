// Function to check if the user is on a mobile device
function isMobile() {
  return /Mobi|Android/i.test(navigator.userAgent);
}

// Function to handle virtual key presses
function dispatchKeyEvent(key, eventType) {
  // Only dispatch the event if a game is active
  if (window.gameActive) {
    window.dispatchEvent(
      new KeyboardEvent(eventType, {
        key: key,
        code: key,
        bubbles: true,
      })
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const virtualGamepad = document.getElementById("virtual-gamepad");

  if (isMobile() && virtualGamepad) {
    // show the gamepad only when a game is active
    if (window.gameActive) {
      virtualGamepad.style.display = "flex";
    }

    virtualGamepad.style.display = "flex";
    const buttons = virtualGamepad.querySelectorAll("button");

    buttons.forEach((button) => {
      const key = button.getAttribute("data-key");

      button.addEventListener("touchstart", (e) => {
        e.preventDefault();
        dispatchKeyEvent(key, "keydown");
      });

      button.addEventListener("touchend", (e) => {
        e.preventDefault();
        dispatchKeyEvent(key, "keyup");
      });
    });
  }
});
