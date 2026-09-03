const { createClient } = require("@supabase/supabase-js");

// ==============================
// Configuration
// ==============================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const VICTORIAN_API =
    "https://discover.data.vic.gov.au/api/3/action/datastore_search";

const RESOURCE_ID =
    "d26bf015-a1e5-48dd-a1d6-8edd4b0a511b";

// TEST ONLY:
// Only import Parade College (School_No 20)
const SCHOOL_NO = "20";

// ==============================
// Check configuration
// ==============================

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase environment variables.");
    process.exit(1);
}

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// ==============================
// Get school from Victorian API
// ==============================

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

    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `Victorian API returned ${response.status}`
        );
    }

    const data = await response.json();

    if (!data.success) {
        throw new Error("Victorian API returned an unsuccessful response.");
    }

    if (!data.result.records || data.result.records.length === 0) {
        throw new Error(
            `No school found with School_No ${SCHOOL_NO}`
        );
    }

    return data.result.records[0];
}

// ==============================
// Convert Victorian data
// to EduMatch data
// ==============================

function convertSchool(row) {
    return {
        government_school_no: String(row.School_No),

        name: row.School_Name || null,

        school_type: row.School_Type || null,

        sector: row.Education_Sector || null,

        address: [
            row.Address_Line_1,
            row.Address_Town,
            row.Address_State,
            row.Address_Postcode
        ]
            .filter(Boolean)
            .join(", "),

        state: row.Address_State || null,

        contact: row.Full_Phone_No || null,

        latitude: Number(row.Y),
        longitude: Number(row.X)
    };
}

// ==============================
// Insert/update Supabase
// ==============================

async function saveSchool(school) {
    console.log("Checking whether school already exists...");

    const { data: existingSchool, error: lookupError } =
        await supabase
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

    // ==========================
    // Update existing school
    // ==========================

    if (existingSchool) {
        console.log(
            `School already exists (school_id ${existingSchool.school_id}).`
        );

        const { error } = await supabase
            .from("Schools")
            .update(school)
            .eq(
                "school_id",
                existingSchool.school_id
            );

        if (error) {
            throw error;
        }

        console.log("Existing school updated.");
        return;
    }

    // ==========================
    // Insert new school
    // ==========================

    console.log("School does not exist. Creating it...");

    const { data, error } = await supabase
        .from("Schools")
        .insert(school)
        .select()
        .single();

    if (error) {
        throw error;
    }

    console.log(
        `School created with school_id ${data.school_id}.`
    );
}

// ==============================
// Main
// ==============================

async function main() {
    try {
        const row = await getSchool();

        console.log("School found:");
        console.log(row.School_Name);

        const school = convertSchool(row);

        console.log("Data being sent to Supabase:");
        console.log(school);

        await saveSchool(school);

        console.log("Import completed successfully.");
    } catch (error) {
        console.error("IMPORT FAILED:");
        console.error(error);

        process.exit(1);
    }
}

main();
