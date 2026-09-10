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
// SETTINGS HANDLER
// =========================

document.addEventListener("DOMContentLoaded", async function () {
    const fullNameInput = document.getElementById("settings-fullname");
    const accountTypeSelect = document.getElementById("settings-account-type");
    const emailInput = document.getElementById("settings-email");

    const profileForm = document.getElementById("profile-form");
    const profileButton = document.getElementById("profile-button");
    const profileMessage = document.getElementById("profile-message");

    const emailForm = document.getElementById("email-form");
    const emailButton = document.getElementById("email-button");
    const emailMessage = document.getElementById("email-message");

    const passwordForm = document.getElementById("password-form");
    const passwordButton = document.getElementById("password-button");
    const passwordMessage = document.getElementById("password-message");

    // Fetch active session user data from Supabase
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        window.location.href = "index.html";
        return;
    }

    // Populate initial fields from Supabase Auth metadata
    emailInput.value = user.email || "";
    const firstName = user.user_metadata?.first_name || "";
    const lastName = user.user_metadata?.last_name || "";
    fullNameInput.value = `${firstName} ${lastName}`.trim();
    accountTypeSelect.value = user.user_metadata?.account_type || "student";

    // 1. Handle Profile Updates (Supabase Auth + Database Table)
    profileForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        profileButton.disabled = true;
        profileButton.textContent = "Updating...";
        profileMessage.textContent = "";

        const fullName = fullNameInput.value.trim();
        const accountType = accountTypeSelect.value;
        const nameParts = fullName.split(/\s+/);
        const firstNameVal = nameParts[0];
        const lastNameVal = nameParts.slice(1).join(" ");

        // Update Supabase Auth Metadata
        const { error: authError } = await supabaseClient.auth.updateUser({
            data: {
                first_name: firstNameVal,
                last_name: lastNameVal,
                account_type: accountType
            }
        });

        if (authError) {
            profileMessage.textContent = authError.message;
            profileMessage.style.color = "#e74c3c";
            profileButton.disabled = false;
            profileButton.textContent = "Update Profile";
            return;
        }

        // Optional: If you have a separate 'profiles' table in Supabase database, update it here too
        const { error: dbError } = await supabaseClient
            .from("profiles")
            .upsert({
                id: user.id,
                first_name: firstNameVal,
                last_name: lastNameVal,
                account_type: accountType,
                updated_at: new Date()
            });

        profileButton.disabled = false;
        profileButton.textContent = "Update Profile";

        if (dbError) {
            console.warn("Profiles table warning:", dbError.message);
            // Non-fatal if table doesn't exist yet, but auth was successful
        }

        profileMessage.textContent = "Profile successfully updated in Supabase!";
        profileMessage.style.color = "#27ae60";
    });

    // 2. Handle Email Updates via Supabase Auth
    emailForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        emailButton.disabled = true;
        emailButton.textContent = "Updating...";
        emailMessage.textContent = "";

        const newEmail = emailInput.value.trim();
        const { error } = await supabaseClient.auth.updateUser({ email: newEmail });

        emailButton.disabled = false;
        emailButton.textContent = "Update Email";

        if (error) {
            emailMessage.textContent = error.message;
            emailMessage.style.color = "#e74c3c";
            return;
        }

        emailMessage.textContent = "Confirmation link sent to your new email address.";
        emailMessage.style.color = "#27ae60";
    });

    // 3. Handle Password Updates via Supabase Auth
    passwordForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        const newPassword = document.getElementById("new-password").value;
        const confirmPassword = document.getElementById("confirm-new-password").value;

        if (newPassword !== confirmPassword) {
            passwordMessage.textContent = "Passwords do not match.";
            passwordMessage.style.color = "#e74c3c";
            return;
        }

        passwordButton.disabled = true;
        passwordButton.textContent = "Updating...";
        passwordMessage.textContent = "";

        const { error } = await supabaseClient.auth.updateUser({ password: newPassword });

        passwordButton.disabled = false;
        passwordButton.textContent = "Update Password";

        if (error) {
            passwordMessage.textContent = error.message;
            passwordMessage.style.color = "#e74c3c";
            return;
        }

        passwordMessage.textContent = "Password updated successfully in Supabase!";
        passwordMessage.style.color = "#27ae60";
        passwordForm.reset();
    });
});
