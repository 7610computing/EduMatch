/* =========================================================
   EDUMATCH MAP

   PERFORMANCE ARCHITECTURE

   1. Load all school DATA into memory.
   2. Filter school DATA client-side.
   3. Only create markers for schools near the viewport.
   4. Use Leaflet.markercluster for dense areas.
   5. Reuse markers instead of rebuilding everything.
   6. Hide school-name labels at lower zoom levels.
   7. Create popup HTML only when a popup is opened.
   8. Cache distances from the user's location.
   9. Debounce text search.
   10. Update visible markers on map moveend.
   ========================================================= */

/* SUPABASE */

const SUPABASE_URL = "https://lwamtnocbxgostdrqhhz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_toapbpc7C63yz1cCfg2jFQ_THIzGsJj";

/* DEBUG / TEST SETTINGS */

const DEBUG_MODE = true;
const TEST_SCHOOL_NO = "20";
const ZOOM_TO_TEST_SCHOOL = true;

/* GEOCODING */

const GEOCODING_URL = "https://nominatim.openstreetmap.org/search";

/* FILTER LIMITS */

const FILTER_LIMITS = {
    age: { min: 3, max: 25, step: 1 },
    fee: { min: 0, max: 100000, step: 500 },
    enrolment: { min: 0, max: 5000, step: 50 },
    ratio: { min: 1, max: 50, step: 0.1 },
    distance: { min: 0, max: 1000, step: 1 }
};

/* SUPABASE PAGINATION */

const SUPABASE_PAGE_SIZE = 1000;

/* MAP PERFORMANCE SETTINGS */

/*
   How far outside the visible map to render markers, as a
   fraction of the viewport. Stops markers popping in/out
   the moment the user pans slightly.
*/
const VIEWPORT_BUFFER = 0.25;

/*
   School-name labels are hidden below this zoom level.
*/
const LABEL_ZOOM_LEVEL = 8;

/*
   Search debounce time, so typing doesn't re-run filtering
   on every keystroke.
*/
const SEARCH_DEBOUNCE_MS = 250;

/*
   Safety cap on how many marker objects get created from the
   currently filtered schools in one go. Not a hard data limit,
   just a guard against extremely dense views.
*/
const MAX_VISIBLE_MARKERS = 1500;

/* GLOBAL VARIABLES */

let map = null;
let schools = [];
let filteredSchools = [];

/*
   Marker cache: school_id -> Leaflet marker.
   Markers are reused instead of recreated.
*/
const markerCache = new Map();

/*
   Schools currently being displayed by the marker layer.
*/
const visibleSchoolIds = new Set();

let markerClusterGroup = null;

/* User location */

let userLocationMarker = null;
let distanceCircle = null;
let userLatitude = null;
let userLongitude = null;

/*
   Cached distances: school_id -> distance in kilometres.
*/
const distanceCache = new Map();

/* Selected filters */

let selectedStates = [];
let selectedSectors = [];
let selectedGenders = [];

let searchDebounceTimer = null;

/*
   Prevents marker updates from running multiple times
   simultaneously.
*/
let markerUpdateScheduled = false;


/* =========================================================
   START
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    console.log("==========================================");
    console.log("EduMatch map starting...");
    console.log("==========================================");

    initialiseMap();
    initialiseFilters();
    initialiseSearch();
    initialiseLocation();
    initialiseDetailsPanel();
    loadSchools();

});


/* =========================================================
   MAP
   ========================================================= */

function initialiseMap() {

    console.log("[TEST] Initialising Leaflet map...");

    const mapElement = document.getElementById("school-map");

    if (!mapElement) {
        console.error("[TEST FAILED] #school-map does not exist.");
        return;
    }

    if (typeof L === "undefined") {
        console.error("[TEST FAILED] Leaflet has not loaded.");
        return;
    }

    if (typeof L.markerClusterGroup !== "function") {
        console.error("[TEST FAILED] Leaflet.markercluster has not loaded.");
        return;
    }

    map = L.map("school-map", { worldCopyJump: false });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        noWrap: true,
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    /*
       chunkedLoading: adds markers in small batches rather than
       blocking the browser with one huge operation.
       removeOutsideVisibleBounds: drops marker layers far outside
       the current viewport.
       animate: disabled to reduce work when large groups change.
    */
    markerClusterGroup = L.markerClusterGroup({
        chunkedLoading: true,
        chunkInterval: 50,
        chunkDelay: 20,
        removeOutsideVisibleBounds: true,
        animate: false,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        disableClusteringAtZoom: 12,
        maxClusterRadius: 35
    });

    markerClusterGroup.addTo(map);

    /* Melbourne starting position */
    map.setView([-37.8136, 144.9631], 6);

    /*
       Only update marker visibility once the map has finished
       moving. Deliberately not using "move".
    */
    map.on("moveend", () => {
        scheduleVisibleMarkerUpdate();
    });

    /* Zoom changes affect whether labels should be visible */
    map.on("zoomend", () => {
        updateMarkerLabels();
        scheduleVisibleMarkerUpdate();
    });

    console.log("[TEST PASSED] Leaflet map initialised.");

}


/* =========================================================
   LOAD SCHOOLS
   ========================================================= */

async function loadSchools() {

    console.log("==========================================");
    console.log("[TEST] Loading school data from Supabase...");
    console.log("==========================================");

    try {

        schools = await fetchAllSchools();

        console.log("[TEST PASSED] School data loaded.");
        console.log("[TEST] Total schools returned:", schools.length);

        if (schools.length === 0) {
            console.warn("[TEST WARNING] Supabase returned zero schools.");
        }

        /*
           Normalise the data once so we don't repeatedly convert
           strings to numbers every time a filter runs.
        */
        schools = schools.map(normaliseSchool);

        console.log("[TEST] Normalised schools:", schools.length);

        runSchoolDataTests();
        populateStateOptions();
        applyFilters();
        runMarkerTests();

        if (DEBUG_MODE && ZOOM_TO_TEST_SCHOOL) {
            zoomToTestSchool();
        }

        console.log("==========================================");
        console.log("[TEST] School loading complete.");
        console.log("==========================================");

    } catch (error) {

        console.error("==========================================");
        console.error("[TEST FAILED] Unable to load schools.");
        console.error(error);
        console.error("==========================================");

        // FIX: previously this just showed "0 schools found", which
        // looks identical to a legitimate empty result set. Now it
        // says plainly that loading failed, so it's obvious at a
        // glance whether you're looking at a real 0 or a broken fetch.
        showLoadError();

    }

}


/* =========================================================
   FETCH ALL SCHOOLS
   ========================================================= */

async function fetchAllSchools() {

    const allSchools = [];
    let offset = 0;

    while (true) {

        const url = `${SUPABASE_URL}/rest/v1/Schools?select=*&offset=${offset}&limit=${SUPABASE_PAGE_SIZE}`;

        console.log(`[TEST] Loading schools ${offset + 1} - ${offset + SUPABASE_PAGE_SIZE}...`);

        const response = await fetch(url, {
            method: "GET",
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        });

        console.log("[TEST] Supabase HTTP status:", response.status);

        const responseText = await response.text();

        if (!response.ok) {
            throw new Error(`Supabase request failed: ${response.status} ${response.statusText}\n${responseText}`);
        }

        let data;

        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            throw new Error("Supabase returned data that was not valid JSON.");
        }

        if (!Array.isArray(data)) {
            throw new Error("Supabase response was not an array of schools.");
        }

        allSchools.push(...data);

        console.log(`[TEST] Batch returned: ${data.length} schools.`);
        console.log(`[TEST] Total schools loaded so far: ${allSchools.length}`);

        if (data.length < SUPABASE_PAGE_SIZE) {
            break;
        }

        offset += SUPABASE_PAGE_SIZE;

    }

    console.log(`[TEST] Finished loading schools. Total: ${allSchools.length}`);

    return allSchools;

}


/* =========================================================
   NORMALISE SCHOOL
   ========================================================= */

function normaliseSchool(school) {

    const normalised = {
        ...school,
        school_id: Number(school.school_id),
        enrolment: school.enrolment !== null && school.enrolment !== "" ? Number(school.enrolment) : null,
        fee: school.fee !== null && school.fee !== "" ? Number(school.fee) : null,
        student_teacher_ratio: school.student_teacher_ratio !== null && school.student_teacher_ratio !== "" ? Number(school.student_teacher_ratio) : null,
        latitude: school.latitude !== null && school.latitude !== "" ? Number(school.latitude) : null,
        longitude: school.longitude !== null && school.longitude !== "" ? Number(school.longitude) : null
    };

    /*
       Pre-create a lowercase search string so we don't repeatedly
       join and lowercase school information during every search.
    */
    normalised.searchText = [school.name, school.address, school.state, school.description]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    return normalised;

}


/* =========================================================
   SCHOOL DATA TESTS
   ========================================================= */

function runSchoolDataTests() {

    if (!DEBUG_MODE) {
        return;
    }

    console.log("==========================================");
    console.log("[TEST] Running school data tests...");
    console.log("==========================================");

    if (schools.length > 0) {
        console.log("[TEST PASSED] Supabase returned schools.");
    } else {
        console.error("[TEST FAILED] Supabase returned zero schools.");
        return;
    }

    const parade = schools.find(school => String(school.government_school_no) === TEST_SCHOOL_NO);

    if (parade) {
        console.log("[TEST PASSED] Parade College was found.");
        console.log("[TEST] Parade College:", parade);
    } else {
        console.error("[TEST FAILED] Parade College was NOT found.");
        return;
    }

    if (Number.isFinite(parade.latitude)) {
        console.log("[TEST PASSED] Parade latitude is valid:", parade.latitude);
    } else {
        console.error("[TEST FAILED] Parade latitude is invalid:", parade.latitude);
    }

    if (Number.isFinite(parade.longitude)) {
        console.log("[TEST PASSED] Parade longitude is valid:", parade.longitude);
    } else {
        console.error("[TEST FAILED] Parade longitude is invalid:", parade.longitude);
    }

    const expectedLatitude = -37.6902;
    const expectedLongitude = 145.067;

    const latitudeMatches = Math.abs(parade.latitude - expectedLatitude) < 0.001;
    const longitudeMatches = Math.abs(parade.longitude - expectedLongitude) < 0.001;

    if (latitudeMatches && longitudeMatches) {
        console.log("[TEST PASSED] Parade coordinates match the expected location.");
    } else {
        console.warn("[TEST WARNING] Parade coordinates differ from expected test coordinates.");
    }

    const passesFilters = filteredSchools.includes(parade);

    if (passesFilters) {
        console.log("[TEST PASSED] Parade College passes the current filters.");
    } else {
        console.warn("[TEST WARNING] Parade College is being removed by one or more filters.");
    }

}


/* =========================================================
   MARKER TESTS
   ========================================================= */

function runMarkerTests() {

    if (!DEBUG_MODE) {
        return;
    }

    console.log("==========================================");
    console.log("[TEST] Running marker tests...");
    console.log("==========================================");

    if (filteredSchools.length > 0) {
        console.log("[TEST PASSED] Schools passed the filters:", filteredSchools.length);
    } else {
        console.error("[TEST FAILED] No schools passed the filters.");
        return;
    }

    console.log("[TEST] Marker cache size:", markerCache.size);

    const parade = schools.find(school => String(school.government_school_no) === TEST_SCHOOL_NO);

    if (!parade) {
        return;
    }

    const paradeMarker = markerCache.get(parade.school_id);

    if (paradeMarker) {
        console.log("[TEST PASSED] Parade College marker exists in cache.");
    } else {
        console.log("[TEST] Parade marker is not currently in the viewport.");
    }

}


/* =========================================================
   ZOOM TO TEST SCHOOL
   ========================================================= */

function zoomToTestSchool() {

    // FIX: this used to call map.setView() unconditionally. If Leaflet
    // or the marker-cluster plugin ever failed to load, initialiseMap()
    // bails out early and `map` stays null - and this function would
    // then throw a TypeError, which stops the rest of the script
    // (search, filters, everything) from wiring up correctly. Guarding
    // here means a map-load failure just gets logged, not silently
    // takes the whole page down with it.
    if (!map) {
        console.warn("[TEST] Cannot zoom to Parade because the map failed to initialise.");
        return;
    }

    const testSchool = schools.find(school => String(school.government_school_no) === TEST_SCHOOL_NO);

    if (!testSchool) {
        console.warn("[TEST] Cannot zoom to Parade because it was not found.");
        return;
    }

    if (!Number.isFinite(testSchool.latitude) || !Number.isFinite(testSchool.longitude)) {
        console.warn("[TEST] Cannot zoom to Parade because coordinates are invalid.");
        return;
    }

    console.log("[TEST] Zooming map to Parade College:", testSchool.latitude, testSchool.longitude);

    map.setView([testSchool.latitude, testSchool.longitude], 15);

}


/* =========================================================
   FILTER INITIALISATION
   ========================================================= */

function initialiseFilters() {

    initialiseDualSlider("age", FILTER_LIMITS.age);
    initialiseDualSlider("fee", FILTER_LIMITS.fee);
    initialiseDualSlider("enrolment", FILTER_LIMITS.enrolment);
    initialiseDualSlider("ratio", FILTER_LIMITS.ratio);
    initialiseDualSlider("distance", FILTER_LIMITS.distance);

    /* STATE SEARCH */

    const stateInput = document.getElementById("state-search");

    if (stateInput) {
        stateInput.addEventListener("input", filterStateOptions);
        stateInput.addEventListener("focus", () => {
            const options = document.getElementById("state-options");
            if (options) {
                options.classList.add("visible");
            }
        });
    }

    /* SECTOR DROPDOWN */

    const sectorButton = document.getElementById("sector-dropdown-button");

    if (sectorButton) {
        sectorButton.addEventListener("click", event => {
            event.stopPropagation();
            const options = document.getElementById("sector-options");
            if (options) {
                options.classList.toggle("open");
            }
        });
    }

    /* GENDER DROPDOWN */

    const genderButton = document.getElementById("gender-dropdown-button");

    if (genderButton) {
        genderButton.addEventListener("click", event => {
            event.stopPropagation();
            const options = document.getElementById("gender-options");
            if (options) {
                options.classList.toggle("open");
            }
        });
    }

    /* SECTOR CHECKBOXES */

    document.querySelectorAll('#sector-options input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener("change", updateSectorFilter);
    });

    /* GENDER CHECKBOXES */

    document.querySelectorAll('#gender-options input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener("change", updateGenderFilter);
    });

    /* CLEAR FILTERS */

    const clearButton = document.getElementById("clear-filters");

    if (clearButton) {
        clearButton.addEventListener("click", clearFilters);
    }

    /* CLOSE DROPDOWNS */

    document.addEventListener("click", event => {

        const stateContainer = document.querySelector(".search-select");
        const sectorContainer = document.querySelector(".checkbox-dropdown.sector-dropdown");
        const genderContainer = document.querySelector(".checkbox-dropdown.gender-dropdown");

        if (stateContainer && !stateContainer.contains(event.target)) {
            const options = document.getElementById("state-options");
            if (options) {
                options.classList.remove("visible");
            }
        }

        if (sectorContainer && !sectorContainer.contains(event.target)) {
            const options = document.getElementById("sector-options");
            if (options) {
                options.classList.remove("open");
            }
        }

        if (genderContainer && !genderContainer.contains(event.target)) {
            const options = document.getElementById("gender-options");
            if (options) {
                options.classList.remove("open");
            }
        }

    });

}


/* =========================================================
   DUAL RANGE SLIDERS
   ========================================================= */

function initialiseDualSlider(name, limits) {

    const minSlider = document.getElementById(`${name}-min-slider`);
    const maxSlider = document.getElementById(`${name}-max-slider`);
    const minInput = document.getElementById(`${name}-min`);
    const maxInput = document.getElementById(`${name}-max`);

    if (!minSlider || !maxSlider || !minInput || !maxInput) {
        return;
    }

    minSlider.min = limits.min;
    minSlider.max = limits.max;
    minSlider.step = limits.step;

    maxSlider.min = limits.min;
    maxSlider.max = limits.max;
    maxSlider.step = limits.step;

    minSlider.value = limits.min;
    maxSlider.value = limits.max;

    minInput.value = formatNumber(limits.min, limits.step);
    maxInput.value = formatNumber(limits.max, limits.step);

    // FIX: the number inputs' own min/max/step HTML attributes were
    // never kept in sync with FILTER_LIMITS (the distance field in
    // particular was hardcoded to max="100" in map.html while
    // FILTER_LIMITS.distance.max is 1000). The browser enforces
    // those attributes on typed input regardless of what the slider
    // is doing, so typing "500" into the distance box got silently
    // rejected/clamped. Setting them here from the single source of
    // truth means the HTML values can never drift out of sync again.
    minInput.min = limits.min;
    minInput.max = limits.max;
    minInput.step = limits.step;

    maxInput.min = limits.min;
    maxInput.max = limits.max;
    maxInput.step = limits.step;

    updateSliderTrack(name, limits);

    minSlider.addEventListener("input", () => {

        let minValue = Number(minSlider.value);
        let maxValue = Number(maxSlider.value);

        if (minValue > maxValue) {
            minValue = maxValue;
            minSlider.value = minValue;
        }

        minInput.value = formatNumber(minValue, limits.step);

        updateSliderTrack(name, limits);

        if (name === "distance") {
            updateDistanceCircle();
        }

        applyFilters();

    });

    maxSlider.addEventListener("input", () => {

        let minValue = Number(minSlider.value);
        let maxValue = Number(maxSlider.value);

        if (maxValue < minValue) {
            maxValue = minValue;
            maxSlider.value = maxValue;
        }

        maxInput.value = formatNumber(maxValue, limits.step);

        updateSliderTrack(name, limits);

        if (name === "distance") {
            updateDistanceCircle();
        }

        applyFilters();

    });

    minInput.addEventListener("change", () => {

        let value = parseNumber(minInput.value);

        value = clamp(value, limits.min, limits.max);
        value = snapToStep(value, limits);

        const maxValue = Number(maxSlider.value);

        if (value > maxValue) {
            value = maxValue;
        }

        minSlider.value = value;
        minInput.value = formatNumber(value, limits.step);

        updateSliderTrack(name, limits);

        if (name === "distance") {
            updateDistanceCircle();
        }

        applyFilters();

    });

    maxInput.addEventListener("change", () => {

        let value = parseNumber(maxInput.value);

        value = clamp(value, limits.min, limits.max);
        value = snapToStep(value, limits);

        const minValue = Number(minSlider.value);

        if (value < minValue) {
            value = minValue;
        }

        maxSlider.value = value;
        maxInput.value = formatNumber(value, limits.step);

        updateSliderTrack(name, limits);

        if (name === "distance") {
            updateDistanceCircle();
        }

        applyFilters();

    });

}


/* =========================================================
   SLIDER TRACK
   ========================================================= */

function updateSliderTrack(name, limits) {

    const minSlider = document.getElementById(`${name}-min-slider`);
    const maxSlider = document.getElementById(`${name}-max-slider`);
    const track = document.getElementById(`${name}-track`);

    if (!minSlider || !maxSlider || !track) {
        return;
    }

    const minValue = Number(minSlider.value);
    const maxValue = Number(maxSlider.value);

    const range = limits.max - limits.min;

    const minPercent = ((minValue - limits.min) / range) * 100;
    const maxPercent = ((maxValue - limits.min) / range) * 100;

    track.style.setProperty("--range-start", `${minPercent}%`);
    track.style.setProperty("--range-end", `${maxPercent}%`);

}


/* =========================================================
   NUMBER HELPERS
   ========================================================= */

function parseNumber(value) {

    const cleaned = String(value).replace(/,/g, "").trim();
    const number = Number(cleaned);

    return Number.isFinite(number) ? number : 0;

}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function snapToStep(value, limits) {
    const steps = Math.round((value - limits.min) / limits.step);
    return limits.min + steps * limits.step;
}

function formatNumber(value, step) {

    if (step < 1) {
        return Number(value).toFixed(1);
    }

    return Math.round(value);

}


/* =========================================================
   SEARCH
   ========================================================= */

function initialiseSearch() {

    const searchInput = document.getElementById("school-search");
    const searchButton = document.getElementById("search-button");

    if (searchInput) {

        searchInput.addEventListener("input", () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => {
                applyFilters();
            }, SEARCH_DEBOUNCE_MS);
        });

        searchInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                clearTimeout(searchDebounceTimer);
                applyFilters();
            }
        });

    }

    if (searchButton) {
        searchButton.addEventListener("click", () => {
            clearTimeout(searchDebounceTimer);
            applyFilters();
        });
    }

}


/* =========================================================
   STATE OPTIONS
   ========================================================= */

function populateStateOptions() {

    const container = document.getElementById("state-options");

    if (!container) {
        return;
    }

    const states = [...new Set(
        schools
            .map(school => school.state)
            .filter(state => state && String(state).trim())
            .map(state => String(state).trim())
    )].sort((a, b) => a.localeCompare(b));

    container.innerHTML = "";

    states.forEach(state => {

        const option = document.createElement("div");
        option.className = "search-option";
        option.textContent = state;

        option.addEventListener("click", () => {

            if (selectedStates.includes(state)) {
                selectedStates = selectedStates.filter(item => item !== state);
            } else {
                selectedStates.push(state);
            }

            updateStateDisplay();
            applyFilters();

        });

        container.appendChild(option);

    });

}


/* =========================================================
   STATE SEARCH
   ========================================================= */

function filterStateOptions() {

    const input = document.getElementById("state-search");
    const container = document.getElementById("state-options");

    if (!input || !container) {
        return;
    }

    const search = input.value.trim().toLowerCase();

    container.querySelectorAll(".search-option").forEach(option => {
        const text = option.textContent.toLowerCase();
        option.style.display = text.includes(search) ? "block" : "none";
    });

    container.classList.add("visible");

}


/* =========================================================
   STATE DISPLAY
   ========================================================= */

function updateStateDisplay() {

    const input = document.getElementById("state-search");

    if (!input) {
        return;
    }

    if (selectedStates.length === 0) {
        input.value = "";
        input.placeholder = "Search states / regions worldwide...";
    } else {
        input.value = selectedStates.join(", ");
    }

}


/* =========================================================
   SECTOR FILTER
   ========================================================= */

function updateSectorFilter() {

    selectedSectors = [...document.querySelectorAll('#sector-options input[type="checkbox"]:checked')]
        .map(checkbox => checkbox.value);

    updateSectorDisplay();
    applyFilters();

}

function updateSectorDisplay() {

    const button = document.getElementById("sector-dropdown-button");

    if (!button) {
        return;
    }

    const text = button.querySelector(".dropdown-text");

    if (!text) {
        return;
    }

    const count = selectedSectors.length;

    if (count === 0) {
        text.textContent = "All sectors";
    } else if (count === 1) {
        text.textContent = "1 filter selected";
    } else {
        text.textContent = `${count} filters selected`;
    }

}


/* =========================================================
   GENDER FILTER
   ========================================================= */

function updateGenderFilter() {

    selectedGenders = [...document.querySelectorAll('#gender-options input[type="checkbox"]:checked')]
        .map(checkbox => checkbox.value);

    updateGenderDisplay();
    applyFilters();

}

function updateGenderDisplay() {

    const button = document.getElementById("gender-dropdown-button");

    if (!button) {
        return;
    }

    const text = button.querySelector(".dropdown-text");

    if (!text) {
        return;
    }

    const count = selectedGenders.length;

    if (count === 0) {
        text.textContent = "All genders";
    } else if (count === 1) {
        text.textContent = "1 filter selected";
    } else {
        text.textContent = `${count} filters selected`;
    }

}


/* =========================================================
   APPLY FILTERS
   ========================================================= */

function applyFilters() {

    const searchInput = document.getElementById("school-search");
    const search = searchInput ? searchInput.value.trim().toLowerCase() : "";

    const ageRange = getRange("age");
    const feeRange = getRange("fee");
    const enrolmentRange = getRange("enrolment");
    const ratioRange = getRange("ratio");
    const distanceRange = getRange("distance");

    /*
       Filtering only determines DATA. It does not directly
       create markers.
    */
    filteredSchools = schools.filter(school => {

        /* SEARCH */
        if (search) {
            if (!school.searchText.includes(search)) {
                return false;
            }
        }

        /* STATE */
        if (selectedStates.length > 0) {
            const schoolState = String(school.state || "").trim();
            if (!selectedStates.includes(schoolState)) {
                return false;
            }
        }

        /* SECTOR */
        if (selectedSectors.length > 0) {
            const schoolSector = String(school.sector || "").trim().toLowerCase();
            const matches = selectedSectors.some(selected => schoolSector === selected.toLowerCase());
            if (!matches) {
                return false;
            }
        }

        /* GENDER */
        if (selectedGenders.length > 0) {
            const schoolGender = String(school.gender || "").trim().toLowerCase();
            const matches = selectedGenders.some(selected => schoolGender === selected.toLowerCase());
            if (!matches) {
                return false;
            }
        }

        /* AGE */
        if (school.allowed_ages && !ageMatches(school.allowed_ages, ageRange)) {
            return false;
        }

        /* FEE */
        if (school.fee !== null && (school.fee < feeRange.min || school.fee > feeRange.max)) {
            return false;
        }

        /* ENROLMENT */
        if (school.enrolment !== null && (school.enrolment < enrolmentRange.min || school.enrolment > enrolmentRange.max)) {
            return false;
        }

        /* STUDENT / TEACHER RATIO */
        if (school.student_teacher_ratio !== null && (school.student_teacher_ratio < ratioRange.min || school.student_teacher_ratio > ratioRange.max)) {
            return false;
        }

        /* DISTANCE */
        if (userLatitude !== null && userLongitude !== null && school.latitude !== null && school.longitude !== null) {
            const distance = getCachedDistance(school);
            if (distance < distanceRange.min || distance > distanceRange.max) {
                return false;
            }
        }

        return true;

    });

    updateResultsCount(filteredSchools.length);

    /*
       Now that filtering is complete, decide which filtered
       schools actually need Leaflet markers.
    */
    scheduleVisibleMarkerUpdate();

}


/* =========================================================
   GET RANGE
   ========================================================= */

function getRange(name) {

    const min = document.getElementById(`${name}-min-slider`);
    const max = document.getElementById(`${name}-max-slider`);

    return {
        min: min ? Number(min.value) : FILTER_LIMITS[name].min,
        max: max ? Number(max.value) : FILTER_LIMITS[name].max
    };

}


/* =========================================================
   AGE MATCHING
   ========================================================= */

function ageMatches(allowedAges, range) {

    const text = String(allowedAges).toLowerCase();
    const numbers = text.match(/\d+(?:\.\d+)?/g);

    if (!numbers || numbers.length === 0) {
        return true;
    }

    const ages = numbers.map(Number);

    const schoolMin = Math.min(...ages);
    const schoolMax = Math.max(...ages);

    return schoolMax >= range.min && schoolMin <= range.max;

}


/* =========================================================
   DISTANCE CACHE
   ========================================================= */

function getCachedDistance(school) {

    if (userLatitude === null || userLongitude === null) {
        return null;
    }

    const schoolId = school.school_id;

    if (distanceCache.has(schoolId)) {
        return distanceCache.get(schoolId);
    }

    const distance = calculateDistance(userLatitude, userLongitude, school.latitude, school.longitude);

    distanceCache.set(schoolId, distance);

    return distance;

}

function clearDistanceCache() {
    distanceCache.clear();
}


/* =========================================================
   DISTANCE CALCULATION
   ========================================================= */

function calculateDistance(lat1, lon1, lat2, lon2) {

    const earthRadius = 6371;

    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadius * c;

}

function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
}


/* =========================================================
   SCHEDULE VISIBLE MARKER UPDATE
   ========================================================= */

function scheduleVisibleMarkerUpdate() {

    if (markerUpdateScheduled) {
        return;
    }

    markerUpdateScheduled = true;

    requestAnimationFrame(() => {
        markerUpdateScheduled = false;
        updateVisibleMarkers();
    });

}


/* =========================================================
   GET EXPANDED VIEWPORT
   ========================================================= */

function getExpandedMapBounds() {

    const bounds = map.getBounds();

    const north = bounds.getNorth();
    const south = bounds.getSouth();
    const east = bounds.getEast();
    const west = bounds.getWest();

    const latitudeBuffer = (north - south) * VIEWPORT_BUFFER;
    const longitudeBuffer = (east - west) * VIEWPORT_BUFFER;

    return L.latLngBounds(
        [south - latitudeBuffer, west - longitudeBuffer],
        [north + latitudeBuffer, east + longitudeBuffer]
    );

}


/* =========================================================
   GET VISIBLE FILTERED SCHOOLS
   ========================================================= */

function getVisibleSchools() {

    if (!map) {
        return [];
    }

    const bounds = getExpandedMapBounds();
    const visible = [];

    for (const school of filteredSchools) {

        if (!Number.isFinite(school.latitude) || !Number.isFinite(school.longitude)) {
            continue;
        }

        if (bounds.contains([school.latitude, school.longitude])) {
            visible.push(school);
        }

    }

    return visible;

}


/* =========================================================
   UPDATE VISIBLE MARKERS
   ========================================================= */

function updateVisibleMarkers() {

    if (!map || !markerClusterGroup) {
        return;
    }

    const visibleSchools = getVisibleSchools();

    /*
       If an extremely dense view contains thousands of schools,
       don't attempt to create every single marker simultaneously.
       Clustering still represents the schools spatially.
    */
    let schoolsToRender = visibleSchools;

    if (visibleSchools.length > MAX_VISIBLE_MARKERS) {

        schoolsToRender = visibleSchools.slice(0, MAX_VISIBLE_MARKERS);

        if (DEBUG_MODE) {
            console.log(`[MAP] View contains ${visibleSchools.length} schools. Rendering first ${MAX_VISIBLE_MARKERS} marker objects.`);
        }

    }

    const nextSchoolIds = new Set(schoolsToRender.map(school => school.school_id));

    /* REMOVE MARKERS THAT ARE NO LONGER NEEDED */

    visibleSchoolIds.forEach(schoolId => {

        if (!nextSchoolIds.has(schoolId)) {

            const marker = markerCache.get(schoolId);

            if (marker) {
                markerClusterGroup.removeLayer(marker);
            }

            visibleSchoolIds.delete(schoolId);

        }

    });

    /* ADD NEW MARKERS */

    schoolsToRender.forEach(school => {

        const schoolId = school.school_id;
        let marker = markerCache.get(schoolId);

        if (!marker) {
            marker = createSchoolMarker(school);
            markerCache.set(schoolId, marker);
        }

        if (!visibleSchoolIds.has(schoolId)) {
            markerClusterGroup.addLayer(marker);
            visibleSchoolIds.add(schoolId);
        }

    });

    updateMarkerLabels();

    if (DEBUG_MODE) {
        console.log("[MAP] Filtered schools:", filteredSchools.length);
        console.log("[MAP] Schools in viewport:", visibleSchools.length);
        console.log("[MAP] Active marker objects:", visibleSchoolIds.size);
        console.log("[MAP] Cached markers:", markerCache.size);
    }

}


/* =========================================================
   CREATE SCHOOL MARKER
   ========================================================= */

function createSchoolMarker(school) {

    const icon = createSchoolIcon(school);

    const marker = L.marker([school.latitude, school.longitude], { icon });

    /*
       Popup content is NOT generated here. It's only created when
       the user opens the popup.
    */
    marker.bindPopup(() => {
        return createSchoolPopup(school);
    }, {
        closeButton: true,
        maxWidth: 320,
        minWidth: 260
    });

    /*
       Event handler is attached once when the marker is created,
       rather than every time it's rendered.
    */
    marker.on("popupopen", event => {

        const popup = event.popup.getElement();

        if (!popup) {
            return;
        }

        const viewButton = popup.querySelector(".view-school-button");

        if (viewButton) {
            viewButton.addEventListener("click", () => {
                openSchoolDetails(school);
            });
        }

        const tagButton = popup.querySelector(".school-tag-button");

        if (tagButton) {
            tagButton.addEventListener("click", () => {
                openSchoolTags(school);
            });
        }

    });

    return marker;

}


/* =========================================================
   SCHOOL ICON
   ========================================================= */

function createSchoolIcon(school) {

    return L.divIcon({
        className: "custom-school-icon",
        html: `
            <div class="school-marker">
                <span class="school-marker-dot"></span>
                <span class="school-marker-label">${escapeHTML(school.name || "School")}</span>
            </div>
        `,
        iconSize: null,
        iconAnchor: [0, 0]
    });

}


/* =========================================================
   UPDATE MARKER LABELS
   ========================================================= */

function updateMarkerLabels() {

    if (!map) {
        return;
    }

    const showLabels = map.getZoom() >= LABEL_ZOOM_LEVEL;

    markerCache.forEach(marker => {

        const element = marker.getElement();

        if (!element) {
            return;
        }

        const label = element.querySelector(".school-marker-label");

        if (!label) {
            return;
        }

        label.style.display = showLabels ? "" : "none";

    });

}


/* =========================================================
   SCHOOL POPUP
   ========================================================= */

function createSchoolPopup(school) {

    return `
        <div class="school-popup">
            <div class="school-popup-header">
                <div>
                    <h3>${escapeHTML(school.name || "School")}</h3>
                    <p>${escapeHTML(school.address || school.state || "Location unavailable")}</p>
                </div>
                <button type="button" class="school-tag-button" title="Add tag">+</button>
            </div>
            <p class="school-popup-description">
                ${escapeHTML(school.description || "No overview is available for this school.")}
            </p>
            <button type="button" class="view-school-button">View details</button>
        </div>
    `;

}


/* =========================================================
   DETAILS PANEL
   ========================================================= */

function initialiseDetailsPanel() {

    const closeButton = document.getElementById("close-details");

    if (closeButton) {
        closeButton.addEventListener("click", closeSchoolDetails);
    }

}

function openSchoolDetails(school) {

    const panel = document.getElementById("school-details");
    const content = document.getElementById("school-details-content");

    if (!panel || !content) {
        return;
    }

    content.innerHTML = `
        <h2>${escapeHTML(school.name || "School")}</h2>
        <p class="details-description">
            ${escapeHTML(school.description || "No description available.")}
        </p>
        <div class="detail-list">
            ${createDetail("Address", school.address)}
            ${createDetail("State / Region", school.state)}
            ${createDetail("Sector", school.sector)}
            ${createDetail("Gender", school.gender)}
            ${createDetail("Age Range", school.allowed_ages)}
            ${createDetail("Fees", school.fee !== null ? `$${Number(school.fee).toLocaleString()}` : null)}
            ${createDetail("Enrolment", school.enrolment !== null ? Number(school.enrolment).toLocaleString() : null)}
            ${createDetail("Student–Teacher Ratio", school.student_teacher_ratio !== null ? String(school.student_teacher_ratio) : null)}
            ${createDetail("Uniform", school.uniform)}
            ${createDetail("Enrolment Information", school.enrolment_info)}
            ${createDetail("Contact", school.contact)}
            ${createWebsiteDetail(school.website)}
        </div>
    `;

    panel.classList.add("open");

}

function closeSchoolDetails() {

    const panel = document.getElementById("school-details");

    if (panel) {
        panel.classList.remove("open");
    }

}


/* =========================================================
   DETAIL HELPERS
   ========================================================= */

function createDetail(label, value) {

    if (value === null || value === undefined || String(value).trim() === "") {
        return "";
    }

    return `
        <div class="detail-item">
            <span class="detail-label">${escapeHTML(label)}</span>
            <span class="detail-value">${escapeHTML(String(value))}</span>
        </div>
    `;

}

function createWebsiteDetail(website) {

    if (!website || String(website).trim() === "") {
        return "";
    }

    let url = String(website).trim();

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        url = `https://${url}`;
    }

    return `
        <div class="detail-item">
            <span class="detail-label">Website</span>
            <span class="detail-value">
                <a href="${escapeAttribute(url)}" target="_blank" rel="noopener noreferrer">Visit website</a>
            </span>
        </div>
    `;

}


/* =========================================================
   TAGS
   ========================================================= */

function openSchoolTags(school) {

    /* Tags have not yet been connected to Supabase. */
    console.log("Tags for school:", school.school_id);

}


/* =========================================================
   LOCATION INITIALISATION
   ========================================================= */

function initialiseLocation() {

    const currentLocationButton = document.getElementById("current-location-button");
    const locationInput = document.getElementById("location-input");

    if (currentLocationButton) {
        currentLocationButton.addEventListener("click", requestCurrentLocation);
    }

    if (locationInput) {
        locationInput.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                geocodeAddress();
            }
        });
    }

}


/* =========================================================
   CURRENT LOCATION
   ========================================================= */

function requestCurrentLocation() {

    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    const button = document.getElementById("current-location-button");

    if (button) {
        button.disabled = true;
        button.textContent = "Getting location...";
    }

    navigator.geolocation.getCurrentPosition(

        position => {

            setUserLocation(position.coords.latitude, position.coords.longitude);

            if (button) {
                button.disabled = false;
                button.textContent = "Current Location";
            }

        },

        error => {

            console.error("Geolocation error:", error);

            if (button) {
                button.disabled = false;
                button.textContent = "Current Location";
            }

            if (error.code === error.PERMISSION_DENIED) {
                alert("Location access was denied. Please allow location access for this website in your browser settings.");
            } else if (error.code === error.POSITION_UNAVAILABLE) {
                alert("Your location could not be determined.");
            } else if (error.code === error.TIMEOUT) {
                alert("Getting your location timed out. Please try again.");
            } else {
                alert("Unable to get your current location.");
            }

        },

        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }

    );

}


/* =========================================================
   SET USER LOCATION
   ========================================================= */

function setUserLocation(latitude, longitude) {

    userLatitude = Number(latitude);
    userLongitude = Number(longitude);

    if (!Number.isFinite(userLatitude) || !Number.isFinite(userLongitude)) {
        console.error("Invalid user location:", latitude, longitude);
        return;
    }

    /*
       The user's position changed, so every cached school distance
       is now invalid.
    */
    clearDistanceCache();

    updateLocationInput();

    map.setView([userLatitude, userLongitude], 13);

    if (userLocationMarker) {

        userLocationMarker.setLatLng([userLatitude, userLongitude]);

    } else {

        const locationIcon = L.divIcon({
            className: "user-location-icon",
            html: `
                <div class="user-location-marker">
                    <div class="user-location-dot"></div>
                </div>
            `,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        userLocationMarker = L.marker([userLatitude, userLongitude], {
            icon: locationIcon,
            zIndexOffset: 1000
        })
            .addTo(map)
            .bindPopup("Your location");

    }

    updateDistanceCircle();
    applyFilters();

    if (DEBUG_MODE) {
        console.log("[TEST] User location set:", userLatitude, userLongitude);
    }

}


/* =========================================================
   UPDATE LOCATION INPUT
   ========================================================= */

function updateLocationInput() {

    const input = document.getElementById("location-input");

    if (!input) {
        return;
    }

    input.value = `${userLatitude.toFixed(5)}, ${userLongitude.toFixed(5)}`;

}


/* =========================================================
   GEOCODE TYPED ADDRESS
   ========================================================= */

async function geocodeAddress() {

    const input = document.getElementById("location-input");

    if (!input) {
        return;
    }

    const address = input.value.trim();

    if (!address) {
        alert("Please enter an address or location.");
        return;
    }

    const originalValue = input.value;

    input.disabled = true;
    input.value = "Finding location...";

    try {

        const url = `${GEOCODING_URL}?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`;

        const response = await fetch(url, {
            headers: {
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`Geocoding request failed: ${response.status}`);
        }

        const results = await response.json();

        if (!results || results.length === 0) {
            throw new Error("No matching location found.");
        }

        const result = results[0];

        const latitude = Number(result.lat);
        const longitude = Number(result.lon);

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            throw new Error("The location returned invalid coordinates.");
        }

        input.value = result.display_name || originalValue;

        setUserLocation(latitude, longitude);

    } catch (error) {

        console.error("Address geocoding error:", error);

        input.value = originalValue;

        alert("We couldn't find that location. Please try entering a more specific address.");

    } finally {

        input.disabled = false;

    }

}


/* =========================================================
   DISTANCE CIRCLE
   ========================================================= */

function updateDistanceCircle() {

    if (!map || userLatitude === null || userLongitude === null) {
        return;
    }

    const distanceRange = getRange("distance");
    const radiusMetres = distanceRange.max * 1000;

    if (distanceCircle) {

        distanceCircle.setLatLng([userLatitude, userLongitude]);
        distanceCircle.setRadius(radiusMetres);

    } else {

        distanceCircle = L.circle([userLatitude, userLongitude], {
            radius: radiusMetres,
            className: "distance-circle",
            weight: 2,
            fillOpacity: 0.08
        }).addTo(map);

    }

}


/* =========================================================
   CLEAR FILTERS
   ========================================================= */

function clearFilters() {

    selectedStates = [];
    selectedSectors = [];
    selectedGenders = [];

    clearDistanceCache();

    const searchInput = document.getElementById("school-search");

    if (searchInput) {
        searchInput.value = "";
    }

    const stateInput = document.getElementById("state-search");

    if (stateInput) {
        stateInput.value = "";
        stateInput.placeholder = "Search states / regions worldwide...";
    }

    document.querySelectorAll('#sector-options input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });

    document.querySelectorAll('#gender-options input[type="checkbox"]').forEach(checkbox => {
        checkbox.checked = false;
    });

    Object.entries(FILTER_LIMITS).forEach(([name, limits]) => {

        const minSlider = document.getElementById(`${name}-min-slider`);
        const maxSlider = document.getElementById(`${name}-max-slider`);
        const minInput = document.getElementById(`${name}-min`);
        const maxInput = document.getElementById(`${name}-max`);

        if (minSlider) {
            minSlider.value = limits.min;
        }

        if (maxSlider) {
            maxSlider.value = limits.max;
        }

        if (minInput) {
            minInput.value = formatNumber(limits.min, limits.step);
        }

        if (maxInput) {
            maxInput.value = formatNumber(limits.max, limits.step);
        }

        updateSliderTrack(name, limits);

    });

    updateSectorDisplay();
    updateGenderDisplay();
    updateStateDisplay();
    updateDistanceCircle();
    applyFilters();

}


/* =========================================================
   RESULTS
   ========================================================= */

function updateResultsCount(count) {

    const result = document.getElementById("results-count");

    if (!result) {
        return;
    }

    result.textContent = `${count} school${count === 1 ? "" : "s"} found`;

}

// FIX: new - dedicated message for a failed load, distinct from a
// genuine "0 schools found" result. See loadSchools()'s catch block.
function showLoadError() {

    const result = document.getElementById("results-count");

    if (!result) {
        return;
    }

    result.textContent = "Unable to load school data — check the browser console for details.";

}


/* =========================================================
   HTML SECURITY
   ========================================================= */

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

function escapeAttribute(value) {
    return escapeHTML(value);
}
