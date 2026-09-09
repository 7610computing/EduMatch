/* =========================================================
   UNIVERSAL LOADER & AUTH MANAGER
   ========================================================= */

const SUPABASE_URL = "https://lwamtnocbxgostdrqhhz.supabase.co";
const SUPABASE_KEY = "sb_publishable_toapbpc7C63yz1cCfg2jFQ_THIzGsJj";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

document.addEventListener("DOMContentLoaded", () => {
    const universalElements = document.querySelectorAll("[data-universal]");
    let loadedCount = 0;
    const totalElements = universalElements.length;

    if (totalElements === 0) {
        checkAuthAndSetupNav();
    }

    universalElements.forEach(element => {
        const universalName = element.dataset.universal;

        fetch(`universals/${universalName}.html`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Could not load universal: ${universalName}`);
                }
                return response.text();
            })
            .then(html => {
                element.outerHTML = html;
                loadedCount++;

                // Trigger auth state setup once the navbar element is injected into the DOM
                if (loadedCount === totalElements || document.getElementById("nav-login")) {
                    checkAuthAndSetupNav();
                }
            })
            .catch(error => {
                console.error(error);
            });
    });
});

async function checkAuthAndSetupNav() {
    try {
        // 1. Initial session check
        const { data: { session } } = await supabaseClient.auth.getSession();
        updateNavUI(session?.user || null);

        // 2. Real-time auth state listener
        supabaseClient.auth.onAuthStateChange((event, session) => {
            updateNavUI(session?.user || null);
        });

        // 3. Handle logout functionality safely
        const navLogout = document.getElementById("nav-logout");
        if (navLogout && !navLogout.dataset.listenerAttached) {
            navLogout.dataset.listenerAttached = "true";
            navLogout.addEventListener("click", async function () {
                await supabaseClient.auth.signOut();
                window.location.href = "index.html";
            });
        }
    } catch (err) {
        console.error("Auth check error:", err);
    }
}

function updateNavUI(user) {
    const navLogin = document.getElementById("nav-login");
    const navAccount = document.getElementById("nav-account");
    const navLogout = document.getElementById("nav-logout");

    if (user) {
        if (navLogin) navLogin.style.display = "none";
        if (navAccount) navAccount.style.display = "inline-block";
        if (navLogout) navLogout.style.display = "inline-block";
    } else {
        if (navLogin) navLogin.style.display = "inline-block";
        if (navAccount) navAccount.style.display = "none";
        if (navLogout) navLogout.style.display = "none";
    }
}
