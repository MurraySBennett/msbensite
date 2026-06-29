/**
 * components.js
 * Fetches and injects the shared nav and footer HTML components into every page.
 * Also sets the active nav link based on the current page, fills in the year,
 * and initialises the dark mode toggle.
 *
 * Usage: include this script in the <head> of every HTML page:
 *   <script src="/js/components.js" defer></script>
 *
 * Each page must have:
 *   <div id="nav-placeholder"></div>   — where the nav will be injected
 *   <div id="footer-placeholder"></div> — where the footer will be injected
 *
 * The active nav item is determined by the data-nav attribute on each <a> tag
 * and the data-page attribute on the <body> element, e.g.:
 *   <body data-page="research">
 */

// Apply dark mode class immediately (before DOMContentLoaded) to prevent
// a flash of light mode on page load for users who prefer dark.
(function () {
  const saved = localStorage.getItem("msb-dark-mode");
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  if (saved === "dark" || (!saved && systemDark)) {
    document.documentElement.classList.add("dark-mode-pending");
  }
})();

(function () {
  // --- Helper: fetch an HTML fragment and inject it into a target element ---
  async function injectComponent(placeholderId, componentPath) {
    const placeholder = document.getElementById(placeholderId);
    if (!placeholder) return;
    try {
      const response = await fetch(componentPath);
      if (!response.ok)
        throw new Error(`Failed to load ${componentPath}: ${response.status}`);
      placeholder.outerHTML = await response.text();
    } catch (err) {
      console.error(err);
    }
  }

  // --- Helper: set the active class on the correct nav link ---
  function setActiveNav() {
    const page = document.body.dataset.page;
    if (!page) return;
    const links = document.querySelectorAll("nav [data-nav]");
    links.forEach((link) => {
      if (link.dataset.nav === page) {
        link.classList.add("active");
      }
    });
  }

  // --- Helper: fill in the current year wherever .current-year appears ---
  function setYear() {
    document.querySelectorAll(".current-year").forEach((el) => {
      el.textContent = new Date().getFullYear();
    });
  }

  // --- Helper: wire up the hamburger menu after nav is injected ---
  function initHamburger() {
    const hamburger = document.querySelector(".hamburger");
    const navLinks = document.getElementById("nav-links");
    if (!hamburger || !navLinks) return;
    hamburger.addEventListener("click", () => {
      const isExpanded = hamburger.getAttribute("aria-expanded") === "true";
      hamburger.setAttribute("aria-expanded", String(!isExpanded));
      navLinks.classList.toggle("open");
    });
  }

  // --- Run everything after DOM is ready ---
  document.addEventListener("DOMContentLoaded", async () => {
    await injectComponent("nav-placeholder", "/components/nav.html");
    await injectComponent("footer-placeholder", "/components/footer.html");
    setActiveNav();
    setYear();
    initHamburger();

    // Initialise dark mode toggle (sets class on body, places button in nav)
    const { initDarkModeToggle } = await import("/js/dark-mode-toggle.js");
    initDarkModeToggle();

    // Remove the pre-DOMContentLoaded pending class now that body has the real class
    document.documentElement.classList.remove("dark-mode-pending");

    // Signal to any scripts that depend on injected components (e.g. steal-the-doi.js)
    // that the nav and footer are now in the DOM and ready.
    document.dispatchEvent(new CustomEvent("componentsReady"));
  });
})();
