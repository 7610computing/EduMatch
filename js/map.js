/* =========================================================
   EDUMATCH SCHOOL MAP
   ========================================================= */

const SUPABASE_URL =
    "https://lwamtnocbxgostdrqhhz.supabase.co";

const SUPABASE_ANON_KEY =
    "YOUR_SUPABASE_ANON_KEY";


let schools = [];
let filteredSchools = [];

let map = null;
let markerLayer = null;

let selectedStates = [];
let selectedSectors = [];
let selectedGenders = [];

let userLocation = null;


/* =========================================================
   RANGE CONFIGURATION
   ========================================================= */

const rangeConfig = {

    age: {
        minInput: "age-min",
        maxInput: "age-max",
        minSlider: "age-slider-min",
        maxSlider: "age-slider-max",
        minimum: 3,
        maximum: 25
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
        maximum: 5000
    },

    ratio: {
        minInput: "ratio-min",
        maxInput: "ratio-max",
        minSlider: "ratio-slider-min",
        maxSlider: "ratio-slider-max",
        minimum: 1,
        maximum: 50
    },

    distance: {
        minInput: "distance-min",
        maxInput: "distance-max",
        minSlider: "distance-slider-min",
        maxSlider: "distance-slider-max",
        minimum: 0,
        maximum: 100
    }

};


/* =========================================================
   INITIALISE
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        initialiseMap();

        initialiseRangeFilters();

        initialiseDropdowns();

        initialiseStateSearch();

        initialiseSchoolSearch();

        initialiseLocation();

        initialiseClearButton();

        initialiseDetailsPanel();

        await loadSchools();

    }
);


/* =========================================================
   MAP
   ========================================================= */

function initialiseMap() {

    map = L.map(
        "school-map",
        {
            worldCopyJump: false,

            maxBounds: [
                [-60, 100],
                [15, 180]
            ],

            maxBoundsViscosity: 1
        }
    );


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
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(map);


    markerLayer =
        L.layerGroup().addTo(map);

}


/* =========================================================
   LOAD SCHOOLS
   ========================================================= */

async function loadSchools() {

    const results =
        document.getElementById(
            "results-count"
        );


    results.textContent =
        "Loading schools...";


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
                `Supabase error ${response.status}`
            );

        }


        schools =
            await response.json();


        schools =
            schools.map(
                normaliseSchool
            );


        createStateOptions();

        applyFilters();


    } catch (error) {

        console.error(error);

        results.textContent =
            "Unable to load schools.";

    }

}


/* =========================================================
   NORMALISE
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

        fee:
            toNumber(
                school.fee
            ),

        enrolment:
            toNumber(
                school.enrolment
            ),

        student_teacher_ratio:
            toNumber(
                school.student_teacher_ratio
            )

    };

}


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
   STATE SEARCH
   ========================================================= */

function createStateOptions() {

    const states = [
        ...new Set(
            schools
                .map(
                    school =>
                        school.state
                )
                .filter(Boolean)
                .map(
                    value =>
                        value.trim()
                )
        )
    ];


    states.sort(
        (a, b) =>
            a.localeCompare(b)
    );


    const container =
        document.getElementById(
            "state-options"
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


            option.dataset.value =
                state;


            option.addEventListener(
                "click",
                () => {

                    if (
                        !selectedStates
                            .includes(state)
                    ) {

                        selectedStates
                            .push(state);

                    }


                    document.getElementById(
                        "state-filter"
                    ).value = "";


                    container.classList
                        .remove(
                            "visible"
                        );


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
   STATE SEARCH INPUT
   ========================================================= */

function initialiseStateSearch() {

    const input =
        document.getElementById(
            "state-filter"
        );

    const options =
        document.getElementById(
            "state-options"
        );


    input.addEventListener(
        "focus",
        () => {

            options.classList.add(
                "visible"
            );

        }
    );


    input.addEventListener(
        "input",
        () => {

            const search =
                input.value
                    .toLowerCase();


            options
                .querySelectorAll(
                    ".search-option"
                )
                .forEach(
                    option => {

                        const matches =
                            option.dataset.value
                                .toLowerCase()
                                .includes(search);


                        option.style.display =
                            matches
                                ? "block"
                                : "none";

                    }
                );


            options.classList.add(
                "visible"
            );

        }
    );


    document.addEventListener(
        "click",
        event => {

            if (
                !event.target.closest(
                    ".search-select"
                )
            ) {

                options.classList
                    .remove(
                        "visible"
                    );

            }

        }
    );

}


/* =========================================================
   DROPDOWNS
   ========================================================= */

function initialiseDropdowns() {

    setupDropdown(
        "sector-dropdown-button",
        "sector-options"
    );

    setupDropdown(
        "gender-dropdown-button",
        "gender-options"
    );


    document
        .querySelectorAll(
            '.checkbox-options input[type="checkbox"]'
        )
        .forEach(
            checkbox => {

                checkbox.addEventListener(
                    "change",
                    () => {

                        updateCheckboxFilters();

                    }
                );

            }
        );

}


function setupDropdown(
    buttonId,
    optionsId
) {

    const button =
        document.getElementById(
            buttonId
        );

    const options =
        document.getElementById(
            optionsId
        );


    button.addEventListener(
        "click",
        event => {

            event.stopPropagation();

            options.classList.toggle(
                "open"
            );

        }
    );


    document.addEventListener(
        "click",
        event => {

            if (
                !event.target.closest(
                    ".checkbox-dropdown"
                )
            ) {

                options.classList.remove(
                    "open"
                );

            }

        }
    );

}


/* =========================================================
   CHECKBOX FILTERS
   ========================================================= */

function updateCheckboxFilters() {

    selectedSectors =
        getCheckedValues(
            "sector"
        );


    selectedGenders =
        getCheckedValues(
            "gender"
        );


    updateDropdownText(
        "sector-dropdown-button",
        selectedSectors,
        "Select sector"
    );


    updateDropdownText(
        "gender-dropdown-button",
        selectedGenders,
        "Select gender"
    );


    applyFilters();

}


function getCheckedValues(
    filterType
) {

    return [
        ...document.querySelectorAll(
            `input[data-filter="${filterType}"]:checked`
        )
    ]
        .map(
            checkbox =>
                checkbox.value
        );

}


function updateDropdownText(
    buttonId,
    values,
    defaultText
) {

    const button =
        document.getElementById(
            buttonId
        );


    const text =
        button.querySelector(
            "span"
        );


    if (values.length === 0) {

        text.textContent =
            defaultText;

    } else {

        text.textContent =
            values.join(", ");

    }

}


/* =========================================================
   SCHOOL SEARCH
   ========================================================= */

function initialiseSchoolSearch() {

    const input =
        document.getElementById(
            "school-search"
        );


    input.addEventListener(
        "input",
        applyFilters
    );


    document
        .getElementById(
            "search-button"
        )
        .addEventListener(
            "click",
            applyFilters
        );

}


/* =========================================================
   LOCATION
   ========================================================= */

function initialiseLocation() {

    document
        .getElementById(
            "current-location-button"
        )
        .addEventListener(
            "click",
            getCurrentLocation
        );


    document
        .getElementById(
            "location-input"
        )
        .addEventListener(
            "change",
            () => {

                /*
                 * Geocoding will be connected here.
                 *
                 * The address should eventually be converted
                 * into latitude/longitude and stored in
                 * userLocation.
                 */

                console.log(
                    "Location entered:",
                    document.getElementById(
                        "location-input"
                    ).value
                );

            }
        );

}


function getCurrentLocation() {

    if (
        !navigator.geolocation
    ) {

        alert(
            "Location services are not supported by this browser."
        );

        return;

    }


    const button =
        document.getElementById(
            "current-location-button"
        );


    button.textContent =
        "Finding location...";


    navigator.geolocation.getCurrentPosition(

        position => {

            userLocation = {

                latitude:
                    position.coords.latitude,

                longitude:
                    position.coords.longitude

            };


            button.textContent =
                "Location Found";


            map.setView(
                [
                    userLocation.latitude,
                    userLocation.longitude
                ],
                12
            );


            applyFilters();

        },

        error => {

            console.error(error);

            button.textContent =
                "Current Location";


            alert(
                "Unable to access your current location."
            );

        }

    );

}


/* =========================================================
   RANGE FILTERS
   ========================================================= */

function initialiseRangeFilters() {

    Object.values(
        rangeConfig
    ).forEach(
        config => {

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
                        Number(minSlider.value) ===
                        config.minimum
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
                        Number(maxSlider.value) ===
                        config.maximum
                            ? ""
                            : maxSlider.value;


                    updateSliderTrack(
                        minSlider,
                        maxSlider
                    );


                    applyFilters();

                }
            );


            minInput.addEventListener(
                "change",
                () => {

                    let value =
                        parseFloat(
                            minInput.value
                        );


                    if (
                        Number.isNaN(value)
                    ) {

                        value =
                            config.minimum;

                    }


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


                    updateSliderTrack(
                        minSlider,
                        maxSlider
                    );


                    applyFilters();

                }
            );


            maxInput.addEventListener(
                "change",
                () => {

                    let value =
                        parseFloat(
                            maxInput.value
                        );


                    if (
                        Number.isNaN(value)
                    ) {

                        value =
                            config.maximum;

                    }


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
   SLIDER TRACK
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
   APPLY FILTERS
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


                /* SEARCH */

                if (search) {

                    const text = [

                        school.name,

                        school.address,

                        school.state,

                        school.description

                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();


                    if (
                        !text.includes(search)
                    ) {

                        return false;

                    }

                }


                /* STATE */

                if (
                    selectedStates.length > 0 &&
                    !selectedStates.includes(
                        school.state
                    )
                ) {

                    return false;

                }


                /* SECTOR */

                if (
                    selectedSectors.length > 0 &&
                    !selectedSectors.includes(
                        school.sector
                    )
                ) {

                    return false;

                }


                /* GENDER */

                if (
                    selectedGenders.length > 0 &&
                    !selectedGenders.includes(
                        school.gender
                    )
                ) {

                    return false;

                }


                /* AGE */

                if (
                    !schoolMatchesAge(
                        school,
                        ageRange
                    )
                ) {

                    return false;

                }


                /* FEE */

                if (
                    !matchesRange(
                        school.fee,
                        feeRange
                    )
                ) {

                    return false;

                }


                /* ENROLMENT */

                if (
                    !matchesRange(
                        school.enrolment,
                        enrolmentRange
                    )
                ) {

                    return false;

                }


                /* RATIO */

                if (
                    !matchesRange(
                        school.student_teacher_ratio,
                        ratioRange
                    )
                ) {

                    return false;

                }


                /*
                 * DISTANCE
                 *
                 * This only activates once userLocation
                 * and school coordinates are available.
                 */

                if (
                    userLocation &&
                    !matchesDistance(
                        school,
                        distanceRange
                    )
                ) {

                    return false;

                }


                return true;

            }
        );


    renderSchools();

}


/* =========================================================
   RANGE
   ========================================================= */

function getRange(name) {

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

function matchesRange(
    value,
    range
) {

    if (
        value === null
    ) {

        return (
            range.min === null &&
            range.max === null
        );

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
   AGE
   ========================================================= */

function schoolMatchesAge(
    school,
    range
) {

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


    if (!numbers) {

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
   DISTANCE
   ========================================================= */

function matchesDistance(
    school,
    range
) {

    const latitude =
        Number(
            school.latitude
        );

    const longitude =
        Number(
            school.longitude
        );


    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {

        return false;

    }


    const distance =
        calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            latitude,
            longitude
        );


    return matchesRange(
        distance,
        range
    );

}


/* =========================================================
   HAVERSINE DISTANCE
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
        Math.sin(dLat / 2) ** 2 +
        Math.cos(
            toRadians(lat1)
        ) *
        Math.cos(
            toRadians(lat2)
        ) *
        Math.sin(dLon / 2) ** 2;


    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return earthRadius * c;

}


function toRadians(
    degrees
) {

    return degrees *
        Math.PI /
        180;

}


/* =========================================================
   RENDER
   ========================================================= */

function renderSchools() {

    markerLayer.clearLayers();


    document.getElementById(
        "results-count"
    ).textContent =
        `${filteredSchools.length} school${
            filteredSchools.length === 1
                ? ""
                : "s"
        } found`;


    filteredSchools.forEach(
        createSchoolMarker
    );

}


/* =========================================================
   MARKERS
   ========================================================= */

function createSchoolMarker(
    school
) {

    const latitude =
        Number(
            school.latitude
        );

    const longitude =
        Number(
            school.longitude
        );


    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude)
    ) {

        return;

    }


    const icon =
        L.divIcon({

            className: "",

            html: `
                <div class="school-marker">

                    <div
                        class="school-marker-dot">
                    </div>

                    <div
                        class="school-marker-label">

                        ${escapeHtml(
                            school.name ||
                            "Unnamed school"
                        )}

                    </div>

                </div>
            `,

            iconSize: [0, 0],

            iconAnchor: [0, 0]

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
        );


    marker.bindPopup(
        createPopup(
            school
        ),
        {
            minWidth: 280,

            maxWidth: 300,

            offset: [
                12,
                -5
            ]
        }
    );


    markerLayer.addLayer(
        marker
    );

}


/* =========================================================
   POPUP
   ========================================================= */

function createPopup(
    school
) {

    return `

        <div class="school-popup">

            <h3>
                ${escapeHtml(
                    school.name ||
                    "Unnamed school"
                )}
            </h3>

            <p>
                ${
                    escapeHtml(
                        school.description ||
                        "No overview available."
                    )
                }
            </p>

            <p>
                ${
                    escapeHtml(
                        school.address ||
                        "Address unavailable"
                    )
                }
            </p>

            <div class="popup-actions">

                <button
                    onclick="openSchoolDetails(
                        ${school.school_id}
                    )"
                >
                    View details
                </button>

                <button
                    onclick="openSchoolTags(
                        ${school.school_id}
                    )"
                >
                    +
                </button>

            </div>

        </div>

    `;

}


/* =========================================================
   DETAILS
   ========================================================= */

function openSchoolDetails(
    schoolId
) {

    const school =
        schools.find(
            item =>
                Number(
                    item.school_id
                ) === Number(schoolId)
        );


    if (!school) {
        return;
    }


    document.getElementById(
        "school-details-content"
    ).innerHTML = `

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

            ${detail(
                "Address",
                school.address
            )}

            ${detail(
                "State / Province / Region",
                school.state
            )}

            ${detail(
                "Sector",
                school.sector
            )}

            ${detail(
                "Gender",
                school.gender
            )}

            ${detail(
                "Ages",
                school.allowed_ages
            )}

            ${detail(
                "Fees",
                school.fee
            )}

            ${detail(
                "Enrolment",
                school.enrolment
            )}

            ${detail(
                "Student–Teacher Ratio",
                school.student_teacher_ratio
            )}

            ${detail(
                "Uniform",
                school.uniform
            )}

            ${detail(
                "Enrolment Information",
                school.enrolment_info
            )}

            ${detail(
                "Contact",
                school.contact
            )}

        </div>

    `;


    document.getElementById(
        "school-details"
    ).classList.add(
        "open"
    );

}


function detail(
    label,
    value
) {

    return `

        <div class="detail-item">

            <span class="detail-label">
                ${label}
            </span>

            <span class="detail-value">
                ${
                    value === null ||
                    value === undefined ||
                    value === ""
                        ? "Not provided"
                        : escapeHtml(value)
                }
            </span>

        </div>

    `;

}


/* =========================================================
   TAGS
   ========================================================= */

function openSchoolTags(
    schoolId
) {

    console.log(
        "Open tags for school:",
        schoolId
    );

}


/* =========================================================
   CLOSE DETAILS
   ========================================================= */

function initialiseDetailsPanel() {

    document.getElementById(
        "close-details"
    ).addEventListener(
        "click",
        () => {

            document.getElementById(
                "school-details"
            ).classList.remove(
                "open"
            );

        }
    );

}


/* =========================================================
   CLEAR
   ========================================================= */

function initialiseClearButton() {

    document.getElementById(
        "clear-filters"
    ).addEventListener(
        "click",
        () => {

            selectedStates = [];

            selectedSectors = [];

            selectedGenders = [];


            document.getElementById(
                "state-filter"
            ).value = "";


            document.querySelectorAll(
                '.checkbox-options input[type="checkbox"]'
            ).forEach(
                checkbox => {
                    checkbox.checked = false;
                }
            );


            updateDropdownText(
                "sector-dropdown-button",
                [],
                "Select sector"
            );


            updateDropdownText(
                "gender-dropdown-button",
                [],
                "Select gender"
            );


            document.getElementById(
                "school-search"
            ).value = "";


            Object.values(
                rangeConfig
            ).forEach(
                config => {

                    document.getElementById(
                        config.minSlider
                    ).value =
                        config.minimum;


                    document.getElementById(
                        config.maxSlider
                    ).value =
                        config.maximum;


                    document.getElementById(
                        config.minInput
                    ).value = "";


                    document.getElementById(
                        config.maxInput
                    ).value = "";


                    updateSliderTrack(
                        document.getElementById(
                            config.minSlider
                        ),
                        document.getElementById(
                            config.maxSlider
                        )
                    );

                }
            );


            applyFilters();

        }
    );

}


/* =========================================================
   ESCAPE HTML
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
