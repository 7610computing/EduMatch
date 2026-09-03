/* =========================================================
   EDUMATCH SCHOOL MAP
   ========================================================= */


/* =========================================================
   SUPABASE CONFIGURATION
   =========================================================

   IMPORTANT:

   Replace SUPABASE_ANON_KEY with your project's public
   anon key.

   NEVER put the Supabase service-role key here.
   ========================================================= */

const SUPABASE_URL =
    "https://lwamtnocbxgostdrqhhz.supabase.co";

const SUPABASE_ANON_KEY =
    "YOUR_SUPABASE_ANON_KEY";


/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */

let schools = [];
let filteredSchools = [];

let map = null;

let markerLayer = null;

let selectedStates = [];
let selectedSectors = [];

let selectedSchool = null;


/* =========================================================
   RANGE CONFIGURATION
   ========================================================= */

const rangeConfig = {

    age: {
        minInput: "age-min",
        maxInput: "age-max",
        minSlider: "age-slider-min",
        maxSlider: "age-slider-max",
        minimum: 0,
        maximum: 100
    },

    fee: {
        minInput: "fee-min",
        maxInput: "fee-max",
        minSlider: "fee-slider-min",
        maxSlider: "fee-slider-max",
        minimum: 0,
        maximum: 100000
    },

    enrolment: {
        minInput: "enrolment-min",
        maxInput: "enrolment-max",
        minSlider: "enrolment-slider-min",
        maxSlider: "enrolment-slider-max",
        minimum: 0,
        maximum: 10000
    },

    ratio: {
        minInput: "ratio-min",
        maxInput: "ratio-max",
        minSlider: "ratio-slider-min",
        maxSlider: "ratio-slider-max",
        minimum: 0,
        maximum: 100
    }

};


/* =========================================================
   PAGE INITIALISATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", async () => {

    initialiseMap();

    initialiseRangeFilters();

    initialiseSearchFilters();

    initialiseSearch();

    initialiseClearButton();

    initialiseDetailsPanel();

    await loadSchools();

});


/* =========================================================
   MAP
   ========================================================= */

function initialiseMap() {

    map = L.map("school-map", {

        /*
         * Prevent Leaflet from endlessly wrapping the
         * world horizontally.
         */

        worldCopyJump: false,

        maxBounds: [
            [-60, 100],
            [15, 180]
        ],

        maxBoundsViscosity: 1.0

    });


    /*
     * Start around Australia / Asia-Pacific.
     *
     * This can later be changed to automatically centre
     * around the user's location or selected schools.
     */

    map.setView(
        [-25.2744, 133.7751],
        4
    );


    L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            noWrap: true,

            attribution:
                '&copy; OpenStreetMap contributors'
        }
    ).addTo(map);


    markerLayer = L.layerGroup().addTo(map);

}


/* =========================================================
   LOAD SCHOOLS FROM SUPABASE
   ========================================================= */

async function loadSchools() {

    const resultsText =
        document.getElementById("results-count");

    resultsText.textContent =
        "Loading schools...";


    try {

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/Schools?select=*`,
            {
                method: "GET",

                headers: {
                    "apikey": SUPABASE_ANON_KEY,
                    "Authorization":
                        `Bearer ${SUPABASE_ANON_KEY}`,

                    "Content-Type":
                        "application/json"
                }
            }
        );


        if (!response.ok) {

            throw new Error(
                `Supabase returned ${response.status}`
            );

        }


        schools = await response.json();


        /*
         * Convert numeric values into actual numbers.
         */

        schools = schools.map(normaliseSchool);


        /*
         * Generate filter options from the actual
         * database values.
         */

        createStateOptions();

        createSectorOptions();


        /*
         * Display schools.
         */

        applyFilters();


    } catch (error) {

        console.error(
            "Unable to load schools:",
            error
        );

        resultsText.textContent =
            "Unable to load schools.";

    }

}


/* =========================================================
   NORMALISE SCHOOL
   ========================================================= */

function normaliseSchool(school) {

    return {

        ...school,

        school_id:
            Number(school.school_id),

        enrolment:
            toNumber(school.enrolment),

        fee:
            toNumber(school.fee),

        student_teacher_ratio:
            toNumber(
                school.student_teacher_ratio
            )

    };

}


/* =========================================================
   NUMBER HELPER
   ========================================================= */

function toNumber(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return null;
    }


    const number =
        Number(value);


    return Number.isFinite(number)
        ? number
        : null;

}


/* =========================================================
   SEARCHABLE STATE OPTIONS
   ========================================================= */

function createStateOptions() {

    const states = [
        ...new Set(
            schools
                .map(school => school.state)
                .filter(Boolean)
                .map(value => value.trim())
        )
    ];


    states.sort(
        (a, b) =>
            a.localeCompare(b)
    );


    renderSearchOptions(
        "state-options",
        states,
        "state"
    );

}


/* =========================================================
   SEARCHABLE SECTOR OPTIONS
   ========================================================= */

function createSectorOptions() {

    const sectors = [
        ...new Set(
            schools
                .map(school => school.sector)
                .filter(Boolean)
                .map(value => value.trim())
        )
    ];


    sectors.sort(
        (a, b) =>
            a.localeCompare(b)
    );


    renderSearchOptions(
        "sector-options",
        sectors,
        "sector"
    );

}


/* =========================================================
   RENDER SEARCH OPTIONS
   ========================================================= */

function renderSearchOptions(
    containerId,
    options,
    type
) {

    const container =
        document.getElementById(containerId);


    container.innerHTML = "";


    if (options.length === 0) {

        container.innerHTML =
            `<div class="no-options">
                No options available
             </div>`;

        return;

    }


    options.forEach(option => {

        const element =
            document.createElement("div");


        element.className =
            "search-option";


        element.textContent =
            option;


        element.dataset.value =
            option;


        element.addEventListener(
            "click",
            () => {

                addSelectedFilter(
                    type,
                    option
                );

            }
        );


        container.appendChild(element);

    });

}


/* =========================================================
   SEARCH FILTER INPUTS
   ========================================================= */

function initialiseSearchFilters() {

    setupSearchFilter(
        "state-filter",
        "state-options",
        "state"
    );


    setupSearchFilter(
        "sector-filter",
        "sector-options",
        "sector"
    );


    document.addEventListener(
        "click",
        event => {

            if (
                !event.target.closest(
                    ".search-select"
                )
            ) {

                document
                    .querySelectorAll(
                        ".search-options"
                    )
                    .forEach(
                        option =>
                            option.classList
                                .remove("visible")
                    );

            }

        }
    );

}


/* =========================================================
   SETUP SEARCH FILTER
   ========================================================= */

function setupSearchFilter(
    inputId,
    optionsId,
    type
) {

    const input =
        document.getElementById(inputId);

    const options =
        document.getElementById(optionsId);


    input.addEventListener(
        "focus",
        () => {

            filterOptionList(
                input,
                options
            );

            options.classList.add(
                "visible"
            );

        }
    );


    input.addEventListener(
        "input",
        () => {

            filterOptionList(
                input,
                options
            );

            options.classList.add(
                "visible"
            );

        }
    );

}


/* =========================================================
   FILTER OPTION LIST
   ========================================================= */

function filterOptionList(
    input,
    optionsContainer
) {

    const search =
        input.value
            .trim()
            .toLowerCase();


    const options =
        optionsContainer
            .querySelectorAll(
                ".search-option"
            );


    let visibleCount = 0;


    options.forEach(option => {

        const value =
            option.dataset.value
                .toLowerCase();


        const alreadySelected =
            selectedStates
                .includes(option.dataset.value) ||
            selectedSectors
                .includes(option.dataset.value);


        const matches =
            value.includes(search) &&
            !alreadySelected;


        option.style.display =
            matches
                ? "block"
                : "none";


        if (matches) {
            visibleCount++;
        }

    });


    let emptyMessage =
        optionsContainer
            .querySelector(".no-search-results");


    if (visibleCount === 0) {

        if (!emptyMessage) {

            emptyMessage =
                document.createElement("div");

            emptyMessage.className =
                "no-options no-search-results";

            emptyMessage.textContent =
                "No matching options.";

            optionsContainer.appendChild(
                emptyMessage
            );

        }

    } else if (emptyMessage) {

        emptyMessage.remove();

    }

}


/* =========================================================
   ADD SELECTED FILTER
   ========================================================= */

function addSelectedFilter(
    type,
    value
) {

    if (type === "state") {

        if (!selectedStates.includes(value)) {

            selectedStates.push(value);

        }

        document.getElementById(
            "state-filter"
        ).value = "";


        document.getElementById(
            "state-options"
        ).classList.remove(
            "visible"
        );


        renderSelectedItems(
            "selected-states",
            selectedStates,
            "state"
        );

    }


    if (type === "sector") {

        if (!selectedSectors.includes(value)) {

            selectedSectors.push(value);

        }

        document.getElementById(
            "sector-filter"
        ).value = "";


        document.getElementById(
            "sector-options"
        ).classList.remove(
            "visible"
        );


        renderSelectedItems(
            "selected-sectors",
            selectedSectors,
            "sector"
        );

    }


    applyFilters();

}


/* =========================================================
   RENDER SELECTED ITEMS
   ========================================================= */

function renderSelectedItems(
    containerId,
    values,
    type
) {

    const container =
        document.getElementById(
            containerId
        );


    container.innerHTML = "";


    values.forEach(value => {

        const item =
            document.createElement("div");


        item.className =
            "selected-item";


        item.innerHTML = `
            <span>${escapeHtml(value)}</span>
            <button type="button">×</button>
        `;


        item.querySelector("button")
            .addEventListener(
                "click",
                () => {

                    removeSelectedFilter(
                        type,
                        value
                    );

                }
            );


        container.appendChild(item);

    });

}


/* =========================================================
   REMOVE SELECTED FILTER
   ========================================================= */

function removeSelectedFilter(
    type,
    value
) {

    if (type === "state") {

        selectedStates =
            selectedStates.filter(
                item => item !== value
            );

        renderSelectedItems(
            "selected-states",
            selectedStates,
            "state"
        );

    }


    if (type === "sector") {

        selectedSectors =
            selectedSectors.filter(
                item => item !== value
            );

        renderSelectedItems(
            "selected-sectors",
            selectedSectors,
            "sector"
        );

    }


    applyFilters();

}


/* =========================================================
   RANGE FILTERS
   ========================================================= */

function initialiseRangeFilters() {

    Object.entries(
        rangeConfig
    ).forEach(
        ([name, config]) => {

            const minSlider =
                document.getElementById(
                    config.minSlider
                );

            const maxSlider =
                document.getElementById(
                    config.maxSlider
                );

            const minInput =
                document.getElementById(
                    config.minInput
                );

            const maxInput =
                document.getElementById(
                    config.maxInput
                );


            /*
             * Slider → text box
             */

            minSlider.addEventListener(
                "input",
                () => {

                    if (
                        Number(minSlider.value) >
                        Number(maxSlider.value)
                    ) {

                        minSlider.value =
                            maxSlider.value;

                    }


                    minInput.value =
                        isAtMinimum(
                            minSlider,
                            config
                        )
                            ? ""
                            : minSlider.value;


                    updateSliderTrack(
                        minSlider,
                        maxSlider
                    );


                    applyFilters();

                }
            );


            maxSlider.addEventListener(
                "input",
                () => {

                    if (
                        Number(maxSlider.value) <
                        Number(minSlider.value)
                    ) {

                        maxSlider.value =
                            minSlider.value;

                    }


                    maxInput.value =
                        isAtMaximum(
                            maxSlider,
                            config
                        )
                            ? ""
                            : maxSlider.value;


                    updateSliderTrack(
                        minSlider,
                        maxSlider
                    );


                    applyFilters();

                }
            );


            /*
             * Text box → slider
             */

            minInput.addEventListener(
                "input",
                () => {

                    let value =
                        parseFloat(
                            minInput.value
                        );


                    if (
                        Number.isNaN(value)
                    ) {

                        minSlider.value =
                            config.minimum;

                    } else {

                        value =
                            Math.max(
                                config.minimum,
                                Math.min(
                                    value,
                                    Number(
                                        maxSlider.value
                                    )
                                )
                            );

                        minSlider.value =
                            value;

                    }


                    updateSliderTrack(
                        minSlider,
                        maxSlider
                    );


                    applyFilters();

                }
            );


            maxInput.addEventListener(
                "input",
                () => {

                    let value =
                        parseFloat(
                            maxInput.value
                        );


                    if (
                        Number.isNaN(value)
                    ) {

                        maxSlider.value =
                            config.maximum;

                    } else {

                        value =
                            Math.min(
                                config.maximum,
                                Math.max(
                                    value,
                                    Number(
                                        minSlider.value
                                    )
                                )
                            );

                        maxSlider.value =
                            value;

                    }


                    updateSliderTrack(
                        minSlider,
                        maxSlider
                    );


                    applyFilters();

                }
            );


            updateSliderTrack(
                minSlider,
                maxSlider
            );

        }
    );

}


/* =========================================================
   CHECK SLIDER EXTREMES
   ========================================================= */

function isAtMinimum(
    slider,
    config
) {

    return Number(slider.value) <=
        config.minimum;

}


function isAtMaximum(
    slider,
    config
) {

    return Number(slider.value) >=
        config.maximum;

}


/* =========================================================
   UPDATE SLIDER TRACK
   ========================================================= */

function updateSliderTrack(
    minSlider,
    maxSlider
) {

    const min =
        Number(minSlider.min);

    const max =
        Number(minSlider.max);

    const minValue =
        Number(minSlider.value);

    const maxValue =
        Number(maxSlider.value);


    const minPercent =
        ((minValue - min) /
        (max - min)) * 100;


    const maxPercent =
        ((maxValue - min) /
        (max - min)) * 100;


    const track =
        minSlider
            .parentElement
            .querySelector(
                ".slider-track"
            );


    track.style.background =
        `linear-gradient(
            to right,
            #ddd ${minPercent}%,
            #ff7700 ${minPercent}%,
            #ff7700 ${maxPercent}%,
            #ddd ${maxPercent}%
        )`;

}


/* =========================================================
   SCHOOL SEARCH
   ========================================================= */

function initialiseSearch() {

    const input =
        document.getElementById(
            "school-search"
        );


    const button =
        document.getElementById(
            "search-button"
        );


    input.addEventListener(
        "input",
        applyFilters
    );


    button.addEventListener(
        "click",
        applyFilters
    );

}


/* =========================================================
   APPLY ALL FILTERS
   ========================================================= */

function applyFilters() {

    const search =
        document.getElementById(
            "school-search"
        )
            .value
            .trim()
            .toLowerCase();


    const ageRange =
        getRangeValues("age");

    const feeRange =
        getRangeValues("fee");

    const enrolmentRange =
        getRangeValues("enrolment");

    const ratioRange =
        getRangeValues("ratio");


    filteredSchools =
        schools.filter(school => {


            /* -------------------------
               SEARCH
               ------------------------- */

            if (search) {

                const searchableText = [

                    school.name,

                    school.address,

                    school.state,

                    school.description

                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();


                if (
                    !searchableText.includes(
                        search
                    )
                ) {

                    return false;

                }

            }


            /* -------------------------
               STATE
               ------------------------- */

            if (
                selectedStates.length > 0 &&
                !selectedStates.includes(
                    school.state
                )
            ) {

                return false;

            }


            /* -------------------------
               SECTOR
               ------------------------- */

            if (
                selectedSectors.length > 0 &&
                !selectedSectors.includes(
                    school.sector
                )
            ) {

                return false;

            }


            /* -------------------------
               AGE
               ------------------------- */

            if (
                !schoolMatchesAge(
                    school,
                    ageRange
                )
            ) {

                return false;

            }


            /* -------------------------
               FEE
               ------------------------- */

            if (
                !matchesNumericRange(
                    school.fee,
                    feeRange
                )
            ) {

                return false;

            }


            /* -------------------------
               ENROLMENT
               ------------------------- */

            if (
                !matchesNumericRange(
                    school.enrolment,
                    enrolmentRange
                )
            ) {

                return false;

            }


            /* -------------------------
               STUDENT TEACHER RATIO
               ------------------------- */

            if (
                !matchesNumericRange(
                    school.student_teacher_ratio,
                    ratioRange
                )
            ) {

                return false;

            }


            return true;

        });


    renderSchools();

}


/* =========================================================
   GET RANGE VALUES
   ========================================================= */

function getRangeValues(name) {

    const config =
        rangeConfig[name];


    const minSlider =
        document.getElementById(
            config.minSlider
        );

    const maxSlider =
        document.getElementById(
            config.maxSlider
        );


    return {

        min:
            Number(minSlider.value) >
            config.minimum
                ? Number(minSlider.value)
                : null,

        max:
            Number(maxSlider.value) <
            config.maximum
                ? Number(maxSlider.value)
                : null

    };

}


/* =========================================================
   NUMERIC RANGE MATCH
   ========================================================= */

function matchesNumericRange(
    value,
    range
) {

    /*
     * Missing database values cannot be confidently
     * included in a numerical range.
     */

    if (value === null) {
        return range.min === null &&
               range.max === null;
    }


    if (
        range.min !== null &&
        value < range.min
    ) {

        return false;

    }


    if (
        range.max !== null &&
        value > range.max
    ) {

        return false;

    }


    return true;

}


/* =========================================================
   AGE FILTER
   ========================================================= */

function schoolMatchesAge(
    school,
    range
) {

    /*
     * allowed_ages is currently TEXT in Supabase.
     *
     * This function extracts numbers from values such as:
     *
     * "5-18"
     * "Ages 5 to 18"
     * "Prep - Year 12"
     *
     * The data should eventually be normalised for perfect
     * accuracy.
     */

    if (
        range.min === null &&
        range.max === null
    ) {

        return true;

    }


    if (!school.allowed_ages) {

        return false;

    }


    const numbers =
        String(
            school.allowed_ages
        )
            .match(
                /\d+(?:\.\d+)?/g
            );


    if (
        !numbers ||
        numbers.length === 0
    ) {

        return false;

    }


    const ages =
        numbers.map(Number);


    const schoolMin =
        Math.min(...ages);

    const schoolMax =
        Math.max(...ages);


    if (
        range.min !== null &&
        schoolMax < range.min
    ) {

        return false;

    }


    if (
        range.max !== null &&
        schoolMin > range.max
    ) {

        return false;

    }


    return true;

}


/* =========================================================
   RENDER SCHOOLS
   ========================================================= */

function renderSchools() {

    markerLayer.clearLayers();


    const resultsCount =
        document.getElementById(
            "results-count"
        );


    resultsCount.textContent =
        `${filteredSchools.length} school${
            filteredSchools.length === 1
                ? ""
                : "s"
        } found`;


    filteredSchools.forEach(
        school => {

            createSchoolMarker(
                school
            );

        }
    );

}


/* =========================================================
   CREATE SCHOOL MARKER
   ========================================================= */

function createSchoolMarker(
    school
) {

    /*
     * The current database schema does not contain
     * latitude/longitude.
     *
     * This supports them if they are later added or
     * supplied by the geocoding system.
     */

    const latitude =
        getCoordinate(
            school,
            "latitude"
        );

    const longitude =
        getCoordinate(
            school,
            "longitude"
        );


    /*
     * Without coordinates there is nowhere to place the
     * marker yet.
     */

    if (
        latitude === null ||
        longitude === null
    ) {

        return;

    }


    const markerHtml = `
        <div class="school-marker">

            <div class="school-marker-dot"></div>

            <div class="school-marker-label">
                ${escapeHtml(
                    school.name ||
                    "Unnamed school"
                )}
            </div>

        </div>
    `;


    const icon =
        L.divIcon({

            className: "",

            html: markerHtml,

            iconSize: [0, 0],

            iconAnchor: [0, 0]

        });


    const marker =
        L.marker(
            [latitude, longitude],
            {
                icon
            }
        );


    marker.bindPopup(
        createSchoolPopup(
            school
        ),
        {
            maxWidth: 320,
            minWidth: 300,

            offset: [
                15,
                -5
            ]
        }
    );


    marker.on(
        "click",
        () => {

            selectedSchool =
                school;

        }
    );


    markerLayer.addLayer(
        marker
    );

}


/* =========================================================
   GET COORDINATE
   ========================================================= */

function getCoordinate(
    school,
    field
) {

    if (
        school[field] !== undefined &&
        school[field] !== null
    ) {

        const value =
            Number(
                school[field]
            );


        if (
            Number.isFinite(value)
        ) {

            return value;

        }

    }


    return null;

}


/* =========================================================
   SCHOOL POPUP
   ========================================================= */

function createSchoolPopup(
    school
) {

    const name =
        escapeHtml(
            school.name ||
            "Unnamed school"
        );


    const description =
        school.description
            ? escapeHtml(
                truncate(
                    school.description,
                    130
                )
            )
            : "No overview available.";


    const address =
        school.address
            ? escapeHtml(
                school.address
            )
            : "Address unavailable";


    return `
        <div class="school-popup">

            <h3>
                ${name}
            </h3>

            <p>
                ${description}
            </p>

            <p>
                <strong>Location:</strong>
                ${address}
            </p>

            <div class="popup-actions">

                <button
                    class="popup-details-button"
                    onclick="openSchoolDetails(${school.school_id})"
                    type="button"
                >
                    View details
                </button>

                <button
                    class="popup-tag-button"
                    onclick="openSchoolTags(${school.school_id})"
                    type="button"
                    title="Add tag"
                >
                    +
                </button>

            </div>

        </div>
    `;

}


/* =========================================================
   OPEN SCHOOL DETAILS
   ========================================================= */

function openSchoolDetails(
    schoolId
) {

    const school =
        schools.find(
            item =>
                Number(item.school_id) ===
                Number(schoolId)
        );


    if (!school) {
        return;
    }


    selectedSchool =
        school;


    const panel =
        document.getElementById(
            "school-details"
        );


    const content =
        document.getElementById(
            "school-details-content"
        );


    content.innerHTML =
        createSchoolDetails(
            school
        );


    panel.classList.add(
        "open"
    );

}


/* =========================================================
   SCHOOL DETAILS HTML
   ========================================================= */

function createSchoolDetails(
    school
) {

    const website =
        school.website
            ? `
                <a
                    href="${escapeAttribute(
                        school.website
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Visit website
                </a>
              `
            : "Not provided";


    return `

        <h2>
            ${escapeHtml(
                school.name ||
                "Unnamed school"
            )}
        </h2>

        <p class="details-description">
            ${
                escapeHtml(
                    school.description ||
                    "No description available."
                )
            }
        </p>


        <div class="detail-list">


            <div class="detail-item">

                <span class="detail-label">
                    Address
                </span>

                <span class="detail-value">
                    ${
                        escapeHtml(
                            school.address ||
                            "Not provided"
                        )
                    }
                </span>

            </div>


            <div class="detail-item">

                <span class="detail-label">
                    State / Province / Region
                </span>

                <span class="detail-value">
                    ${
                        escapeHtml(
                            school.state ||
                            "Not provided"
                        )
                    }
                </span>

            </div>


            <div class="detail-item">

                <span class="detail-label">
                    Sector
                </span>

                <span class="detail-value">
                    ${
                        escapeHtml(
                            school.sector ||
                            "Not provided"
                        )
                    }
                </span>

            </div>


            <div class="detail-item">

                <span class="detail-label">
                    Gender
                </span>

                <span class="detail-value">
                    ${
                        escapeHtml(
                            school.gender ||
                            "Not provided"
                        )
                    }
                </span>

            </div>


            <div class="detail-item">

                <span class="detail-label">
                    Ages
                </span>

                <span class="detail-value">
                    ${
                        escapeHtml(
                            school.allowed_ages ||
                            "Not provided"
                        )
                    }
                </span>

            </div>


            <div class="detail-item">

                <span class="detail-label">
                    Fees
                </span>

                <span class="detail-value">
                    ${
                        school.fee !== null
                            ? formatNumber(
                                school.fee
                            )
                            : "Not provided"
                    }
                </span>

            </div>


            <div class="detail-item">

                <span class="detail-label">
                    Enrolment
                </span>

                <span class="detail-value">
                    ${
                        school.enrolment !== null
                            ? formatNumber(
                                school.enrolment
                            )
                            : "Not provided"
                    }
                </span>

            </div>


            <div class="detail-item">

                <span class="detail-label">
                    Student–Teacher Ratio
                </span>

                <span class="detail-value">
                    ${
                        school.student_teacher_ratio !== null
                            ? school.student_teacher_ratio
                            : "Not provided"
                    }
                </span>

            </div>


            <div class="detail-item">

                <span class="detail-label">
                    Uniform
                </span>

                <span class="detail-value">
                    ${
                        escapeHtml(
                            school.uniform ||
                            "Not provided"
                        )
                    }
                </span>

            </div>


            <div class="detail-item">

                <span class="detail-label">
                    Enrolment Information
                </span>

                <span class="detail-value">
                    ${
                        escapeHtml(
                            school.enrolment_info ||
                            "Not provided"
                        )
                    }
                </span>

            </div>


            <div class="detail-item">

                <span class="detail-label">
                    Contact
                </span>

                <span class="detail-value">
                    ${
                        escapeHtml(
                            school.contact ||
                            "Not provided"
                        )
                    }
                </span>

            </div>


            <div class="detail-item">

                <span class="detail-label">
                    Website
                </span>

                <span class="detail-value">
                    ${website}
                </span>

            </div>


        </div>

    `;

}


/* =========================================================
   CLOSE DETAILS
   ========================================================= */

function initialiseDetailsPanel() {

    document
        .getElementById(
            "close-details"
        )
        .addEventListener(
            "click",
            () => {

                document
                    .getElementById(
                        "school-details"
                    )
                    .classList
                    .remove("open");

            }
        );

}


/* =========================================================
   TAG SYSTEM
   ========================================================= */

function openSchoolTags(
    schoolId
) {

    /*
     * Temporary implementation.
     *
     * The current Schools table does not contain tags.
     *
     * Once we create the tag tables, this button can open
     * the persistent Supabase tag interface.
     */

    const school =
        schools.find(
            item =>
                Number(item.school_id) ===
                Number(schoolId)
        );


    if (!school) {
        return;
    }


    alert(
        `Tags for ${school.name || "this school"} will be added here.`
    );

}


/* =========================================================
   CLEAR FILTERS
   ========================================================= */

function initialiseClearButton() {

    document
        .getElementById(
            "clear-filters"
        )
        .addEventListener(
            "click",
            clearFilters
        );

}


function clearFilters() {

    selectedStates = [];

    selectedSectors = [];


    document.getElementById(
        "state-filter"
    ).value = "";


    document.getElementById(
        "sector-filter"
    ).value = "";


    document.getElementById(
        "school-search"
    ).value = "";


    renderSelectedItems(
        "selected-states",
        [],
        "state"
    );


    renderSelectedItems(
        "selected-sectors",
        [],
        "sector"
    );


    Object.entries(
        rangeConfig
    ).forEach(
        ([name, config]) => {

            const minSlider =
                document.getElementById(
                    config.minSlider
                );

            const maxSlider =
                document.getElementById(
                    config.maxSlider
                );

            const minInput =
                document.getElementById(
                    config.minInput
                );

            const maxInput =
                document.getElementById(
                    config.maxInput
                );


            minSlider.value =
                config.minimum;

            maxSlider.value =
                config.maximum;


            minInput.value = "";

            maxInput.value = "";


            updateSliderTrack(
                minSlider,
                maxSlider
            );

        }
    );


    applyFilters();

}


/* =========================================================
   FORMATTING
   ========================================================= */

function formatNumber(
    value
) {

    return Number(value)
        .toLocaleString();

}


/* =========================================================
   TRUNCATE
   ========================================================= */

function truncate(
    text,
    length
) {

    if (
        text.length <= length
    ) {

        return text;

    }


    return text.substring(
        0,
        length
    ) + "...";

}


/* =========================================================
   HTML ESCAPING
   ========================================================= */

function escapeHtml(
    value
) {

    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );

}


function escapeAttribute(
    value
) {

    return escapeHtml(value);

}
