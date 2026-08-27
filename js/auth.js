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
// LOGIN FORM
// =========================

const loginForm = document.getElementById("login-form");

const loginButton = document.getElementById("login-button");

const loginMessage = document.getElementById("login-message");


loginForm.addEventListener("submit", async function (event) {

    // Prevent the page from refreshing
    event.preventDefault();


    // Get the values entered by the user
    const email = document.getElementById("email").value.trim();

    const password = document.getElementById("password").value;


    // Disable button while logging in
    loginButton.disabled = true;

    loginButton.textContent = "Logging in...";

    loginMessage.textContent = "";


    // =========================
    // SUPABASE LOGIN
    // =========================

    const { data, error } =
        await supabaseClient.auth.signInWithPassword({

            email: email,

            password: password

        });


    // =========================
    // LOGIN FAILED
    // =========================

    if (error) {

        console.error("Login error:", error);

        loginMessage.textContent =
            "Incorrect email or password.";

        loginButton.disabled = false;

        loginButton.textContent = "Log In";

        return;
    }


    // =========================
    // LOGIN SUCCESSFUL
    // =========================

    console.log("Login successful:", data);


    loginMessage.textContent =
        "Login successful!";


    // Give the message a moment to appear
    setTimeout(function () {

        window.location.href = "index.html";

    }, 500);

});
