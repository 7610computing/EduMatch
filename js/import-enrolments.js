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
No new schools are created.
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

const SUPABASE_PAGE_SIZE = 1000;
const SUPABASE_BATCH_SIZE = 500;

// =========================================================
// VALIDATION
// =========================================================

if (!SUPABASE_URL) {
    throw new Error(
        "SUPABASE_URL environment variable is missing."
    );
}

if (!SUPABASE_KEY) {
    throw new Error(
        "SUPABASE_KEY environment variable is missing."
    );
}

if (!fs.existsSync(CSV_PATH)) {
    throw new Error(
        `CSV file not found: ${CSV_PATH}`
    );
}

// =========================================================
// SUPABASE CLIENT
// =========================================================

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// =========================================================
// NORMALISE CSV HEADER
// =========================================================

function normaliseHeader(header) {

    if (
        header === null ||
        header === undefined
    ) {
        return header;
    }

    return String(header)
        .trim()
        .replace(/^"|"$/g, "");
}

// =========================================================
// NORMALISE SCHOOL NUMBER
// =========================================================

function normaliseSchoolNumber(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    const text = String(value).trim();

    if (!text) {
        return null;
    }

    /*
    Handles values such as:

        1527
        1527.0

    Both become:

        1527
    */

    if (/^\d+\.0+$/.test(text)) {
        return text.split(".")[0];
    }

    return text;
}

// =========================================================
// PARSE ENROLMENT
// =========================================================

function parseEnrolment(value) {

    if (
        value === null ||
        value === undefined
    ) {
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
// READ CSV
// =========================================================

function readCsv() {

    console.log("Reading enrolment CSV...");
    console.log(`File: ${CSV_PATH}`);
    console.log("");

    const csvText = fs.readFileSync(
        CSV_PATH,
        "utf8"
    );

    const rows = parse(csvText, {

        /*
        The source CSV has some headers which may appear
        with quotation marks, for example:

            "Grand Total"

        Remove those quotation marks so the resulting
        property is simply:

            Grand Total
        */

        columns: headers =>
            headers.map(normaliseHeader),

        skip_empty_lines: true,

        bom: true,

        relax_column_count: true,

        trim: true
    });

    console.log(
        `CSV rows found: ${rows.length}`
    );

    console.log("");

    if (rows.length === 0) {
        throw new Error(
            "The CSV contains no rows."
        );
    }

    // -----------------------------------------------------
    // Check required columns
    // -----------------------------------------------------

    const columns = Object.keys(rows[0]);

    const requiredColumns = [
        "School_No",
        "Grand Total",
        "Year"
    ];

    for (const column of requiredColumns) {

        if (!columns.includes(column)) {

            throw new Error(
                `Required CSV column "${column}" was not found.`
            );
        }
    }

    console.log(
        "Required CSV columns found successfully."
    );

    console.log("");

    return rows;
}

// =========================================================
// PROCESS CSV
// =========================================================

function processRows(rows) {

    console.log(
        "Processing enrolment records..."
    );

    console.log("");

    const enrolments = new Map();

    let invalidSchoolNumbers = 0;
    let invalidEnrolments = 0;
    let wrongYear = 0;

    for (const row of rows) {

        // -------------------------------------------------
        // SCHOOL NUMBER
        // -------------------------------------------------

        const schoolNumber =
            normaliseSchoolNumber(
                row["School_No"]
            );

        if (!schoolNumber) {

            invalidSchoolNumbers++;

            continue;
        }

        // -------------------------------------------------
        // YEAR
        // -------------------------------------------------

        const year =
            String(
                row["Year"] || ""
            ).trim();

        if (
            year &&
            year !== "2025"
        ) {

            wrongYear++;

            continue;
        }

        // -------------------------------------------------
        // GRAND TOTAL
        // -------------------------------------------------

        const enrolment =
            parseEnrolment(
                row["Grand Total"]
            );

        if (enrolment === null) {

            invalidEnrolments++;

            continue;
        }

        /*
        IMPORTANT:

        We use Grand Total only.

        For example, this row:

            Year 3 Total   = 15
            Primary Total  = 161.4
            Grand Total    = 161.4

        means the school's total enrolment is 161.4.

        We must NOT accidentally use the 15 from
        "Year 3 Total".
        */

        enrolments.set(
            schoolNumber,
            {
                government_school_no:
                    schoolNumber,

                enrolment:
                    enrolment
            }
        );
    }

    console.log(
        `Valid enrolment records: ${enrolments.size}`
    );

    console.log(
        `Invalid school numbers: ${invalidSchoolNumbers}`
    );

    console.log(
        `Invalid enrolments: ${invalidEnrolments}`
    );

    console.log(
        `Wrong-year records: ${wrongYear}`
    );

    console.log("");

    // -----------------------------------------------------
    // Show examples
    // -----------------------------------------------------

    console.log(
        "Example processed records:"
    );

    console.log(
        JSON.stringify(
            Array.from(
                enrolments.values()
            ).slice(0, 10),
            null,
            2
        )
    );

    console.log("");

    return Array.from(
        enrolments.values()
    );
}

// =========================================================
// GET EXISTING SCHOOLS
// =========================================================

async function getExistingSchools() {

    console.log(
        "Getting existing schools from Supabase..."
    );

    console.log("");

    const existingSchools = new Set();

    let offset = 0;

    while (true) {

        const {
            data,
            error
        } = await supabase
            .from("Schools")
            .select(
                "government_school_no"
            )
            .range(
                offset,
                offset +
                    SUPABASE_PAGE_SIZE -
                    1
            );

        if (error) {

            throw new Error(
                `Failed to read Schools: ${error.message}`
            );
        }

        if (
            !data ||
            data.length === 0
        ) {
            break;
        }

        for (const school of data) {

            const schoolNumber =
                normaliseSchoolNumber(
                    school.government_school_no
                );

            if (schoolNumber) {

                existingSchools.add(
                    schoolNumber
                );
            }
        }

        console.log(
            `Loaded ${existingSchools.size} school numbers...`
        );

        if (
            data.length <
            SUPABASE_PAGE_SIZE
        ) {
            break;
        }

        offset += SUPABASE_PAGE_SIZE;
    }

    console.log("");

    console.log(
        `Total schools in Supabase: ${existingSchools.size}`
    );

    console.log("");

    return existingSchools;
}

// =========================================================
// MATCH CSV SCHOOLS TO SUPABASE SCHOOLS
// =========================================================

function matchSchools(
    enrolments,
    existingSchools
) {

    console.log(
        "Matching enrolments to existing schools..."
    );

    console.log("");

    const updates = [];
    const missingSchools = [];

    for (const record of enrolments) {

        const schoolNumber =
            record.government_school_no;

        if (
            existingSchools.has(
                schoolNumber
            )
        ) {

            updates.push(record);

        } else {

            missingSchools.push(
                schoolNumber
            );
        }
    }

    console.log(
        `Schools matched: ${updates.length}`
    );

    console.log(
        `Schools missing from Supabase: ${missingSchools.length}`
    );

    console.log("");

    if (
        missingSchools.length > 0
    ) {

        console.log(
            "First missing school numbers:"
        );

        console.log(
            missingSchools
                .slice(0, 20)
                .join(", ")
        );

        console.log("");
    }

    return updates;
}

// =========================================================
// UPDATE SUPABASE
// =========================================================

async function updateEnrolments(updates) {

    console.log(
        "Updating enrolments in Supabase..."
    );

    console.log("");

    let updated = 0;

    for (
        let i = 0;
        i < updates.length;
        i += SUPABASE_BATCH_SIZE
    ) {

        const batch =
            updates.slice(
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
                    onConflict:
                        "government_school_no"
                }
            );

        if (error) {

            throw new Error(
                `Supabase update failed: ${error.message}`
            );
        }

        updated += batch.length;

        console.log(
            `Updated ${updated}/${updates.length} schools...`
        );
    }

    console.log("");

    console.log(
        `Successfully updated ${updated} schools.`
    );
}

// =========================================================
// MAIN
// =========================================================

async function main() {

    console.log("");
    console.log(
        "=============================================="
    );
    console.log(
        "EduMatch - Victorian School Enrolment Import"
    );
    console.log(
        "=============================================="
    );
    console.log("");

    // -----------------------------------------------------
    // STEP 1: Read CSV
    // -----------------------------------------------------

    const rows = readCsv();

    // -----------------------------------------------------
    // STEP 2: Process CSV
    // -----------------------------------------------------

    const enrolments =
        processRows(rows);

    if (
        enrolments.length === 0
    ) {

        throw new Error(
            "The CSV was read successfully, but no valid enrolment records were produced."
        );
    }

    // -----------------------------------------------------
    // STEP 3: Get schools from Supabase
    // -----------------------------------------------------

    const existingSchools =
        await getExistingSchools();

    if (
        existingSchools.size === 0
    ) {

        throw new Error(
            "Supabase contains no schools. Run the Victorian school import first."
        );
    }

    // -----------------------------------------------------
    // STEP 4: Match schools
    // -----------------------------------------------------

    const updates =
        matchSchools(
            enrolments,
            existingSchools
        );

    if (
        updates.length === 0
    ) {

        throw new Error(
            "No enrolment records matched existing schools."
        );
    }

    // -----------------------------------------------------
    // STEP 5: Update Supabase
    // -----------------------------------------------------

    await updateEnrolments(
        updates
    );

    // -----------------------------------------------------
    // COMPLETE
    // -----------------------------------------------------

    console.log("");

    console.log(
        "=============================================="
    );

    console.log(
        "ENROLMENT IMPORT COMPLETE"
    );

    console.log(
        "=============================================="
    );

    console.log("");
}

// =========================================================
// RUN
// =========================================================

main().catch(error => {

    console.error("");

    console.error(
        "=============================================="
    );

    console.error(
        "ENROLMENT IMPORT FAILED"
    );

    console.error(
        "=============================================="
    );

    console.error("");

    console.error(
        error.message
    );

    console.error("");

    process.exit(1);
});
