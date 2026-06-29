/**
 * cv.js
 * Populates the CV page with publications from /data/publications.json,
 * enriched with live ORCID data where available.
 *
 * Requires: /js/orcid-sync.js (ES module)
 * Include in cv.html as:  <script type="module" src="/js/cv.js"></script>
 */

import { loadPublications } from "/js/orcid-sync.js";

// ── Render helpers ─────────────────────────────────────────────────────────

/**
 * Format a single publication entry as an <li> string.
 * Handles journal articles, under-review, and conference proceedings.
 */
function renderPubEntry(pub, type = "journal") {
  const yearStr = pub.status === "in-press"
    ? "<strong>In Press</strong>"
    : pub.year
    ? `<strong>${pub.year}</strong>`
    : "";

  // Build the venue string
  let venue = "";
  if (type === "journal") {
    venue = `<em>${pub.journal || ""}</em>`;
    if (pub.volume) venue += `, ${pub.volume}`;
    if (pub.issue) venue += `(${pub.issue})`;
    if (pub.pages) venue += `, ${pub.pages}`;
  } else if (type === "conference") {
    venue = `<em>${pub.venue || ""}</em>`;
    if (pub.volume) venue += `, ${pub.volume}`;
  } else if (type === "under_review") {
    venue = pub.status === "under-review"
      ? "<em>Under Review</em>"
      : `<em>${pub.status || "In Preparation"}</em>`;
  }

  // DOI or OSF link
  let links = "";
  if (pub.doi) {
    links += ` <a href="https://doi.org/${pub.doi}" target="_blank" class="doi-link">DOI</a>`;
  } else if (pub.url) {
    links += ` <a href="${pub.url}" target="_blank" class="doi-link">Link</a>`;
  } else if (pub.osf) {
    links += ` <a href="${pub.osf}" target="_blank" class="doi-link">Preprint</a>`;
  }

  // ORCID enrichment indicator (subtle, useful for debugging)
  const orcidTag = pub._orcid_matched
    ? `<span class="orcid-synced" title="Enriched from ORCID"><i class="fab fa-orcid"></i></span>`
    : "";

  return `<li class="pub-entry">
    ${pub.authors} (${yearStr}). ${pub.title}. ${venue}.${links} ${orcidTag}
  </li>`;
}

function renderSection(entries, type) {
  if (!entries || entries.length === 0) return "<p><em>None to display.</em></p>";
  return `<ul class="pub-list">${entries.map((p) => renderPubEntry(p, type)).join("")}</ul>`;
}

// ── ORCID-only notice ────────────────────────────────────────────────────────

function renderOrcidOnlyNotice(orcidOnly) {
  if (!orcidOnly || orcidOnly.length === 0) return "";
  return `
    <div class="orcid-only-notice">
      <p><i class="fab fa-orcid"></i> <strong>${orcidOnly.length} work(s) found in your ORCID record</strong> that aren't in <code>publications.json</code> yet:</p>
      <ul>${orcidOnly.map((w) => `<li>${w.title} (${w.year || "n.d."})</li>`).join("")}</ul>
      <p>Add them to <code>/data/publications.json</code> to include them on this page.</p>
    </div>
  `;
}

// ── Main ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  const journalEl = document.getElementById("cv-journal-pubs");
  const underReviewEl = document.getElementById("cv-under-review-pubs");
  const conferenceEl = document.getElementById("cv-conference-pubs");
  const pubsLoadingEl = document.getElementById("pubs-loading");
  const orcidNoticeEl = document.getElementById("orcid-only-notice");

  // Show loading state
  if (pubsLoadingEl) pubsLoadingEl.style.display = "block";

  const pubs = await loadPublications();

  // Hide loading state
  if (pubsLoadingEl) pubsLoadingEl.style.display = "none";

  // Render each section
  if (journalEl) {
    journalEl.innerHTML = renderSection(pubs.journal, "journal");
  }
  if (underReviewEl) {
    underReviewEl.innerHTML = renderSection(pubs.under_review, "under_review");
  }
  if (conferenceEl) {
    conferenceEl.innerHTML = renderSection(pubs.conference, "conference");
  }

  // ORCID error notice
  if (pubs._orcid_error) {
    console.warn("CV: ORCID sync failed, showing local publications only.");
  }

  // ORCID-only notice (only shown to you — hidden from visitors via CSS, visible in dev)
  if (orcidNoticeEl) {
    orcidNoticeEl.innerHTML = renderOrcidOnlyNotice(pubs._orcid_only);
    if (pubs._orcid_only?.length > 0) orcidNoticeEl.style.display = "block";
  }
});
