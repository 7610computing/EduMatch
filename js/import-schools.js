const { createClient } = require("@supabase/supabase-js");

// ============================================================
// CONFIGURATION
// ============================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const VICTORIAN_API =
    "https://discover.data.vic.gov.au/api/3/action/datastore_search";

const RESOURCE_ID =
    "d26bf015-a1e5-48dd-a1d6-8edd4b0a511b";

// Number of Victorian API records requested per page
const API_PAGE_SIZE = 1000;

// Number of schools sent to Supabase at once
const SUPABASE_BATCH_SIZE = 500;


// ============================================================
// CHECK CONFIGURATION
// ============================================================

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase environment variables.");
    process.exit(1);
}

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ============================================================
// GET ALL SCHOOLS FROM VICTORIAN GOVERNMENT API
// ============================================================

async function getAllSchools() {

    const allRecords = [];

    let offset = 0;

    console.log("");
    console.log("=================================");
    console.log("FETCHING VICTORIAN SCHOOL DATA");
    console.log("=================================");
    console.log("");

    while (true) {

        const params = new URLSearchParams({
            resource_id: RESOURCE_ID,
            limit: String(API_PAGE_SIZE),
            offset: String(offset)
        });

        const url = `${VICTORIAN_API}?${params}`;

        console.log(
            `Fetching records ${offset + 1} to ${offset + API_PAGE_SIZE}...`
        );

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(
                `Victorian API returned HTTP ${response.status}`
            );
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(
                "Victorian API returned an unsuccessful response."
            );
        }

        if (
            !data.result ||
            !Array.isArray(data.result.records)
        ) {
            throw new Error(
                "Victorian API returned an invalid records response."
            );
        }

        const records = data.result.records;

        allRecords.push(...records);

        console.log(
            `Received ${records.length} records. Total: ${allRecords.length}`
        );

        // No more records
        if (records.length < API_PAGE_SIZE) {
            break;
        }

        offset += API_PAGE_SIZE;
    }

    console.log("");
    console.log(
        `Total Victorian records retrieved: ${allRecords.length}`
    );

    return allRecords;
}


// ============================================================
// CONVERT VICTORIAN DATA
// INTO EDUMATCH DATA
// ============================================================

function convertSchool(row) {

    const addressParts = [
        row.Address_Line_1,
        row.Address_Line_2,
        row.Address_Town,
        row.Address_State,
        row.Address_Postcode
    ].filter(Boolean);

    const latitude = Number(row.Y);
    const longitude = Number(row.X);

    return {

        // ----------------------------------------------------
        // Government identifier
        // ----------------------------------------------------

        government_school_no:
            row.School_No !== undefined &&
            row.School_No !== null
                ? String(row.School_No)
                : null,


        // ----------------------------------------------------
        // Basic school information
        // ----------------------------------------------------

        name:
            row.School_Name || null,

        school_type:
            row.School_Type || null,

        sector:
            row.Education_Sector || null,


        // ----------------------------------------------------
        // Address
        // ----------------------------------------------------

        address:
            addressParts.length > 0
                ? addressParts.join(", ")
                : null,

        state:
            row.Address_State || null,


        // ----------------------------------------------------
        // Contact
        // ----------------------------------------------------

        contact:
            row.Full_Phone_No || null,


        // ----------------------------------------------------
        // Coordinates
        //
        // Victorian dataset:
        // X = longitude
        // Y = latitude
        // ----------------------------------------------------

        latitude,

        longitude
    };
}


// ============================================================
// VALIDATE SCHOOL
// ============================================================

function validateSchool(school) {

    if (!school.government_school_no) {
        return {
            valid: false,
            reason: "Missing government school number."
        };
    }

    if (!school.name) {
        return {
            valid: false,
            reason: "Missing school name."
        };
    }

    if (
        !Number.isFinite(school.latitude) ||
        !Number.isFinite(school.longitude)
    ) {
        return {
            valid: false,
            reason: "Invalid latitude or longitude."
        };
    }

    return {
        valid: true
    };
}


// ============================================================
// SAVE BATCH OF SCHOOLS TO SUPABASE
// ============================================================

async function saveSchoolBatch(schools, batchNumber, totalBatches) {

    console.log("");
    console.log(
        `Uploading batch ${batchNumber}/${totalBatches} (${schools.length} schools)...`
    );

    /*
     * government_school_no has a UNIQUE constraint in Supabase.
     *
     * Therefore upsert will:
     *
     * - INSERT a school if it doesn't exist
     * - UPDATE the school if it already exists
     *
     * This prevents duplicate schools.
     */

    const {
        error
    } = await supabase
        .from("Schools")
        .upsert(
            schools,
            {
                onConflict: "government_school_no"
            }
        );

    if (error) {
        throw error;
    }

    console.log(
        `Batch ${batchNumber}/${totalBatches} uploaded successfully.`
    );
}


// ============================================================
// IMPORT ALL SCHOOLS
// ============================================================

async function importSchools(rows) {

    const schools = [];

    let skipped = 0;

    console.log("");
    console.log("=================================");
    console.log("CONVERTING SCHOOL DATA");
    console.log("=================================");
    console.log("");

    for (const row of rows) {

        const school = convertSchool(row);

        const validation = validateSchool(school);

        if (!validation.valid) {

            skipped++;

            console.warn(
                `Skipping ${row.School_Name || "unknown school"}: ${validation.reason}`
            );

            continue;
        }

        schools.push(school);
    }


    console.log("");
    console.log(`Valid schools: ${schools.length}`);
    console.log(`Skipped schools: ${skipped}`);


    // --------------------------------------------------------
    // Split schools into batches
    // --------------------------------------------------------

    const batches = [];

    for (
        let i = 0;
        i < schools.length;
        i += SUPABASE_BATCH_SIZE
    ) {

        batches.push(
            schools.slice(
                i,
                i + SUPABASE_BATCH_SIZE
            )
        );
    }


    console.log(
        `Supabase batches required: ${batches.length}`
    );


    // --------------------------------------------------------
    // Upload each batch
    // --------------------------------------------------------

    for (
        let i = 0;
        i < batches.length;
        i++
    ) {

        await saveSchoolBatch(
            batches[i],
            i + 1,
            batches.length
        );
    }


    return {
        imported: schools.length,
        skipped
    };
}


// ============================================================
// MAIN
// ============================================================

async function main() {

    try {

        console.log("");
        console.log("=================================");
        console.log("EDUMATCH SCHOOL IMPORT");
        console.log("=================================");


        // ----------------------------------------------------
        // Get all Victorian schools
        // ----------------------------------------------------

        const rows = await getAllSchools();


        if (rows.length === 0) {

            throw new Error(
                "Victorian Government API returned zero schools."
            );
        }


        // ----------------------------------------------------
        // Import schools into Supabase
        // ----------------------------------------------------

        const result = await importSchools(rows);


        // ----------------------------------------------------
        // Finished
        // ----------------------------------------------------

        console.log("");
        console.log("=================================");
        console.log("IMPORT COMPLETED SUCCESSFULLY");
        console.log("=================================");
        console.log("");

        console.log(
            `Schools imported/updated: ${result.imported}`
        );

        console.log(
            `Schools skipped: ${result.skipped}`
        );

        console.log("");
        console.log(
            "Victorian school data is now in Supabase."
        );
        console.log("");

    } catch (error) {

        console.error("");
        console.error("=================================");
        console.error("IMPORT FAILED");
        console.error("=================================");
        console.error("");

        console.error(error);

        console.error("");

        process.exit(1);
    }
}


// ============================================================
// START
// ============================================================

main();
