/* =========================================================
   EDUMATCH MAP
   ========================================================= */


/* =========================================================
   SUPABASE
   ========================================================= */

const SUPABASE_URL =
    "https://lwamtnocbxgostdrqhhz.supabase.co";

const SUPABASE_ANON_KEY =
    "YOUR_SUPABASE_ANON_KEY";


/* =========================================================
   GEOCODING
   ========================================================= */

/*
   This uses Nominatim for individual address searches.

   It is deliberately NOT used for autocomplete.
   The request only happens when the user submits an address.
*/

const GEOCODING_URL =
    "https://nominatim.openstreetmap.org/search";


/* =========================================================
   FILTER LIMITS
   ========================================================= */

const FILTER_LIMITS = {

    age: {
        min: 3,
        max: 25,
        step: 1
    },

    fee: {
        min: 0,
        max: 100000,
        step: 500
    },

    enrolment: {
        min: 0,
        max: 5000,
        step: 50
    },

    ratio: {
        min: 1,
        max: 50,
        step: 0.1
    },

    distance: {
        min: 0,
        max: 100,
        step: 1
    }

};


/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */

let map = null;

let schools = [];

let filteredSchools = [];

let markers = [];

let userLocationMarker = null;

let distanceCircle = null;

let userLatitude = null;

let userLongitude = null;

let selectedStates = [];

let selectedSectors = [];

let selectedGenders = [];


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initialiseMap();

        initialiseFilters();

        initialiseSearch();

        initialiseLocation();

        initialiseDetailsPanel();

        loadSchools();

    }
);


/* =========================================================
   MAP
   ========================================================= */

function initialiseMap() {

    map = L.map(
        "school-map",
        {
            worldCopyJump: false
        }
    );


    L.tileLayer(
        "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,

            noWrap: true,

            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(map);


    /*
       Start centred on Australia because that is
       currently where the project data is expected.
       The map itself is no longer restricted to Australia.
    */

    map.setView(
        [
            -37.8136,
            144.9631
        ],
        6
    );

}


/* =========================================================
   LOAD SCHOOLS
   ========================================================= */

async function loadSchools() {

    try {

        const response =
            await fetch(
                `${SUPABASE_URL}/rest/v1/Schools?select=*`,
                {
                    headers: {
                        "apikey":
                            SUPABASE_ANON_KEY,

                        "Authorization":
                            `Bearer ${SUPABASE_ANON_KEY}`,

                        "Content-Type":
                            "application/json"
                    }
                }
            );


        if (!response.ok) {

            throw new Error(
                `Supabase request failed: ${response.status}`
            );

        }


        schools =
            await response.json();


        schools =
            schools.map(
                normaliseSchool
            );


        populateStateOptions();

        applyFilters();


    } catch (error) {

        console.error(
            "Unable to load schools:",
            error
        );


        updateResultsCount(0);

    }

}


/* =========================================================
   NORMALISE SCHOOL
   ========================================================= */

function normaliseSchool(
    school
) {

    return {

        ...school,

        school_id:
            Number(
                school.school_id
            ),

        enrolment:
            school.enrolment !== null &&
            school.enrolment !== ""
                ? Number(
                    school.enrolment
                )
                : null,

        fee:
            school.fee !== null &&
            school.fee !== ""
                ? Number(
                    school.fee
                )
                : null,

        student_teacher_ratio:
            school.student_teacher_ratio !== null &&
            school.student_teacher_ratio !== ""
                ? Number(
                    school.student_teacher_ratio
                )
                : null,

        latitude:
            school.latitude !== null &&
            school.latitude !== ""
                ? Number(
                    school.latitude
                )
                : null,

        longitude:
            school.longitude !== null &&
            school.longitude !== ""
                ? Number(
                    school.longitude
                )
                : null

    };

}


/* =========================================================
   FILTER INITIALISATION
   ========================================================= */

function initialiseFilters() {


    initialiseDualSlider(
        "age",
        FILTER_LIMITS.age
    );


    initialiseDualSlider(
        "fee",
        FILTER_LIMITS.fee
    );


    initialiseDualSlider(
        "enrolment",
        FILTER_LIMITS.enrolment
    );


    initialiseDualSlider(
        "ratio",
        FILTER_LIMITS.ratio
    );


    initialiseDualSlider(
        "distance",
        FILTER_LIMITS.distance
    );


    /* -----------------------------------------------------
       STATE SEARCH
       ----------------------------------------------------- */

    const stateInput =
        document.getElementById(
            "state-search"
        );


    if (stateInput) {

        stateInput.addEventListener(
            "input",
            filterStateOptions
        );


        stateInput.addEventListener(
            "focus",
            () => {

                const options =
                    document.getElementById(
                        "state-options"
                    );


                if (options) {

                    options.classList.add(
                        "visible"
                    );

                }

            }
        );

    }


    /* -----------------------------------------------------
       SECTOR DROPDOWN
       ----------------------------------------------------- */

    const sectorButton =
        document.getElementById(
            "sector-dropdown-button"
        );


    if (sectorButton) {

        sectorButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();


                const options =
                    document.getElementById(
                        "sector-options"
                    );


                if (options) {

                    options.classList.toggle(
                        "open"
                    );

                }

            }
        );

    }


    /* -----------------------------------------------------
       GENDER DROPDOWN
       ----------------------------------------------------- */

    const genderButton =
        document.getElementById(
            "gender-dropdown-button"
        );


    if (genderButton) {

        genderButton.addEventListener(
            "click",
            event => {

                event.stopPropagation();


                const options =
                    document.getElementById(
                        "gender-options"
                    );


                if (options) {

                    options.classList.toggle(
                        "open"
                    );

                }

            }
        );

    }


    /* -----------------------------------------------------
       SECTOR CHECKBOXES
       ----------------------------------------------------- */

    document
        .querySelectorAll(
            '#sector-options input[type="checkbox"]'
        )
        .forEach(
            checkbox => {

                checkbox.addEventListener(
                    "change",
                    updateSectorFilter
                );

            }
        );


    /* -----------------------------------------------------
       GENDER CHECKBOXES
       ----------------------------------------------------- */

    document
        .querySelectorAll(
            '#gender-options input[type="checkbox"]'
        )
        .forEach(
            checkbox => {

                checkbox.addEventListener(
                    "change",
                    updateGenderFilter
                );

            }
        );


    /* -----------------------------------------------------
       CLEAR FILTERS
       ----------------------------------------------------- */

    const clearButton =
        document.getElementById(
            "clear-filters"
        );


    if (clearButton) {

        clearButton.addEventListener(
            "click",
            clearFilters
        );

    }


    /* -----------------------------------------------------
       CLOSE DROPDOWNS WHEN CLICKING OUTSIDE
       ----------------------------------------------------- */

    document.addEventListener(
        "click",
        event => {

            const stateContainer =
                document.querySelector(
                    ".search-select"
                );


            const sectorContainer =
                document.querySelector(
                    ".checkbox-dropdown.sector-dropdown"
                );


            const genderContainer =
                document.querySelector(
                    ".checkbox-dropdown.gender-dropdown"
                );


            /* State */

            if (
                stateContainer &&
                !stateContainer.contains(
                    event.target
                )
            ) {

                const options =
                    document.getElementById(
                        "state-options"
                    );


                if (options) {

                    options.classList.remove(
                        "visible"
                    );

                }

            }


            /* Sector */

            if (
                sectorContainer &&
                !sectorContainer.contains(
                    event.target
                )
            ) {

                const options =
                    document.getElementById(
                        "sector-options"
                    );


                if (options) {

                    options.classList.remove(
                        "open"
                    );

                }

            }


            /* Gender */

            if (
                genderContainer &&
                !genderContainer.contains(
                    event.target
                )
            ) {

                const options =
                    document.getElementById(
                        "gender-options"
                    );


                if (options) {

                    options.classList.remove(
                        "open"
                    );

                }

            }

        }
    );

}


/* =========================================================
   DUAL RANGE SLIDERS
   ========================================================= */

function initialiseDualSlider(
    name,
    limits
) {

    const minSlider =
        document.getElementById(
            `${name}-min-slider`
        );


    const maxSlider =
        document.getElementById(
            `${name}-max-slider`
        );


    const minInput =
        document.getElementById(
            `${name}-min`
        );


    const maxInput =
        document.getElementById(
            `${name}-max`
        );


    if (
        !minSlider ||
        !maxSlider ||
        !minInput ||
        !maxInput
    ) {

        return;

    }


    minSlider.min =
        limits.min;

    minSlider.max =
        limits.max;

    minSlider.step =
        limits.step;


    maxSlider.min =
        limits.min;

    maxSlider.max =
        limits.max;

    maxSlider.step =
        limits.step;


    minSlider.value =
        limits.min;

    maxSlider.value =
        limits.max;


    minInput.value =
        formatNumber(
            limits.min,
            limits.step
        );


    maxInput.value =
        formatNumber(
            limits.max,
            limits.step
        );


    updateSliderTrack(
        name,
        limits
    );


    /* -----------------------------------------------------
       MIN SLIDER
       ----------------------------------------------------- */

    minSlider.addEventListener(
        "input",
        () => {

            let minValue =
                Number(
                    minSlider.value
                );


            let maxValue =
                Number(
                    maxSlider.value
                );


            if (
                minValue >
                maxValue
            ) {

                minValue =
                    maxValue;

                minSlider.value =
                    minValue;

            }


            minInput.value =
                formatNumber(
                    minValue,
                    limits.step
                );


            updateSliderTrack(
                name,
                limits
            );


            if (
                name === "distance"
            ) {

                updateDistanceCircle();

            }


            applyFilters();

        }
    );


    /* -----------------------------------------------------
       MAX SLIDER
       ----------------------------------------------------- */

    maxSlider.addEventListener(
        "input",
        () => {

            let minValue =
                Number(
                    minSlider.value
                );


            let maxValue =
                Number(
                    maxSlider.value
                );


            if (
                maxValue <
                minValue
            ) {

                maxValue =
                    minValue;

                maxSlider.value =
                    maxValue;

            }


            maxInput.value =
                formatNumber(
                    maxValue,
                    limits.step
                );


            updateSliderTrack(
                name,
                limits
            );


            if (
                name === "distance"
            ) {

                updateDistanceCircle();

            }


            applyFilters();

        }
    );


    /* -----------------------------------------------------
       MIN TEXT INPUT
       ----------------------------------------------------- */

    minInput.addEventListener(
        "change",
        () => {

            let value =
                parseNumber(
                    minInput.value
                );


            value =
                clamp(
                    value,
                    limits.min,
                    limits.max
                );


            value =
                snapToStep(
                    value,
                    limits
                );


            const maxValue =
                Number(
                    maxSlider.value
                );


            if (
                value >
                maxValue
            ) {

                value =
                    maxValue;

            }


            minSlider.value =
                value;


            minInput.value =
                formatNumber(
                    value,
                    limits.step
                );


            updateSliderTrack(
                name,
                limits
            );


            if (
                name === "distance"
            ) {

                updateDistanceCircle();

            }


            applyFilters();

        }
    );


    /* -----------------------------------------------------
       MAX TEXT INPUT
       ----------------------------------------------------- */

    maxInput.addEventListener(
        "change",
        () => {

            let value =
                parseNumber(
                    maxInput.value
                );


            value =
                clamp(
                    value,
                    limits.min,
                    limits.max
                );


            value =
                snapToStep(
                    value,
                    limits
                );


            const minValue =
                Number(
                    minSlider.value
                );


            if (
                value <
                minValue
            ) {

                value =
                    minValue;

            }


            maxSlider.value =
                value;


            maxInput.value =
                formatNumber(
                    value,
                    limits.step
                );


            updateSliderTrack(
                name,
                limits
            );


            if (
                name === "distance"
            ) {

                updateDistanceCircle();

            }


            applyFilters();

        }
    );

}


/* =========================================================
   SLIDER TRACK
   ========================================================= */

function updateSliderTrack(
    name,
    limits
) {

    const minSlider =
        document.getElementById(
            `${name}-min-slider`
        );


    const maxSlider =
        document.getElementById(
            `${name}-max-slider`
        );


    const track =
        document.getElementById(
            `${name}-track`
        );


    if (
        !minSlider ||
        !maxSlider ||
        !track
    ) {

        return;

    }


    const minValue =
        Number(
            minSlider.value
        );


    const maxValue =
        Number(
            maxSlider.value
        );


    const range =
        limits.max -
        limits.min;


    const minPercent =
        (
            (minValue - limits.min) /
            range
        ) * 100;


    const maxPercent =
        (
            (maxValue - limits.min) /
            range
        ) * 100;


    track.style.setProperty(
        "--range-start",
        `${minPercent}%`
    );


    track.style.setProperty(
        "--range-end",
        `${maxPercent}%`
    );

}


/* =========================================================
   NUMBER HELPERS
   ========================================================= */

function parseNumber(
    value
) {

    const cleaned =
        String(value)
            .replace(
                /,/g,
                ""
            )
            .trim();


    const number =
        Number(cleaned);


    return Number.isFinite(
        number
    )
        ? number
        : 0;

}


function clamp(
    value,
    min,
    max
) {

    return Math.min(
        Math.max(
            value,
            min
        ),
        max
    );

}


function snapToStep(
    value,
    limits
) {

    const steps =
        Math.round(
            (
                value -
                limits.min
            ) /
            limits.step
        );


    return (
        limits.min +
        steps *
        limits.step
    );

}


function formatNumber(
    value,
    step
) {

    if (
        step < 1
    ) {

        return Number(
            value
        ).toFixed(1);

    }


    return Math.round(
        value
    );

}


/* =========================================================
   SEARCH
   ========================================================= */

function initialiseSearch() {

    const searchInput =
        document.getElementById(
            "school-search"
        );


    const searchButton =
        document.getElementById(
            "search-button"
        );


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            applyFilters
        );


        searchInput.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    applyFilters();

                }

            }
        );

    }


    if (searchButton) {

        searchButton.addEventListener(
            "click",
            applyFilters
        );

    }

}


/* =========================================================
   STATE OPTIONS
   ========================================================= */

function populateStateOptions() {

    const container =
        document.getElementById(
            "state-options"
        );


    if (!container) {
        return;
    }


    const states =
        [
            ...new Set(
                schools
                    .map(
                        school =>
                            school.state
                    )
                    .filter(
                        state =>
                            state &&
                            String(
                                state
                            ).trim()
                    )
                    .map(
                        state =>
                            String(
                                state
                            ).trim()
                    )
            )
        ]
        .sort(
            (a, b) =>
                a.localeCompare(b)
        );


    container.innerHTML = "";


    states.forEach(
        state => {

            const option =
                document.createElement(
                    "div"
                );


            option.className =
                "search-option";


            option.textContent =
                state;


            option.addEventListener(
                "click",
                () => {

                    if (
                        selectedStates.includes(
                            state
                        )
                    ) {

                        selectedStates =
                            selectedStates.filter(
                                item =>
                                    item !==
                                    state
                            );

                    } else {

                        selectedStates.push(
                            state
                        );

                    }


                    updateStateDisplay();

                    applyFilters();

                }
            );


            container.appendChild(
                option
            );

        }
    );

}


/* =========================================================
   STATE SEARCH
   ========================================================= */

function filterStateOptions() {

    const input =
        document.getElementById(
            "state-search"
        );


    const container =
        document.getElementById(
            "state-options"
        );


    if (
        !input ||
        !container
    ) {

        return;

    }


    const search =
        input.value
            .trim()
            .toLowerCase();


    container
        .querySelectorAll(
            ".search-option"
        )
        .forEach(
            option => {

                const text =
                    option.textContent
                        .toLowerCase();


                option.style.display =
                    text.includes(
                        search
                    )
                        ? "block"
                        : "none";

            }
        );


    container.classList.add(
        "visible"
    );

}


/* =========================================================
   STATE DISPLAY
   ========================================================= */

function updateStateDisplay() {

    const input =
        document.getElementById(
            "state-search"
        );


    if (!input) {
        return;
    }


    if (
        selectedStates.length ===
        0
    ) {

        input.placeholder =
            "Search states / regions worldwide...";

    } else {

        input.value =
            selectedStates.join(
                ", "
            );

    }

}


/* =========================================================
   SECTOR FILTER
   ========================================================= */

function updateSectorFilter() {

    selectedSectors =
        [
            ...document.querySelectorAll(
                '#sector-options input[type="checkbox"]:checked'
            )
        ]
        .map(
            checkbox =>
                checkbox.value
        );


    updateSectorDisplay();

    applyFilters();

}


function updateSectorDisplay() {

    const button =
        document.getElementById(
            "sector-dropdown-button"
        );


    if (!button) {
        return;
    }


    const text =
        button.querySelector(
            ".dropdown-text"
        );


    if (!text) {
        return;
    }


    const count =
        selectedSectors.length;


    if (
        count === 0
    ) {

        text.textContent =
            "All sectors";

    } else if (
        count === 1
    ) {

        text.textContent =
            "1 filter selected";

    } else {

        text.textContent =
            `${count} filters selected`;

    }

}


/* =========================================================
   GENDER FILTER
   ========================================================= */

function updateGenderFilter() {

    selectedGenders =
        [
            ...document.querySelectorAll(
                '#gender-options input[type="checkbox"]:checked'
            )
        ]
        .map(
            checkbox =>
                checkbox.value
        );


    updateGenderDisplay();

    applyFilters();

}


function updateGenderDisplay() {

    const button =
        document.getElementById(
            "gender-dropdown-button"
        );


    if (!button) {
        return;
    }


    const text =
        button.querySelector(
            ".dropdown-text"
        );


    if (!text) {
        return;
    }


    const count =
        selectedGenders.length;


    if (
        count === 0
    ) {

        text.textContent =
            "All genders";

    } else if (
        count === 1
    ) {

        text.textContent =
            "1 filter selected";

    } else {

        text.textContent =
            `${count} filters selected`;

    }

}


/* =========================================================
   APPLY FILTERS
   ========================================================= */

function applyFilters() {

    const searchInput =
        document.getElementById(
            "school-search"
        );


    const search =
        searchInput
            ? searchInput.value
                .trim()
                .toLowerCase()
            : "";


    const ageRange =
        getRange("age");


    const feeRange =
        getRange("fee");


    const enrolmentRange =
        getRange("enrolment");


    const ratioRange =
        getRange("ratio");


    const distanceRange =
        getRange("distance");


    filteredSchools =
        schools.filter(
            school => {


                /* -----------------------------------------
                   SEARCH
                   ----------------------------------------- */

                if (search) {

                    const searchableText =
                        [
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


                /* -----------------------------------------
                   STATE
                   ----------------------------------------- */

                if (
                    selectedStates.length >
                    0
                ) {

                    const schoolState =
                        String(
                            school.state ||
                            ""
                        ).trim();


                    if (
                        !selectedStates.includes(
                            schoolState
                        )
                    ) {

                        return false;

                    }

                }


                /* -----------------------------------------
                   SECTOR
                   ----------------------------------------- */

                if (
                    selectedSectors.length >
                    0
                ) {

                    const schoolSector =
                        String(
                            school.sector ||
                            ""
                        )
                        .trim()
                        .toLowerCase();


                    const matches =
                        selectedSectors.some(
                            selected =>
                                schoolSector ===
                                selected
                                    .toLowerCase()
                        );


                    if (!matches) {

                        return false;

                    }

                }


                /* -----------------------------------------
                   GENDER
                   ----------------------------------------- */

                if (
                    selectedGenders.length >
                    0
                ) {

                    const schoolGender =
                        String(
                            school.gender ||
                            ""
                        )
                        .trim()
                        .toLowerCase();


                    const matches =
                        selectedGenders.some(
                            selected =>
                                schoolGender ===
                                selected
                                    .toLowerCase()
                        );


                    if (!matches) {

                        return false;

                    }

                }


                /* -----------------------------------------
                   AGE
                   ----------------------------------------- */

                if (
                    school.allowed_ages &&
                    !ageMatches(
                        school.allowed_ages,
                        ageRange
                    )
                ) {

                    return false;

                }


                /* -----------------------------------------
                   FEE
                   ----------------------------------------- */

                if (
                    school.fee !== null &&
                    (
                        school.fee <
                        feeRange.min ||
                        school.fee >
                        feeRange.max
                    )
                ) {

                    return false;

                }


                /* -----------------------------------------
                   ENROLMENT
                   ----------------------------------------- */

                if (
                    school.enrolment !== null &&
                    (
                        school.enrolment <
                        enrolmentRange.min ||
                        school.enrolment >
                        enrolmentRange.max
                    )
                ) {

                    return false;

                }


                /* -----------------------------------------
                   STUDENT / TEACHER RATIO
                   ----------------------------------------- */

                if (
                    school.student_teacher_ratio !== null &&
                    (
                        school.student_teacher_ratio <
                        ratioRange.min ||
                        school.student_teacher_ratio >
                        ratioRange.max
                    )
                ) {

                    return false;

                }


                /* -----------------------------------------
                   DISTANCE
                   ----------------------------------------- */

                if (
                    userLatitude !== null &&
                    userLongitude !== null &&
                    school.latitude !== null &&
                    school.longitude !== null
                ) {

                    const distance =
                        calculateDistance(
                            userLatitude,
                            userLongitude,
                            school.latitude,
                            school.longitude
                        );


                    if (
                        distance <
                        distanceRange.min ||
                        distance >
                        distanceRange.max
                    ) {

                        return false;

                    }

                }


                return true;

            }
        );


    renderSchoolMarkers();

    updateResultsCount(
        filteredSchools.length
    );

}


/* =========================================================
   GET RANGE
   ========================================================= */

function getRange(
    name
) {

    const min =
        document.getElementById(
            `${name}-min-slider`
        );


    const max =
        document.getElementById(
            `${name}-max-slider`
        );


    return {

        min:
            min
                ? Number(
                    min.value
                )
                : FILTER_LIMITS[name].min,

        max:
            max
                ? Number(
                    max.value
                )
                : FILTER_LIMITS[name].max

    };

}


/* =========================================================
   AGE MATCHING
   ========================================================= */

function ageMatches(
    allowedAges,
    range
) {

    const text =
        String(
            allowedAges
        ).toLowerCase();


    const numbers =
        text.match(
            /\d+(?:\.\d+)?/g
        );


    if (
        !numbers ||
        numbers.length === 0
    ) {

        return true;

    }


    const ages =
        numbers.map(
            Number
        );


    const schoolMin =
        Math.min(
            ...ages
        );


    const schoolMax =
        Math.max(
            ...ages
        );


    return (
        schoolMax >= range.min &&
        schoolMin <= range.max
    );

}


/* =========================================================
   DISTANCE CALCULATION
   ========================================================= */

function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const earthRadius =
        6371;


    const dLat =
        toRadians(
            lat2 - lat1
        );


    const dLon =
        toRadians(
            lon2 - lon1
        );


    const a =
        Math.sin(
            dLat / 2
        ) ** 2 +

        Math.cos(
            toRadians(lat1)
        ) *

        Math.cos(
            toRadians(lat2)
        ) *

        Math.sin(
            dLon / 2
        ) ** 2;


    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(
                1 - a
            )
        );


    return (
        earthRadius *
        c
    );

}


function toRadians(
    degrees
) {

    return (
        degrees *
        Math.PI /
        180
    );

}


/* =========================================================
   RENDER SCHOOL MARKERS
   ========================================================= */

function renderSchoolMarkers() {

    markers.forEach(
        marker =>
            map.removeLayer(
                marker
            )
    );


    markers = [];


    filteredSchools.forEach(
        school => {

            const latitude =
                Number(
                    school.latitude
                );


            const longitude =
                Number(
                    school.longitude
                );


            if (
                !Number.isFinite(
                    latitude
                ) ||
                !Number.isFinite(
                    longitude
                )
            ) {

                return;

            }


            const icon =
                L.divIcon({

                    className:
                        "custom-school-icon",

                    html: `
                        <div class="school-marker">

                            <span class="school-marker-dot"></span>

                            <span class="school-marker-label">
                                ${escapeHTML(
                                    school.name ||
                                    "School"
                                )}
                            </span>

                        </div>
                    `,

                    iconSize:
                        null,

                    iconAnchor:
                        [
                            0,
                            0
                        ]

                });


            const marker =
                L.marker(
                    [
                        latitude,
                        longitude
                    ],
                    {
                        icon
                    }
                )
                .addTo(map);


            marker.bindPopup(
                createSchoolPopup(
                    school
                ),
                {
                    closeButton:
                        true,

                    maxWidth:
                        320,

                    minWidth:
                        260
                }
            );


            marker.on(
                "popupopen",
                event => {

                    const popup =
                        event.popup
                            .getElement();


                    if (!popup) {
                        return;
                    }


                    const viewButton =
                        popup.querySelector(
                            ".view-school-button"
                        );


                    if (viewButton) {

                        viewButton.addEventListener(
                            "click",
                            () => {

                                openSchoolDetails(
                                    school
                                );

                            }
                        );

                    }


                    const tagButton =
                        popup.querySelector(
                            ".school-tag-button"
                        );


                    if (tagButton) {

                        tagButton.addEventListener(
                            "click",
                            () => {

                                openSchoolTags(
                                    school
                                );

                            }
                        );

                    }

                }
            );


            markers.push(
                marker
            );

        }
    );

}


/* =========================================================
   SCHOOL POPUP
   ========================================================= */

function createSchoolPopup(
    school
) {

    return `

        <div class="school-popup">

            <div class="school-popup-header">

                <div>

                    <h3>
                        ${escapeHTML(
                            school.name ||
                            "School"
                        )}
                    </h3>

                    <p>
                        ${escapeHTML(
                            school.address ||
                            school.state ||
                            "Location unavailable"
                        )}
                    </p>

                </div>


                <button
                    type="button"
                    class="school-tag-button"
                    title="Add tag"
                >
                    +
                </button>

            </div>


            <p class="school-popup-description">

                ${escapeHTML(
                    school.description ||
                    "No overview is available for this school."
                )}

            </p>


            <button
                type="button"
                class="view-school-button"
            >
                View details
            </button>

        </div>

    `;

}


/* =========================================================
   DETAILS PANEL
   ========================================================= */

function initialiseDetailsPanel() {

    const closeButton =
        document.getElementById(
            "close-details"
        );


    if (closeButton) {

        closeButton.addEventListener(
            "click",
            closeSchoolDetails
        );

    }

}


function openSchoolDetails(
    school
) {

    const panel =
        document.getElementById(
            "school-details"
        );


    const content =
        document.getElementById(
            "school-details-content"
        );


    if (
        !panel ||
        !content
    ) {

        return;

    }


    content.innerHTML = `

        <h2>
            ${escapeHTML(
                school.name ||
                "School"
            )}
        </h2>


        <p class="details-description">

            ${escapeHTML(
                school.description ||
                "No description available."
            )}

        </p>


        <div class="detail-list">

            ${createDetail(
                "Address",
                school.address
            )}

            ${createDetail(
                "State / Region",
                school.state
            )}

            ${createDetail(
                "Sector",
                school.sector
            )}

            ${createDetail(
                "Gender",
                school.gender
            )}

            ${createDetail(
                "Age Range",
                school.allowed_ages
            )}

            ${createDetail(
                "Fees",
                school.fee !== null
                    ? `$${Number(
                        school.fee
                    ).toLocaleString()}`
                    : null
            )}

            ${createDetail(
                "Enrolment",
                school.enrolment !== null
                    ? Number(
                        school.enrolment
                    ).toLocaleString()
                    : null
            )}

            ${createDetail(
                "Student–Teacher Ratio",
                school.student_teacher_ratio
                    ? String(
                        school.student_teacher_ratio
                    )
                    : null
            )}

            ${createDetail(
                "Uniform",
                school.uniform
            )}

            ${createDetail(
                "Enrolment Information",
                school.enrolment_info
            )}

            ${createDetail(
                "Contact",
                school.contact
            )}

            ${createWebsiteDetail(
                school.website
            )}

        </div>

    `;


    panel.classList.add(
        "open"
    );

}


function closeSchoolDetails() {

    const panel =
        document.getElementById(
            "school-details"
        );


    if (panel) {

        panel.classList.remove(
            "open"
        );

    }

}


/* =========================================================
   DETAIL HELPERS
   ========================================================= */

function createDetail(
    label,
    value
) {

    if (
        value === null ||
        value === undefined ||
        String(value).trim() === ""
    ) {

        return "";

    }


    return `

        <div class="detail-item">

            <span class="detail-label">
                ${escapeHTML(
                    label
                )}
            </span>

            <span class="detail-value">
                ${escapeHTML(
                    String(value)
                )}
            </span>

        </div>

    `;

}


function createWebsiteDetail(
    website
) {

    if (
        !website ||
        String(website).trim() === ""
    ) {

        return "";

    }


    let url =
        String(
            website
        ).trim();


    if (
        !url.startsWith(
            "http://"
        ) &&
        !url.startsWith(
            "https://"
        )
    ) {

        url =
            `https://${url}`;

    }


    return `

        <div class="detail-item">

            <span class="detail-label">
                Website
            </span>

            <span class="detail-value">

                <a
                    href="${escapeAttribute(
                        url
                    )}"
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    Visit website
                </a>

            </span>

        </div>

    `;

}


/* =========================================================
   TAGS
   ========================================================= */

function openSchoolTags(
    school
) {

    /*
       Tags have not yet been connected to Supabase.
    */

    console.log(
        "Tags for school:",
        school.school_id
    );

}


/* =========================================================
   LOCATION INITIALISATION
   ========================================================= */

function initialiseLocation() {

    const currentLocationButton =
        document.getElementById(
            "current-location-button"
        );


    const locationInput =
        document.getElementById(
            "location-input"
        );


    if (
        currentLocationButton
    ) {

        currentLocationButton.addEventListener(
            "click",
            requestCurrentLocation
        );

    }


    if (
        locationInput
    ) {

        locationInput.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Enter"
                ) {

                    event.preventDefault();

                    geocodeAddress();

                }

            }
        );

    }

}


/* =========================================================
   CURRENT LOCATION
   ========================================================= */

function requestCurrentLocation() {

    if (
        !navigator.geolocation
    ) {

        alert(
            "Geolocation is not supported by your browser."
        );

        return;

    }


    const button =
        document.getElementById(
            "current-location-button"
        );


    if (button) {

        button.disabled =
            true;

        button.textContent =
            "Getting location...";

    }


    navigator.geolocation.getCurrentPosition(

        position => {

            setUserLocation(
                position.coords.latitude,
                position.coords.longitude
            );


            if (button) {

                button.disabled =
                    false;

                button.textContent =
                    "Current Location";

            }

        },

        error => {

            console.error(
                "Geolocation error:",
                error
            );


            if (button) {

                button.disabled =
                    false;

                button.textContent =
                    "Current Location";

            }


            if (
                error.code ===
                error.PERMISSION_DENIED
            ) {

                alert(
                    "Location access was denied. Please allow location access for this website in your browser settings."
                );

            } else if (
                error.code ===
                error.POSITION_UNAVAILABLE
            ) {

                alert(
                    "Your location could not be determined."
                );

            } else if (
                error.code ===
                error.TIMEOUT
            ) {

                alert(
                    "Getting your location timed out. Please try again."
                );

            } else {

                alert(
                    "Unable to get your current location."
                );

            }

        },

        {
            enableHighAccuracy:
                true,

            timeout:
                10000,

            maximumAge:
                0
        }

    );

}


/* =========================================================
   SET USER LOCATION
   ========================================================= */

function setUserLocation(
    latitude,
    longitude
) {

    userLatitude =
        Number(
            latitude
        );


    userLongitude =
        Number(
            longitude
        );


    if (
        !Number.isFinite(
            userLatitude
        ) ||
        !Number.isFinite(
            userLongitude
        )
    ) {

        return;

    }


    updateLocationInput();


    /* Move map */

    map.setView(
        [
            userLatitude,
            userLongitude
        ],
        13
    );


    /* User marker */

    if (
        userLocationMarker
    ) {

        userLocationMarker.setLatLng(
            [
                userLatitude,
                userLongitude
            ]
        );

    } else {

        const locationIcon =
            L.divIcon({

                className:
                    "user-location-icon",

                html: `

                    <div class="user-location-marker">

                        <div class="user-location-dot"></div>

                    </div>

                `,

                iconSize:
                    [
                        24,
                        24
                    ],

                iconAnchor:
                    [
                        12,
                        12
                    ]

            });


        userLocationMarker =
            L.marker(
                [
                    userLatitude,
                    userLongitude
                ],
                {
                    icon:
                        locationIcon,

                    zIndexOffset:
                        1000
                }
            )
            .addTo(map)
            .bindPopup(
                "Your location"
            );

    }


    updateDistanceCircle();

    applyFilters();

}


/* =========================================================
   UPDATE LOCATION INPUT
   ========================================================= */

function updateLocationInput() {

    const input =
        document.getElementById(
            "location-input"
        );


    if (!input) {
        return;
    }


    input.value =
        `${userLatitude.toFixed(5)}, ${userLongitude.toFixed(5)}`;

}


/* =========================================================
   GEOCODE TYPED ADDRESS
   ========================================================= */

async function geocodeAddress() {

    const input =
        document.getElementById(
            "location-input"
        );


    if (!input) {
        return;
    }


    const address =
        input.value.trim();


    if (!address) {

        alert(
            "Please enter an address or location."
        );

        return;

    }


    const originalValue =
        input.value;


    input.disabled =
        true;


    input.value =
        "Finding location...";


    try {

        const url =
            `${GEOCODING_URL}?format=jsonv2&limit=1&q=${encodeURIComponent(
                address
            )}`;


        const response =
            await fetch(
                url,
                {
                    headers: {
                        "Accept":
                            "application/json"
                    }
                }
            );


        if (!response.ok) {

            throw new Error(
                `Geocoding request failed: ${response.status}`
            );

        }


        const results =
            await response.json();


        if (
            !results ||
            results.length === 0
        ) {

            throw new Error(
                "No matching location found."
            );

        }


        const result =
            results[0];


        const latitude =
            Number(
                result.lat
            );


        const longitude =
            Number(
                result.lon
            );


        if (
            !Number.isFinite(
                latitude
            ) ||
            !Number.isFinite(
                longitude
            )
        ) {

            throw new Error(
                "The location returned invalid coordinates."
            );

        }


        userLatitude =
            latitude;

        userLongitude =
            longitude;


        input.value =
            result.display_name ||
            originalValue;


        setUserLocation(
            latitude,
            longitude
        );


    } catch (error) {

        console.error(
            "Address geocoding error:",
            error
        );


        input.value =
            originalValue;


        alert(
            "We couldn't find that location. Please try entering a more specific address."
        );


    } finally {

        input.disabled =
            false;

    }

}


/* =========================================================
   DISTANCE CIRCLE
   ========================================================= */

function updateDistanceCircle() {

    if (
        !map ||
        userLatitude === null ||
        userLongitude === null
    ) {

        return;

    }


    const distanceRange =
        getRange(
            "distance"
        );


    /*
       The maximum distance is used as
       the radius of the visible circle.
    */

    const radiusMetres =
        distanceRange.max *
        1000;


    if (
        distanceCircle
    ) {

        distanceCircle.setLatLng(
            [
                userLatitude,
                userLongitude
            ]
        );


        distanceCircle.setRadius(
            radiusMetres
        );

    } else {

        distanceCircle =
            L.circle(
                [
                    userLatitude,
                    userLongitude
                ],
                {
                    radius:
                        radiusMetres,

                    className:
                        "distance-circle",

                    weight:
                        2,

                    fillOpacity:
                        0.08
                }
            )
            .addTo(map);

    }

}


/* =========================================================
   CLEAR FILTERS
   ========================================================= */

function clearFilters() {

    selectedStates =
        [];

    selectedSectors =
        [];

    selectedGenders =
        [];


    const searchInput =
        document.getElementById(
            "school-search"
        );


    if (searchInput) {

        searchInput.value =
            "";

    }


    const stateInput =
        document.getElementById(
            "state-search"
        );


    if (stateInput) {

        stateInput.value =
            "";

        stateInput.placeholder =
            "Search states / regions worldwide...";

    }


    document
        .querySelectorAll(
            '#sector-options input[type="checkbox"]'
        )
        .forEach(
            checkbox =>
                checkbox.checked =
                    false
        );


    document
        .querySelectorAll(
            '#gender-options input[type="checkbox"]'
        )
        .forEach(
            checkbox =>
                checkbox.checked =
                    false
        );


    Object.entries(
        FILTER_LIMITS
    ).forEach(
        ([name, limits]) => {

            const minSlider =
                document.getElementById(
                    `${name}-min-slider`
                );


            const maxSlider =
                document.getElementById(
                    `${name}-max-slider`
                );


            const minInput =
                document.getElementById(
                    `${name}-min`
                );


            const maxInput =
                document.getElementById(
                    `${name}-max`
                );


            if (minSlider) {

                minSlider.value =
                    limits.min;

            }


            if (maxSlider) {

                maxSlider.value =
                    limits.max;

            }


            if (minInput) {

                minInput.value =
                    formatNumber(
                        limits.min,
                        limits.step
                    );

            }


            if (maxInput) {

                maxInput.value =
                    formatNumber(
                        limits.max,
                        limits.step
                    );

            }


            updateSliderTrack(
                name,
                limits
            );

        }
    );


    updateSectorDisplay();

    updateGenderDisplay();

    updateStateDisplay();

    updateDistanceCircle();

    applyFilters();

}


/* =========================================================
   RESULTS
   ========================================================= */

function updateResultsCount(
    count
) {

    const result =
        document.getElementById(
            "results-count"
        );


    if (!result) {
        return;
    }


    result.textContent =
        `${count} school${
            count === 1
                ? ""
                : "s"
        } found`;

}


/* =========================================================
   HTML SECURITY
   ========================================================= */

function escapeHTML(
    value
) {

    return String(
        value
    )
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

    return escapeHTML(
        value
    );

}
