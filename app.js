/* ======================
   CONFIG
====================== */

const URLS = {
  corner: "https://commexportproxy.vercel.app/api/algs?sheet=corners_with_notes",
  edge: "https://commexportproxy.vercel.app/api/algs?sheet=edges_with_notes"
};

const CACHE_KEY = "tsv_lookup_cache_v1";
const CACHE_TIME = 1000 * 60 * 60 * 24; // 24h


/* ======================
   STATE
====================== */

let dataCorner = {};
let dataEdge = {};
let active = "corner";


/* ======================
   ELEMENTS
====================== */

const input = document.getElementById("keyInput");
const result = document.getElementById("result");
const status = document.getElementById("status");

const switchBtn = document.getElementById("switchBtn");
const clearBtn = document.getElementById("clearBtn");
const refreshBtn = document.getElementById("refreshBtn");


/* ======================
   CACHE
====================== */

function saveCache(corner, edge) {

  const payload = {
    time: Date.now(),
    timeText: new Date().toLocaleString(),
    corner,
    edge
  };

  localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
}


function loadCache() {

  const raw = localStorage.getItem(CACHE_KEY);

  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}


async function fetchData() {

  try {

    updateStatus("Updating...");
    refreshBtn.disabled = true;

    const [cornerRes, edgeRes] = await Promise.all([
      fetch(URLS.corner),
      fetch(URLS.edge)
    ]);

    if (!cornerRes.ok || !edgeRes.ok) {
      throw new Error("Network error");
    }

    const cornerText = await cornerRes.text();
    const edgeText = await edgeRes.text();

    dataCorner = parseTSV(cornerText);
    dataEdge = parseTSV(edgeText);

    saveCache(dataCorner, dataEdge);

    const cache = loadCache();

    updateStatus(
      "Updated",
      `Last: ${cache.timeText}`
    );

  } catch (err) {

    console.warn("Fetch failed:", err);

    const cache = loadCache();

    if (cache) {

      dataCorner = cache.corner;
      dataEdge = cache.edge;

      updateStatus(
        "Offline — using cache",
        `Last: ${cache.timeText}`
      );

    } else {

      updateStatus("No data available");
    }

  } finally {

    refreshBtn.disabled = false;
  }
}

function parseTSV(text) {

  const out = {};

  const lines = text.split("\n");

  for (let line of lines) {

    // Keep tabs, only trim newlines
    line = line.replace(/\r/g, "");

    if (!line.trim()) continue;

    const cols = line.split("\t");

    /*
      Format possibilities:

      value1\tkey\tvalue2
      \tkey\tvalue2
      value1\tkey\t
      key\tvalue2   (rare)

      We want:
      - key must exist
      - value2 must exist
      - value1 optional
    */

    if (cols.length < 2) continue;

    let value1 = "";
    let key = "";
    let value2 = "";

    if (cols.length >= 3) {
      value1 = cols[0].trim();
      key = cols[1].trim().toUpperCase();
      value2 = cols[2].trim();
    }
    else if (cols.length === 2) {
      key = cols[0].trim().toUpperCase();
      value2 = cols[1].trim();
    }

    // Require key + value2
    if (!key || key.length !== 2) continue;
    if (!value2) continue;

    if (!out[key]) {
      out[key] = [];
    }

    out[key].push([value1, value2]);
  }

  return out;
}



function getData() {
  return active === "corner" ? dataCorner : dataEdge;
}


function updateStatus(msg, cacheInfo = "") {

  if (cacheInfo) {
    status.textContent = `${msg} • ${cacheInfo}`;
  } else {
    status.textContent = msg;
  }
}



function clearAll() {

  input.value = "";
  result.textContent = "";

  updateStatus("Cleared");

  input.focus();
}


function lookup(key) {
  const data = getData();
  result.innerHTML = "";

  if (!data[key] || data[key].length === 0) {
    updateStatus("No results");
    return;
  }

  const [value1, value2] = data[key][0]; // only one result

  updateStatus("Found");

  // Create card
  const card = document.createElement("div");
  card.className = "card";

  // Key element (big and bold)
  const keyEl = document.createElement("div");
  keyEl.className = "card-key";
  keyEl.textContent = key;

  card.appendChild(keyEl);

  // Note element (optional, muted, italic)
  if (value1) {
    const noteEl = document.createElement("div");
    noteEl.className = "card-note";
    noteEl.textContent = value1;
    card.appendChild(noteEl);
  }

  // Algorithm element (large, centered)
  const val2El = document.createElement("div");
  val2El.className = "card-value2";
  val2El.textContent = value2;
  card.appendChild(val2El);

  result.appendChild(card);
}

input.addEventListener("input", () => {

  let val = input.value.toUpperCase().slice(0, 2);

  input.value = val;

  if (val.length === 2) {

    lookup(val);

    setTimeout(() => {
      input.value = "";
    }, 60);
  }
});


input.addEventListener("focus", () => {
  input.select();
});

switchBtn.addEventListener("click", () => {

  active = active === "corner" ? "edge" : "corner";

  switchBtn.textContent =
    active === "corner"
      ? "Corners"
      : "Edges";

  updateStatus(`Switched to ${active}`);
});

clearBtn.addEventListener("click", clearAll);
refreshBtn.addEventListener("click", fetchData);

/* ======================
   SHORTCUTS
====================== */

document.addEventListener("keydown", e => {

  // Tab = switch
  if (e.key === "Tab") {
    e.preventDefault();
    switchBtn.click();
  }

  // Space = clear
  if (e.key === " ") {
    e.preventDefault();
    clearAll();
  }

  // Ctrl+D = dark
  if (e.ctrlKey && e.key.toLowerCase() === "d") {
    e.preventDefault();
    document.body.classList.toggle("dark");
  }
});

async function init() {

  const cache = loadCache();

  if (cache) {

    dataCorner = cache.corner;
    dataEdge = cache.edge;

    updateStatus(
      "Loaded from cache",
      `Last: ${cache.timeText}`
    );

  } else {

    updateStatus("No cache — fetching...");

    await fetchData();
  }

  input.focus();
}

init();
