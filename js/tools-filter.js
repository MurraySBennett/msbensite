/**
 * tools-filter.js — sector chips on tools.html.
 *
 * How a non-academic self-selects. Someone who works in healthcare should not
 * have to read seven methods summaries to find the one tile that is for them.
 *
 * Progressive enhancement, deliberately: the chips are rendered by
 * `scripts/build_site.py` into a container that is empty in the source HTML,
 * and every tile is visible before this script runs. If the script fails to
 * load, the page is a complete list of tools rather than a blank one. That is
 * why the filtering is done here and not with CSS `:has()` — `:has()` would
 * put the page's correctness in a selector some browsers still do not support.
 */

(function () {
  const bar = document.querySelector(".sector-filters");
  if (!bar) return;

  const tiles = Array.from(document.querySelectorAll(".tool-tile"));
  const sections = Array.from(document.querySelectorAll(".tools-section"));
  const empty = document.getElementById("no-tools-match");

  function apply(sector) {
    let shown = 0;
    for (const tile of tiles) {
      const match = sector === "all" || (tile.dataset.sectors || "").split(" ").includes(sector);
      tile.hidden = !match;
      if (match) shown++;
    }
    // A section heading over nothing reads as a broken page, so hide a section
    // the filter has emptied. A section that is empty to begin with STAYS --
    // it carries its own "nothing here yet" line, and the three sections are
    // the taxonomy the page is organised by. Hiding one would hide the plan.
    for (const section of sections) {
      if (section.classList.contains("is-empty")) continue;
      section.hidden = section.querySelectorAll(".tool-tile:not([hidden])").length === 0;
    }
    if (empty) empty.hidden = shown > 0;

    for (const button of bar.querySelectorAll(".sector-filter")) {
      const active = button.dataset.sector === sector;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  bar.addEventListener("click", (event) => {
    const button = event.target.closest(".sector-filter");
    if (button) apply(button.dataset.sector);
  });

  apply("all");
})();
