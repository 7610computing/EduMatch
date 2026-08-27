// =========================
// SUPABASE CONFIGURATION
// =========================

const SUPABASE_URL = "https://lwamtnocbxgostdrqhhz.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_toapbpc7C63yz1cCfg2jFQ_THIzGsJj";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


// =========================
// LOGIN
// =========================

const loginForm = document.getElementById("login-form");

if (loginForm) {

    const loginButton = document.getElementById("login-button");
    const loginMessage = document.getElementById("login-message");

    loginForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        const email =
            document.getElementById("email").value.trim();

        const password =
            document.getElementById("password").value;

        loginButton.disabled = true;
        loginButton.textContent = "Logging in...";
        loginMessage.textContent = "";


        const { data, error } =
            await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });


        if (error) {

            console.error("Login error:", error);

            loginMessage.textContent =
                "Incorrect email or password.";

            loginButton.disabled = false;
            loginButton.textContent = "Log In";

            return;
        }


        console.log("Login successful:", data);

        loginMessage.textContent =
            "Login successful!";


        setTimeout(function () {

            window.location.href = "index.html";

        }, 500);

    });
}


// =========================
// SIGN UP
// =========================

const signupForm = document.getElementById("signup-form");

if (signupForm) {

    const signupButton =
        document.getElementById("signup-button");

    const signupMessage =
        document.getElementById("signup-message");


    signupForm.addEventListener("submit", async function (event) {

        event.preventDefault();


        // Get form values
        const fullName =
            document.getElementById("fullname").value.trim();

        const email =
            document.getElementById("signup-email").value.trim();

        const accountType =
            document.getElementById("account-type").value;

        const password =
            document.getElementById("signup-password").value;

        const confirmPassword =
            document.getElementById("confirm-password").value;


        // Check passwords match
        if (password !== confirmPassword) {

            signupMessage.textContent =
                "Passwords do not match.";

            return;
        }


        // Split full name
        const nameParts = fullName.split(/\s+/);

        const firstName = nameParts[0];

        const lastName =
            nameParts.slice(1).join(" ");


        // Disable button
        signupButton.disabled = true;

        signupButton.textContent =
            "Creating account...";

        signupMessage.textContent = "";


        // =========================
        // CREATE AUTH ACCOUNT
        // =========================

        const { data, error } =
            await supabaseClient.auth.signUp({

                email: email,

                password: password

            });


        // Auth signup failed
        if (error) {

            console.error("Signup error:", error);

            signupMessage.textContent =
                error.message;

            signupButton.disabled = false;

            signupButton.textContent =
                "Sign Up";

            return;
        }


        const user = data.user;


        if (!user) {

            signupMessage.textContent =
                "Account could not be created.";

            signupButton.disabled = false;

            signupButton.textContent =
                "Sign Up";

            return;
        }


        // =========================
        // CREATE USER PROFILE
        // =========================

        const { error: profileError } =
            await supabaseClient
                .from("users")
                .insert({

                    id: user.id,

                    first_name: firstName,

                    last_name: lastName,

                    email: email,

                    account_type: accountType

                });


        // Profile creation failed
        if (profileError) {

            console.error(
                "Profile creation error:",
                profileError
            );

            signupMessage.textContent =
                "Account was created, but the profile could not be saved.";

            signupButton.disabled = false;

            signupButton.textContent =
                "Sign Up";

            return;
        }


        // =========================
        // SUCCESS
        // =========================

        signupMessage.textContent =
            "Account created successfully!";


        setTimeout(function () {

            window.location.href =
                "index.html";

        }, 1000);

    });
}
