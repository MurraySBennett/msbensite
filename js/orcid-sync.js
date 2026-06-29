/**
 * orcid-sync.js
 *
 * Fetches your public works from the ORCID public API and merges them
 * with /data/publications.json. Called by cv.js and anywhere else that
 * renders a publications list.
 *
 * HOW IT WORKS
 * ─────────────
 * 1. Fetch /data/publications.json  (your curated local list — source of truth
 *    for things like project links, related_projects, and any entry you've
 *    manually overridden).
 * 2. Fetch https://pub.orcid.org/v3.0/{ORCID_ID}/works  (no API key needed).
 * 3. Merge: ORCID entries that match a local entry by title (fuzzy) or DOI are
 *    enriched with the ORCID DOI / external URL.  Entries only in ORCID and not
 *    in your local file are added to a "from ORCID" list and returned separately
 *    so you can decide whether to add them to publications.json.
 * 4. Returns a merged publications object in the same shape as publications.json.
 *
 * USAGE
 * ─────
 * import { loadPublications } from '/js/orcid-sync.js';
 *
 * const pubs = await loadPublications();
 * // pubs.journal, pubs.under_review, pubs.conference — same structure as JSON
 * // pubs._orcid_only — works found in ORCID but not matched to local entries
 * // pubs._orcid_error — true if the ORCID fetch failed (graceful degradation)
 *
 * ORCID ID
 * ────────
 * Set your ORCID iD once here. No API key or token is needed — the public
 * endpoint (pub.orcid.org) returns all public works without authentication.
 */

const ORCID_ID = "0000-0001-7309-4915";
const ORCID_API = `https://pub.orcid.org/v3.0/${ORCID_ID}/works`;
const LOCAL_PUBS_PATH = "/data/publications.json";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise a title for fuzzy matching: lowercase, strip punctuation, collapse spaces */
function normaliseTitle(title = "") {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract a DOI string from an ORCID work's external-ids array */
function extractDoi(externalIds) {
  if (!externalIds?.["external-id"]) return null;
  const doiEntry = externalIds["external-id"].find(
    (e) => e["external-id-type"] === "doi"
  );
  return doiEntry?.["external-id-normalized"]?.value || doiEntry?.["external-id-value"] || null;
}

/** Parse an ORCID work summary into a normalised object */
function parseOrcidWork(workSummary) {
  const titleValue =
    workSummary?.title?.title?.value || "";
  const year =
    workSummary?.["publication-date"]?.year?.value || null;
  const doi = extractDoi(workSummary?.["external-ids"]);
  const journal =
    workSummary?.["journal-title"]?.value || "";
  const type = workSummary?.type || "";
  const url =
    workSummary?.url?.value || (doi ? `https://doi.org/${doi}` : "");

  return {
    _orcid_put_code: workSummary?.["put-code"],
    title: titleValue,
    _title_normalised: normaliseTitle(titleValue),
    year: year ? parseInt(year, 10) : null,
    doi,
    journal,
    type,
    url,
  };
}

// ── Core merge logic ──────────────────────────────────────────────────────────

/**
 * Given a local publication entry and a list of parsed ORCID works,
 * find the best matching ORCID work and enrich the local entry with its DOI/URL.
 * Returns the (possibly enriched) local entry.
 */
function enrichFromOrcid(localEntry, orcidWorks, matchedPutCodes) {
  const localNorm = normaliseTitle(localEntry.title);
  const localDoi = (localEntry.doi || "").toLowerCase().trim();

  // Try DOI match first (exact), then title match (normalised substring)
  const match = orcidWorks.find((w) => {
    if (matchedPutCodes.has(w._orcid_put_code)) return false;
    if (localDoi && w.doi && localDoi === w.doi.toLowerCase()) return true;
    if (localNorm && w._title_normalised) {
      // Accept if one title contains the other (handles subtitle truncation)
      return (
        w._title_normalised.includes(localNorm) ||
        localNorm.includes(w._title_normalised)
      );
    }
    return false;
  });

  if (!match) return localEntry;

  matchedPutCodes.add(match._orcid_put_code);

  return {
    ...localEntry,
    doi: localEntry.doi || match.doi || "",
    url: localEntry.url || match.url || "",
    _orcid_matched: true,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Load publications, merging local JSON with live ORCID data.
 *
 * @param {object} options
 * @param {boolean} options.orcidEnabled  - set false to skip ORCID fetch (useful for local dev without network)
 * @returns {Promise<object>}  merged publications object
 */
export async function loadPublications({ orcidEnabled = true } = {}) {
  // 1. Always load local file first — it's the fallback if ORCID fails
  let local;
  try {
    const res = await fetch(LOCAL_PUBS_PATH);
    if (!res.ok) throw new Error(`publications.json fetch failed: ${res.status}`);
    local = await res.json();
  } catch (err) {
    console.error("Could not load local publications.json:", err);
    return { journal: [], under_review: [], conference: [], _error: true };
  }

  if (!orcidEnabled) return local;

  // 2. Fetch ORCID works (fail gracefully — site still works without it)
  let orcidWorks = [];
  let orcidError = false;
  try {
    const res = await fetch(ORCID_API, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`ORCID API ${res.status}`);
    const data = await res.json();

    // ORCID /works returns a "group" array; each group has work-summary arrays
    const groups = data?.group || [];
    orcidWorks = groups.flatMap((g) =>
      (g?.["work-summary"] || []).map(parseOrcidWork)
    );
  } catch (err) {
    console.warn("ORCID fetch failed — using local publications only:", err.message);
    orcidError = true;
  }

  if (orcidError || orcidWorks.length === 0) {
    return { ...local, _orcid_error: orcidError };
  }

  // 3. Enrich local entries and track which ORCID works were matched
  const matchedPutCodes = new Set();

  const enrichSection = (entries) =>
    (entries || []).map((e) => enrichFromOrcid(e, orcidWorks, matchedPutCodes));

  const merged = {
    ...local,
    journal: enrichSection(local.journal),
    under_review: enrichSection(local.under_review),
    conference: enrichSection(local.conference),
  };

  // 4. Surface ORCID-only works (not matched to anything local)
  const orcidOnly = orcidWorks.filter(
    (w) => !matchedPutCodes.has(w._orcid_put_code)
  );
  if (orcidOnly.length > 0) {
    merged._orcid_only = orcidOnly;
    console.info(
      `[orcid-sync] ${orcidOnly.length} ORCID work(s) not matched to local publications.json:`,
      orcidOnly.map((w) => w.title)
    );
  }

  return merged;
}
