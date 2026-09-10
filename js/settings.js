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

    // Fetch active session user data
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        window.location.href = "index.html";
        return;
    }

    // Populate initial fields
    emailInput.value = user.email || "";
    const firstName = user.user_metadata?.first_name || "";
    const lastName = user.user_metadata?.last_name || "";
    fullNameInput.value = `${firstName} ${lastName}`.trim();
    accountTypeSelect.value = user.user_metadata?.account_type || "student";

    // 1. Handle Profile Metadata Updates
    profileForm.addEventListener("submit", async function (event) {
        event.preventDefault();
        profileButton.disabled = true;
        profileButton.textContent = "Updating...";
        profileMessage.textContent = "";

        const fullName = fullNameInput.value.trim();
        const accountType = accountTypeSelect.value;
        const nameParts = fullName.split(/\s+/);

        const { error } = await supabaseClient.auth.updateUser({
            data: {
                first_name: nameParts[0],
                last_name: nameParts.slice(1).join(" "),
                account_type: accountType
            }
        });

        profileButton.disabled = false;
        profileButton.textContent = "Update Profile";

        if (error) {
            profileMessage.textContent = error.message;
            profileMessage.style.color = "#e74c3c";
            return;
        }

        profileMessage.textContent = "Profile updated successfully!";
        profileMessage.style.color = "#27ae60";
    });

    // 2. Handle Email Updates
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

        emailMessage.textContent = "Verification link sent to your new email address.";
        emailMessage.style.color = "#27ae60";
    });

    // 3. Handle Password Updates
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

        passwordMessage.textContent = "Password updated successfully!";
        passwordMessage.style.color = "#27ae60";
        passwordForm.reset();
    });
});
