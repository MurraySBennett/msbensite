/**
 * research-grid.js
 * Dynamically renders the research project tiles on research.html.
 *
 * Reads /data/projects-index.json for the list of projects,
 * fetches each project's /data/projects/{id}/meta.json for tile content,
 * and populates the category grid sections already in the HTML.
 *
 * Each category section must have:
 *   <div class="research-grid" data-category="Category Name Here"></div>
 *
 * In-progress projects without a thumbnail are shown as text-only tiles
 * so the grid stays clean rather than showing broken images or placeholders.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const STATUS_LABELS = {
    "published": { label: "Published", cls: "status-published" },
    "under-review": { label: "Under Review", cls: "status-review" },
    "in-progress": { label: "In Progress", cls: "status-progress" },
  };

  function statusBadge(status) {
    const s = STATUS_LABELS[status] || { label: status, cls: "" };
    return `<span class="status-badge ${s.cls}">${s.label}</span>`;
  }

  function buildTile(meta) {
    const badge = statusBadge(meta.status);
    const imgHtml = meta.thumbnail
      ? `<img src="${meta.thumbnail}" alt="${meta.thumbnail_alt || meta.title}" class="tile-thumbnail" loading="lazy" />`
      : `<div class="tile-thumbnail-placeholder"></div>`;

    return `
      <a href="/project-detail.html?id=${meta.id}" class="research-tile">
        ${imgHtml}
        <div class="tile-body">
          <div class="tile-header">
            <h3>${meta.title}</h3>
            ${badge}
          </div>
          <p>${meta.summary}</p>
        </div>
      </a>
    `;
  }

  try {
    // 1. Fetch the index
    const indexRes = await fetch("/data/projects-index.json");
    if (!indexRes.ok) throw new Error(`Could not load projects index: ${indexRes.status}`);
    const index = await indexRes.json();

    // 2. Fetch all meta files in parallel
    const metaResults = await Promise.allSettled(
      index.map(({ id }) =>
        fetch(`/data/projects/${id}/meta.json`).then((r) => {
          if (!r.ok) throw new Error(`meta.json not found for ${id}`);
          return r.json();
        })
      )
    );

    // 3. Build a map: category → array of meta objects (fulfilled only)
    const byCategory = {};
    metaResults.forEach((result) => {
      if (result.status !== "fulfilled") return;
      const meta = result.value;
      if (!byCategory[meta.category]) byCategory[meta.category] = [];
      byCategory[meta.category].push(meta);
    });

    // 4. Find each category grid in the DOM and populate it
    document.querySelectorAll(".research-grid[data-category]").forEach((grid) => {
      const category = grid.dataset.category;
      const projects = byCategory[category] || [];

      if (projects.length === 0) {
        grid.innerHTML = `<p class="no-projects">No projects in this category yet.</p>`;
        return;
      }

      grid.innerHTML = projects.map(buildTile).join("");
    });

  } catch (err) {
    console.error("Error loading research grid:", err);
    document.querySelectorAll(".research-grid[data-category]").forEach((grid) => {
      grid.innerHTML = `<p class="grid-error">Could not load projects. Please try refreshing the page.</p>`;
    });
  }
});
