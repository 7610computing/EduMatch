/* =========================================================
   SUPABASE
   ========================================================= */


/* =========================
   SUPABASE SETTINGS
   ========================= */

const SUPABASE_URL =
    "https://lwamtnocbxgostdrqhhz.supabase.co";


const SUPABASE_ANON_KEY =
    "YOUR_SUPABASE_ANON_KEY";


/* =========================
   CREATE SUPABASE CLIENT
   ========================= */

const supabaseClient =
    supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        }
    );


window.supabaseClient =
    supabaseClient;


/* =========================================================
   USER AUTHENTICATION FUNCTIONS
   ========================================================= */


/* =========================
   GET CURRENT SESSION
   ========================= */

async function getCurrentSession() {

    const {
        data,
        error
    } =
        await supabaseClient
            .auth
            .getSession();


    if (error) {

        console.error(
            "Could not get session:",
            error
        );

        return null;
    }


    return data.session;
}


window.getCurrentSession =
    getCurrentSession;


/* =========================
   GET CURRENT USER
   ========================= */

async function getCurrentUser() {

    const session =
        await getCurrentSession();


    if (!session) {

        return null;
    }


    return session.user;
}


window.getCurrentUser =
    getCurrentUser;


/* =========================
   CHECK IF USER IS LOGGED IN
   ========================= */

async function isLoggedIn() {

    const user =
        await getCurrentUser();


    return user !== null;
}


window.isLoggedIn =
    isLoggedIn;


/* =========================
   LOG IN
   ========================= */

async function loginUser(
    email,
    password
) {

    const {
        data,
        error
    } =
        await supabaseClient
            .auth
            .signInWithPassword(
                {
                    email: email,
                    password: password
                }
            );


    if (error) {

        console.error(
            "Login error:",
            error
        );


        return {
            success: false,
            error: error
        };
    }


    return {
        success: true,
        user: data.user,
        session: data.session
    };
}


window.loginUser =
    loginUser;


/* =========================
   SIGN UP
   ========================= */

async function signupUser(
    email,
    password,
    firstName,
    lastName,
    accountType
) {

    const {
        data,
        error
    } =
        await supabaseClient
            .auth
            .signUp(
                {
                    email: email,

                    password: password,

                    options: {

                        data: {
                            first_name:
                                firstName,

                            last_name:
                                lastName,

                            account_type:
                                accountType
                        }

                    }
                }
            );


    if (error) {

        console.error(
            "Signup error:",
            error
        );


        return {
            success: false,
            error: error
        };
    }


    return {
        success: true,
        user: data.user,
        session: data.session
    };
}


window.signupUser =
    signupUser;


/* =========================
   LOG OUT
   ========================= */

async function logoutUser() {

    const {
        error
    } =
        await supabaseClient
            .auth
            .signOut();


    if (error) {

        console.error(
            "Logout error:",
            error
        );


        return false;
    }


    return true;
}


window.logoutUser =
    logoutUser;


/* =========================
   AUTH STATE CHANGES
   ========================= */

supabaseClient
    .auth
    .onAuthStateChange(
        function(
            event,
            session
        ) {

            if (
                event ===
                "SIGNED_IN"
            ) {

                console.log(
                    "User signed in."
                );

            }


            if (
                event ===
                "SIGNED_OUT"
            ) {

                console.log(
                    "User signed out."
                );

            }


            if (
                event ===
                "TOKEN_REFRESHED"
            ) {

                console.log(
                    "User session refreshed."
                );

            }

        }
    );
