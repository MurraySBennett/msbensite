/**
 * project-detail.js
 * Loads a project's meta.json and content.md from /data/projects/{id}/
 * and populates the project detail page.
 *
 * Requires marked.js to be loaded before this script for Markdown rendering.
 * CDN: https://cdn.jsdelivr.net/npm/marked/marked.min.js
 */

document.addEventListener("DOMContentLoaded", async () => {
  // --- Helpers ---
  function getQueryParam(param) {
    return new URLSearchParams(window.location.search).get(param);
  }

  const projectId = getQueryParam("id");

  // --- Element references ---
  const titleEl = document.getElementById("project-title");
  const statusEl = document.getElementById("project-status");
  const summaryEl = document.getElementById("project-summary");
  const contentEl = document.getElementById("project-content");
  const linksContainerEl = document.getElementById("project-links-container");
  const thumbnailEl = document.getElementById("project-thumbnail");
  const publicationsEl = document.getElementById("project-publications");
  const tagsEl = document.getElementById("project-tags");

  function showError(message) {
    titleEl.textContent = "Project Not Found";
    summaryEl.textContent = message;
    if (contentEl) contentEl.innerHTML = "";
    if (linksContainerEl) linksContainerEl.style.display = "none";
    if (thumbnailEl) thumbnailEl.style.display = "none";
  }

  if (!projectId) {
    showError("No project ID provided in the URL.");
    return;
  }

  // --- Status badge helper ---
  const STATUS_LABELS = {
    "published": { label: "Published", cls: "status-published" },
    "under-review": { label: "Under Review", cls: "status-review" },
    "in-progress": { label: "In Progress", cls: "status-progress" },
  };

  function renderStatusBadge(status) {
    const s = STATUS_LABELS[status] || { label: status, cls: "" };
    return `<span class="status-badge ${s.cls}">${s.label}</span>`;
  }

  // --- Load meta and content in parallel ---
  try {
    const [metaRes, contentRes] = await Promise.all([
      fetch(`/data/projects/${projectId}/meta.json`),
      fetch(`/data/projects/${projectId}/content.md`),
    ]);

    if (!metaRes.ok) throw new Error(`Project "${projectId}" not found (meta ${metaRes.status})`);

    const meta = await metaRes.json();
    const markdownText = contentRes.ok ? await contentRes.text() : "_Content coming soon._";

    // --- Page title ---
    document.title = `${meta.title} — Murray S. Bennett`;

    // --- Heading + status ---
    titleEl.textContent = meta.title;
    if (statusEl && meta.status) {
      statusEl.innerHTML = renderStatusBadge(meta.status);
    }

    // --- Thumbnail ---
    if (thumbnailEl) {
      if (meta.thumbnail) {
        thumbnailEl.src = meta.thumbnail;
        thumbnailEl.alt = meta.thumbnail_alt || meta.title;
        thumbnailEl.style.display = "block";
      } else {
        thumbnailEl.style.display = "none";
      }
    }

    // --- Summary ---
    if (summaryEl) summaryEl.textContent = meta.summary;

    // --- Tags ---
    if (tagsEl && meta.tags && meta.tags.length > 0) {
      tagsEl.innerHTML = meta.tags
        .map((t) => `<span class="tag">${t}</span>`)
        .join("");
      tagsEl.style.display = "flex";
    } else if (tagsEl) {
      tagsEl.style.display = "none";
    }

    // --- Main Markdown content ---
    if (contentEl) {
      if (typeof marked !== "undefined") {
        contentEl.innerHTML = marked.parse(markdownText);
      } else {
        // Fallback: wrap in <pre> if marked didn't load
        contentEl.innerHTML = `<pre style="white-space:pre-wrap">${markdownText}</pre>`;
        console.warn("marked.js not loaded — rendering raw Markdown.");
      }
      // Apply styling to any images rendered from Markdown
      contentEl.querySelectorAll("img").forEach((img) => {
        img.style.maxWidth = "100%";
        img.style.height = "auto";
        img.style.display = "block";
        img.style.margin = "1.5rem auto";
        img.style.borderRadius = "8px";
        img.style.boxShadow = "0 2px 8px rgba(0,0,0,0.12)";
      });
    }

    // --- Links ---
    if (linksContainerEl) {
      const links = meta.links || {};
      let hasLinks = false;

      const linkDefs = [
        { id: "link-osf", key: "osf", label: "OSF Project", icon: "fas fa-external-link-alt", external: true },
        { id: "link-experiment-demo", key: "experiment_demo", label: "Experiment Demo", icon: "fas fa-flask", external: false },
        { id: "link-interactive-demo", key: "interactive_demo", label: "Interactive Demo", icon: "fas fa-chart-bar", external: false },
        { id: "link-publication", key: "publication", label: "Read the Paper", icon: "fas fa-file-alt", external: true },
      ];

      linkDefs.forEach(({ id, key, label, icon, external }) => {
        const el = document.getElementById(id);
        if (!el) return;
        if (links[key]) {
          el.href = links[key];
          el.style.display = "inline-flex";
          if (external) el.target = "_blank";
          hasLinks = true;
        } else {
          el.style.display = "none";
        }
      });

      linksContainerEl.style.display = hasLinks ? "block" : "none";
    }

    // --- Related Publications ---
    if (publicationsEl && meta.publications && meta.publications.length > 0) {
      try {
        const pubRes = await fetch("/data/publications.json");
        if (pubRes.ok) {
          const allPubs = await pubRes.json();
          const allEntries = [
            ...(allPubs.journal || []),
            ...(allPubs.conference || []),
            ...(allPubs.in_preparation || []),
          ];
          const relatedPubs = allEntries.filter((p) =>
            meta.publications.includes(p.id)
          );

          if (relatedPubs.length > 0) {
            publicationsEl.style.display = "block";
            const list = publicationsEl.querySelector(".pub-list");
            if (list) {
              list.innerHTML = relatedPubs
                .map((p) => {
                  const doiLink = p.doi
                    ? ` <a href="https://doi.org/${p.doi}" target="_blank" class="doi-link">DOI</a>`
                    : "";
                  const venue = p.journal
                    ? `<em>${p.journal}</em>`
                    : p.venue
                    ? `<em>${p.venue}</em>`
                    : p.status
                    ? `<em>${p.status}</em>`
                    : "";
                  return `<li class="pub-entry">
                    ${p.authors} (<strong>${p.year}</strong>). ${p.title}. ${venue}.${doiLink}
                  </li>`;
                })
                .join("");
            }
          } else {
            publicationsEl.style.display = "none";
          }
        }
      } catch (pubErr) {
        console.warn("Could not load publications:", pubErr);
        publicationsEl.style.display = "none";
      }
    } else if (publicationsEl) {
      publicationsEl.style.display = "none";
    }

  } catch (err) {
    console.error("Error loading project:", err);
    showError("There was an error loading this project. Please try again later.");
  }
});
