// ==========================================
// SUPABASE CONFIGURATION
// ==========================================

const SUPABASE_URL = "YOUR_PROJECT_URL";
const SUPABASE_KEY = "YOUR_PUBLISHABLE_KEY";

const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// ==========================================
// PAGE LOADED
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    const signupForm = document.getElementById("signup-form");
    const loginForm = document.getElementById("login-form");


    // ==========================================
    // SIGN UP
    // ==========================================

    if (signupForm) {

        signupForm.addEventListener("submit", async (e) => {

            e.preventDefault();

            const fullname = document.getElementById("fullname").value;
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            const confirmPassword = document.getElementById("confirm-password").value;


            // Check passwords
            if (password !== confirmPassword) {
                alert("Passwords do not match!");
                return;
            }


            // Create account in Supabase Auth
            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password
            });


            // Check for errors
            if (error) {
                alert(error.message);
                return;
            }


            // Account created
            console.log("Account created:", data.user);

            alert("Account created successfully! Redirecting to login...");

            window.location.href = "login.html";
        });
    }


    // ==========================================
    // LOGIN
    // ==========================================

    if (loginForm) {

        loginForm.addEventListener("submit", async (e) => {

            e.preventDefault();

            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;


            // Log in with Supabase
            const { data, error } =
                await supabaseClient.auth.signInWithPassword({
                    email: email,
                    password: password
                });


            // Login failed
            if (error) {
                alert(error.message);
                return;
            }


            // Login successful
            console.log("Logged in user:", data.user);

            alert("Login successful!");

            // Go to dashboard
            window.location.href = "index.html";
        });
    }

});
