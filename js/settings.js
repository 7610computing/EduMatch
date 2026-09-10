// =========================
// SUPABASE CONFIGURATION
// =========================

const SUPABASE_URL = "https://lwamtnocbxgostdrqhhz.supabase.co";
const SUPABASE_KEY = "sb_publishable_toapbpc7C63yz1cCfg2jFQ_THIzGsJj";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

// =========================
// LOAD & UPDATE SETTINGS
// =========================

document.addEventListener("DOMContentLoaded", async function () {
    const settingsForm = document.getElementById("settings-form");
    const fullNameInput = document.getElementById("settings-fullname");
    const emailInput = document.getElementById("settings-email");
    const accountTypeSelect = document.getElementById("settings-account-type");
    const settingsMessage = document.getElementById("settings-message");
    const settingsButton = document.getElementById("settings-button");

    // Fetch active session / user data
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        // Redirect to home/auth gate if not logged in
        window.location.href = "index.html";
        return;
    }

    // Populate form fields with current user metadata
    emailInput.value = user.email || "";
    const firstName = user.user_metadata?.first_name || "";
    const lastName = user.user_metadata?.last_name || "";
    fullNameInput.value = `${firstName} ${lastName}`.trim();
    accountTypeSelect.value = user.user_metadata?.account_type || "student";

    // Handle form submission updates
    settingsForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        settingsButton.disabled = true;
        settingsButton.textContent = "Saving...";
        settingsMessage.textContent = "";

        const fullName = fullNameInput.value.trim();
        const accountType = accountTypeSelect.value;

        const nameParts = fullName.split(/\s+/);
        const firstNameVal = nameParts[0];
        const lastNameVal = nameParts.slice(1).join(" ");

        // Update user metadata in Supabase Auth
        const { error } = await supabaseClient.auth.updateUser({
            data: {
                first_name: firstNameVal,
                last_name: lastNameVal,
                account_type: accountType
            }
        });

        if (error) {
            console.error("Update error:", error);
            settingsMessage.textContent = error.message;
            settingsButton.disabled = false;
            settingsButton.textContent = "Save Changes";
            return;
        }

        settingsMessage.textContent = "Settings updated successfully!";
        settingsButton.disabled = false;
        settingsButton.textContent = "Save Changes";
    });
});
