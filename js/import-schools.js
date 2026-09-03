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

// TEST ONLY
// Parade College has School_No 20
const SCHOOL_NO = "20";


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
// GET SCHOOL FROM VICTORIAN GOVERNMENT API
// ============================================================

async function getSchool() {

    const params = new URLSearchParams({
        resource_id: RESOURCE_ID,
        limit: "1",

        filters: JSON.stringify({
            School_No: SCHOOL_NO
        })
    });

    const url = `${VICTORIAN_API}?${params}`;

    console.log("Fetching school from Victorian Government API...");
    console.log(`School_No: ${SCHOOL_NO}`);

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
        !data.result.records ||
        data.result.records.length === 0
    ) {
        throw new Error(
            `No school found with School_No ${SCHOOL_NO}`
        );
    }

    return data.result.records[0];
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

    return {

        // Government identifier
        government_school_no: String(row.School_No),

        // Basic school information
        name: row.School_Name || null,

        school_type: row.School_Type || null,

        sector: row.Education_Sector || null,

        // Address
        address: addressParts.join(", "),

        state: row.Address_State || null,

        // Contact
        contact: row.Full_Phone_No || null,

        // Coordinates
        // Victorian API:
        // X = longitude
        // Y = latitude
        latitude: Number(row.Y),
        longitude: Number(row.X)
    };
}


// ============================================================
// VALIDATE CONVERTED SCHOOL
// ============================================================

function validateSchool(school) {

    if (!school.government_school_no) {
        throw new Error(
            "School is missing government_school_no."
        );
    }

    if (!school.name) {
        throw new Error(
            "School is missing a name."
        );
    }

    if (
        !Number.isFinite(school.latitude) ||
        !Number.isFinite(school.longitude)
    ) {
        throw new Error(
            "School has invalid latitude or longitude."
        );
    }
}


// ============================================================
// SAVE SCHOOL TO SUPABASE
// ============================================================

async function saveSchool(school) {

    console.log(
        "Checking whether school already exists..."
    );

    const {
        data: existingSchool,
        error: lookupError
    } = await supabase
        .from("Schools")
        .select("school_id")
        .eq(
            "government_school_no",
            school.government_school_no
        )
        .maybeSingle();

    if (lookupError) {
        throw lookupError;
    }


    // ========================================================
    // UPDATE EXISTING SCHOOL
    // ========================================================

    if (existingSchool) {

        console.log(
            `School already exists with school_id ${existingSchool.school_id}.`
        );

        const {
            error: updateError
        } = await supabase
            .from("Schools")
            .update(school)
            .eq(
                "school_id",
                existingSchool.school_id
            );

        if (updateError) {
            throw updateError;
        }

        console.log("Existing school updated.");

        return;
    }


    // ========================================================
    // INSERT NEW SCHOOL
    // ========================================================

    console.log(
        "School does not exist. Creating new school..."
    );

    const {
        data,
        error: insertError
    } = await supabase
        .from("Schools")
        .insert(school)
        .select()
        .single();

    if (insertError) {
        throw insertError;
    }

    console.log(
        `School created with school_id ${data.school_id}.`
    );
}


// ============================================================
// MAIN
// ============================================================

async function main() {

    try {

        // Get Parade College
        const row = await getSchool();

        console.log("");
        console.log("School found:");
        console.log(`Name: ${row.School_Name}`);
        console.log(`School No: ${row.School_No}`);

        // Convert government data
        const school = convertSchool(row);

        // Validate data
        validateSchool(school);

        console.log("");
        console.log("Data being sent to Supabase:");
        console.log(school);

        // Save to database
        await saveSchool(school);

        console.log("");
        console.log("=================================");
        console.log("IMPORT COMPLETED SUCCESSFULLY");
        console.log("=================================");

    } catch (error) {

        console.error("");
        console.error("=================================");
        console.error("IMPORT FAILED");
        console.error("=================================");

        console.error(error);

        process.exit(1);
    }
}


// ============================================================
// START
// ============================================================

main();
