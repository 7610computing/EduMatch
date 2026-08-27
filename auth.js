document.addEventListener("DOMContentLoaded", () => {
    const signupForm = document.getElementById("signup-form");
    const loginForm = document.getElementById("login-form");

    // 1. Handle Sign-Up Submission
    if (signupForm) {
        signupForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const fullname = document.getElementById("fullname").value;
            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;
            const confirmPassword = document.getElementById("confirm-password").value;

            // Password check
            if (password !== confirmPassword) {
                alert("Passwords do not match!");
                return;
            }

            // Save user to LocalStorage (Simple Client-Side Demo)
            const user = { fullname, email, password };
            localStorage.setItem(email, JSON.stringify(user));

            alert("Account created successfully! Redirecting to login...");
            window.location.href = "login.html"; // Redirect to login
        });
    }

    // 2. Handle Login Submission
    if (loginForm) {
        loginForm.addEventListener("submit", (e) => {
            e.preventDefault();

            const email = document.getElementById("email").value;
            const password = document.getElementById("password").value;

            // Retrieve stored user data
            const storedUser = localStorage.getItem(email);

            if (!storedUser) {
                alert("No account found with this email. Please sign up first.");
                return;
            }

            const parsedUser = JSON.parse(storedUser);

            // Verify password
            if (parsedUser.password === password) {
                alert(`Welcome back, ${parsedUser.fullname}!`);
                // Redirect to main page/dashboard
                // window.location.href = "dashboard.html";
            } else {
                alert("Incorrect password. Please try again.");
            }
        });
    }
});