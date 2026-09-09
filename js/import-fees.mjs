/* =========================================================
   IMPORT SCHOOL FEES

   Free, regex-based fee scraper. No paid API calls - this
   fetches each school's own website and looks for a dollar
   amount sitting near a fee-related keyword in the raw page
   text.

   WHAT COUNTS AS "HIGH CONFIDENCE" (written straight to Supabase):
   - Exactly one dollar amount on the page sits near a STRONG
     keyword ("tuition fee", "annual fee", "school fees", etc.)
   - That amount falls inside a sane range for a yearly school fee.

   EVERYTHING ELSE gets written to fees-review.csv instead of
   the database:
   - Multiple candidate dollar amounts (ambiguous - which one is
     actually the fee?).
   - A dollar amount near only a WEAK keyword ("fee" on its own,
     could be an enrolment deposit, uniform fee, excursion fee...).
   - A fetch that failed, timed out, or returned no matches at
     all is just skipped - nothing to review there, the school's
     fee field is simply left null, same as before.
   ========================================================= */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_SCHOOLS = Number(process.env.MAX_SCHOOLS || 2162);
const CONCURRENCY = 5;
const FETCH_TIMEOUT_MS = 10000;

const STRONG_KEYWORDS = [
    "tuition fee",
    "tuition fees",
    "annual fee",
    "annual fees",
    "fees per annum",
    "school fees",
    "course fee",
    "per annum fee"
];

const WEAK_KEYWORDS = ["fee", "fees"];

const MIN_SANE_FEE = 200;
const MAX_SANE_FEE = 60000;

function normaliseWebsite(url) {
    let normalised = String(url).trim();
    if (!normalised.startsWith("http://") && !normalised.startsWith("https://")) {
        normalised = `https://${normalised}`;
    }
    return normalised;
}

function stripHtml(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ");
}

function findFeeCandidates(text) {
    const candidates = [];
    const currencyRegex = /\$\s?([\d,]+(?:\.\d{1,2})?)/g;
    let match;
    // Tracks where the previous dollar match ended, so a keyword sitting
    // near an earlier dollar amount can't "leak" forward and get credited
    // to a later, unrelated number (e.g. a founding year mentioned shortly
    // after the real fee).
    let previousMatchEnd = 0;

    while ((match = currencyRegex.exec(text)) !== null) {

        const raw = match[1].replace(/,/g, "");
        const value = Number(raw);

        if (!Number.isFinite(value)) {
            previousMatchEnd = match.index + match[0].length;
            continue;
        }

        const windowStart = Math.max(0, match.index - 60, previousMatchEnd);
        const window = text.slice(windowStart, match.index).toLowerCase();

        const hasStrongKeyword = STRONG_KEYWORDS.some(keyword => window.includes(keyword));
        const hasWeakKeyword = WEAK_KEYWORDS.some(keyword => window.includes(keyword));

        candidates.push({
            value,
            strong: hasStrongKeyword,
            weak: hasWeakKeyword && !hasStrongKeyword
        });

        previousMatchEnd = match.index + match[0].length;

    }

    return candidates;

}

function classify(candidates) {
    const inRange = candidate => candidate.value >= MIN_SANE_FEE && candidate.value <= MAX_SANE_FEE;
    const strongInRange = candidates.filter(candidate => candidate.strong && inRange(candidate));
    const anyInRange = candidates.filter(candidate => (candidate.strong || candidate.weak) && inRange(candidate));
    if (strongInRange.length === 1) {
        return { status: "high", value: strongInRange[0].value };
    }
    if (anyInRange.length >= 1) {
        return { status: "low", candidates: anyInRange.map(candidate => candidate.value) };
    }
    return { status: "none" };
}

async function fetchWithTimeout(url, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { signal: controller.signal, redirect: "follow" });
    } finally {
        clearTimeout(timeout);
    }
}

async function processSchool(school) {
    const url = normaliseWebsite(school.website);
    try {
        const response = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
        if (!response.ok) {
            return { school, status: "fetch_failed", detail: `HTTP ${response.status}` };
        }
        const html = await response.text();
        const text = stripHtml(html);
        const candidates = findFeeCandidates(text);
        const result = classify(candidates);
        return { school, ...result };
    } catch (error) {
        return { school, status: "fetch_failed", detail: String(error.message || error) };
    }
}

async function runPool(items, worker, concurrency) {
    const results = [];
    let index = 0;
    async function next() {
        while (index < items.length) {
            const current = index++;
            results[current] = await worker(items[current]);
        }
    }
    await Promise.all(Array.from({ length: concurrency }, next));
    return results;
}

async function fetchSchoolsNeedingFees() {
    // sector can be null in the data, and `sector=neq.Public` alone would
    // silently exclude those rows forever (NULL never satisfies neq in
    // Postgres/PostgREST). The or() filter explicitly keeps null-sector
    // schools in the results too.
    const url = `${SUPABASE_URL}/rest/v1/Schools?select=school_id,name,website,sector&fee=is.null&website=not.is.null&or=(sector.neq.Public,sector.is.null)&limit=${MAX_SCHOOLS}`;
    const response = await fetch(url, {
        headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`
        }
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch schools: ${response.status} ${await response.text()}`);
    }
    return response.json();
}

async function writeFee(schoolId, fee) {
    const url = `${SUPABASE_URL}/rest/v1/Schools?school_id=eq.${schoolId}`;
    const response = await fetch(url, {
        method: "PATCH",
        headers: {
            apikey: SERVICE_ROLE_KEY,
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal"
        },
        body: JSON.stringify({ fee })
    });
    if (!response.ok) {
        throw new Error(`Failed to update school ${schoolId}: ${response.status} ${await response.text()}`);
    }
}

function toCsvRow(fields) {
    return fields.map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
}

async function main() {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
        process.exit(1);
    }
    console.log("Fetching schools that need fee data (non-public, has a website, fee currently null)...");
    const schools = await fetchSchoolsNeedingFees();
    console.log(`Found ${schools.length} schools to check.`);
    const results = await runPool(schools, processSchool, CONCURRENCY);
    let updated = 0;
    let flagged = 0;
    let skippedNoMatch = 0;
    let fetchFailed = 0;
    const reviewRows = [toCsvRow(["school_id", "name", "website", "candidate_fees"])];
    for (const result of results) {
        const { school } = result;
        if (result.status === "high") {
            await writeFee(school.school_id, result.value);
            updated++;
            continue;
        }
        if (result.status === "low") {
            reviewRows.push(toCsvRow([
                school.school_id,
                school.name || "",
                school.website || "",
                result.candidates.join(" | ")
            ]));
            flagged++;
            continue;
        }
        if (result.status === "fetch_failed") {
            fetchFailed++;
            continue;
        }
        skippedNoMatch++;
    }
    console.log("==========================================");
    console.log(`Updated directly in Supabase (high confidence): ${updated}`);
    console.log(`Flagged for manual review: ${flagged}`);
    console.log(`No fee-like text found on the page: ${skippedNoMatch}`);
    console.log(`Website fetch failed or timed out: ${fetchFailed}`);
    console.log("==========================================");
    const fs = await import("node:fs/promises");
    await fs.writeFile("fees-review.csv", reviewRows.join("\n"), "utf8");
    console.log("Wrote fees-review.csv - check the workflow's uploaded artifact.");
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
