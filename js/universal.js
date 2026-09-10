/* =========================================================
   UNIVERSAL LOADER & AUTH MANAGER
   ========================================================= */

/* SUPABASE */

window.SUPABASE_URL = "https://lwamtnocbxgostdrqhhz.supabase.co";
window.SUPABASE_KEY = "sb_publishable_toapbpc7C63yz1cCfg2jFQ_THIzGsJj";

const supabaseClient = window.supabase.createClient(
    window.SUPABASE_URL,
    window.SUPABASE_KEY
);


/* =========================================================
   UNIVERSAL LOADER
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const universalElements =
        document.querySelectorAll("[data-universal]");

    let loadedCount = 0;
    const totalElements = universalElements.length;

    // Detect GitHub Pages repo subpath dynamically
    const pathSegments = window.location.pathname.split("/").filter(Boolean);
    const repoPrefix = window.location.hostname.includes("github.io") && pathSegments.length > 0 
        ? `/${pathSegments[0]}/` 
        : "/";

    if (totalElements === 0) {
        checkAuthAndSetupNav();
        return;
    }

    universalElements.forEach(element => {

        const universalName = element.dataset.universal;

        // Try fetching from universals folder first, with GitHub Pages path prefix
        fetch(repoPrefix + `universals/${universalName}.html`)
            .then(response => {
                if (!response.ok) {
                    // Fallback to root directory if not found in universals/
                    return fetch(repoPrefix + `${universalName}.html`);
                }
                return response;
            })
            .then(response => {

                if (!response.ok) {
                    throw new Error(
                        `Could not load universal: ${universalName}`
                    );
                }

                return response.text();

            })
            .then(html => {

                element.outerHTML = html;
                loadedCount++;

                /*
                    Once the navbar has been inserted, initialise
                    the authentication UI.
                */
                if (
                    loadedCount === totalElements ||
                    document.getElementById("nav-login")
                ) {
                    checkAuthAndSetupNav();
                }

            })
            .catch(error => {

                console.error(
                    "Universal loading error:",
                    error
                );

            });

    });

});


/* =========================================================
   AUTHENTICATION
   ========================================================= */

async function checkAuthAndSetupNav() {

    try {

        /* Initial session check */

        const {
            data: { session }
        } = await supabaseClient.auth.getSession();

        updateNavUI(session?.user || null);


        /* Listen for future authentication changes */

        supabaseClient.auth.onAuthStateChange(
            (event, session) => {

                updateNavUI(
                    session?.user || null
                );

            }
        );


        /* Logout button */

        const navLogout =
            document.getElementById("nav-logout");

        if (
            navLogout &&
            !navLogout.dataset.listenerAttached
        ) {

            navLogout.dataset.listenerAttached = "true";

            navLogout.addEventListener(
                "click",
                async function () {

                    await supabaseClient.auth.signOut();

                    window.location.href = "index.html";

                }
            );

        }

    } catch (err) {

        console.error(
            "Auth check error:",
            err
        );

    }

}


/* =========================================================
   NAVIGATION UI
   ========================================================= */

function updateNavUI(user) {

    const navLogin =
        document.getElementById("nav-login");

    const navAccount =
        document.getElementById("nav-account");

    const navLogout =
        document.getElementById("nav-logout");


    if (user) {

        if (navLogin) {
            navLogin.style.display = "none";
        }

        if (navAccount) {
            navAccount.style.display = "inline-block";
        }

        if (navLogout) {
            navLogout.style.display = "inline-block";
        }

    } else {

        if (navLogin) {
            navLogin.style.display = "inline-block";
        }

        if (navAccount) {
            navAccount.style.display = "none";
        }

        if (navLogout) {
            navLogout.style.display = "none";
        }

    }

}
