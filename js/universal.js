/* =========================================================
   UNIVERSAL LOADER
   =========================================================

   Loads reusable HTML components from the /universals folder.

   Example:
   <div data-universal="navbar"></div>

   will load:
   /universals/navbar.html

   ========================================================= */


document.addEventListener("DOMContentLoaded", () => {

    document.querySelectorAll("[data-universal]").forEach(element => {

        const universalName = element.dataset.universal;

        fetch(`universals/${universalName}.html`)
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
            })

            .catch(error => {
                console.error(error);
            });

    });

});
