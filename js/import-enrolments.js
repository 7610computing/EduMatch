/*
=========================================================
EDUMATCH - IMPORT VICTORIAN SCHOOL ENROLMENTS
=========================================================

Source:
Victorian Government
All Schools FTE Enrolments - February 2025

CSV:
csv/dv403-AllSchoolsEnrolments-2025.csv

Matches:
CSV School_No
        ↓
Schools.government_school_no

Updates:
Schools.enrolment

Only existing schools are updated.
No new schools are created by this script.
=========================================================
*/

const fs = require("fs");
const path = require("path");

const { createClient } = require("@supabase/supabase-js");
const { parse } = require("csv-parse/sync");

// =========================================================
// CONFIGURATION
// =========================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const CSV_PATH = path.join(
    process.cwd(),
    "csv",
    "dv403-AllSchoolsEnrolments-2025.csv"
);

const SUPABASE_BATCH_SIZE = 500;
const SUPABASE_PAGE_SIZE = 1000;

// =========================================================
// VALIDATION
// =========================================================

if (!SUPABASE_URL) {
    throw new Error("SUPABASE_URL environment variable is missing.");
}

if (!SUPABASE_KEY) {
    throw new Error("SUPABASE_KEY environment variable is missing.");
}

if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV file not found: ${CSV_PATH}`);
}

// =========================================================
// SUPABASE CLIENT
// =========================================================

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// =========================================================
// READ CSV
// =========================================================

function readCsv() {
    console.log("Reading enrolment CSV...");

    const csvText = fs.readFileSync(CSV_PATH, "utf8");

    const rows = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        bom: true,
        relax_column_count: true,
        trim: true
    });

    console.log(`CSV rows found: ${rows.length}`);

    return rows;
}

// =========================================================
// NORMALISE SCHOOL NUMBER
// =========================================================

function normaliseSchoolNumber(value) {
    if (value === null || value === undefined) {
        return null;
    }

    const number = String(value).trim();

    if (!number) {
        return null;
    }

    return number;
}

// =========================================================
// NORMALISE ENROLMENT
// =========================================================

function parseEnrolment(value) {
    if (value === null || value === undefined) {
        return null;
    }

    const text = String(value)
        .trim()
        .replace(/,/g, "");

    if (!text) {
        return null;
    }

    const number = Number(text);

    if (!Number.isFinite(number)) {
        return null;
    }

    if (number < 0) {
        return null;
    }

    return number;
}

// =========================================================
// PROCESS CSV DATA
// =========================================================

function processRows(rows) {
    console.log("Processing enrolment data...");

    const enrolments = new Map();

    let skippedInvalidSchoolNumber = 0;
    let skippedInvalidEnrolment = 0;
    let skippedWrongYear = 0;

    for (const row of rows) {

        // -------------------------------------------------
        // Only use 2025 records
        // -------------------------------------------------

        const year = String(row["Year"] || "").trim();

        if (year && year !== "2025") {
            skippedWrongYear++;
            continue;
        }

        // -------------------------------------------------
        // School number
        // -------------------------------------------------

        const schoolNumber = normaliseSchoolNumber(
            row["School_No"]
        );

        if (!schoolNumber) {
            skippedInvalidSchoolNumber++;
            continue;
        }

        // -------------------------------------------------
        // Grand Total
        // -------------------------------------------------

        const enrolment = parseEnrolment(
            row["Grand Total"]
        );

        if (enrolment === null) {
            skippedInvalidEnrolment++;
            continue;
        }

        // -------------------------------------------------
        // Handle duplicate School_No values safely
        // -------------------------------------------------

        if (enrolments.has(schoolNumber)) {

            const existing = enrolments.get(schoolNumber);

            // If the duplicate has the same value,
            // it is harmless and can be ignored.
            if (existing.enrolment === enrolment) {
                continue;
            }

            throw new Error(
                `Conflicting enrolment values found for School_No ${schoolNumber}: ` +
                `${existing.enrolment} and ${enrolment}`
            );
        }

        enrolments.set(schoolNumber, {
            government_school_no: schoolNumber,
            enrolment: enrolment
        });
    }

    console.log(
        `Valid enrolment records: ${enrolments.size}`
    );

    console.log(
        `Skipped invalid school numbers: ${skippedInvalidSchoolNumber}`
    );

    console.log(
        `Skipped invalid enrolments: ${skippedInvalidEnrolment}`
    );

    console.log(
        `Skipped non-2025 rows: ${skippedWrongYear}`
    );

    return Array.from(enrolments.values());
}

// =========================================================
// GET EXISTING SCHOOLS
// =========================================================

async function getExistingSchools() {

    console.log("Getting existing schools from Supabase...");

    const existingSchools = new Set();

    let offset = 0;

    while (true) {

        const {
            data,
            error
        } = await supabase
            .from("Schools")
            .select("government_school_no")
            .range(
                offset,
                offset + SUPABASE_PAGE_SIZE - 1
            );

        if (error) {
            throw new Error(
                `Failed to get existing schools: ${error.message}`
            );
        }

        if (!data || data.length === 0) {
            break;
        }

        for (const school of data) {

            const schoolNumber = normaliseSchoolNumber(
                school.government_school_no
            );

            if (schoolNumber) {
                existingSchools.add(schoolNumber);
            }
        }

        console.log(
            `Loaded ${existingSchools.size} existing schools...`
        );

        if (data.length < SUPABASE_PAGE_SIZE) {
            break;
        }

        offset += SUPABASE_PAGE_SIZE;
    }

    console.log(
        `Existing schools found: ${existingSchools.size}`
    );

    return existingSchools;
}

// =========================================================
// FILTER TO EXISTING SCHOOLS
// =========================================================

function matchExistingSchools(
    enrolments,
    existingSchools
) {

    const updates = [];
    const missingSchools = [];

    for (const enrolment of enrolments) {

        if (
            existingSchools.has(
                enrolment.government_school_no
            )
        ) {
            updates.push(enrolment);
        } else {
            missingSchools.push(
                enrolment.government_school_no
            );
        }
    }

    console.log(
        `Schools matched: ${updates.length}`
    );

    console.log(
        `Schools missing from Supabase: ${missingSchools.length}`
    );

    if (missingSchools.length > 0) {

        console.log(
            "First missing school numbers:"
        );

        console.log(
            missingSchools.slice(0, 20).join(", ")
        );
    }

    return updates;
}

// =========================================================
// UPDATE SUPABASE
// =========================================================

async function updateEnrolments(updates) {

    console.log("Updating Supabase enrolments...");

    let updated = 0;

    for (
        let i = 0;
        i < updates.length;
        i += SUPABASE_BATCH_SIZE
    ) {

        const batch = updates.slice(
            i,
            i + SUPABASE_BATCH_SIZE
        );

        const {
            error
        } = await supabase
            .from("Schools")
            .upsert(
                batch,
                {
                    onConflict: "government_school_no"
                }
            );

        if (error) {
            throw new Error(
                `Failed to update enrolments: ${error.message}`
            );
        }

        updated += batch.length;

        console.log(
            `Updated ${updated}/${updates.length} schools...`
        );
    }

    console.log(
        `Finished updating ${updated} schools.`
    );
}

// =========================================================
// MAIN
// =========================================================

async function main() {

    console.log("");
    console.log("==============================================");
    console.log("EduMatch - Victorian School Enrolment Import");
    console.log("==============================================");
    console.log("");

    // Read CSV
    const rows = readCsv();

    // Process CSV
    const enrolments = processRows(rows);

    // Get schools already in Supabase
    const existingSchools = await getExistingSchools();

    // Match CSV schools to Supabase schools
    const updates = matchExistingSchools(
        enrolments,
        existingSchools
    );

    if (updates.length === 0) {
        throw new Error(
            "No enrolment records matched existing schools."
        );
    }

    // Update enrolments
    await updateEnrolments(updates);

    console.log("");
    console.log("==============================================");
    console.log("Enrolment import completed successfully.");
    console.log("==============================================");
    console.log("");
}

// =========================================================
// RUN
// =========================================================

main().catch((error) => {

    console.error("");
    console.error("==============================================");
    console.error("ENROLMENT IMPORT FAILED");
    console.error("==============================================");
    console.error("");
    console.error(error.message);
    console.error("");

    process.exit(1);
});
