const headers = { "User-Agent": "x0XP-Item-Price-Checker - .x0xp on Discord" };

// Easter eggs
const easterEggs = {
  dance: true,
};

let itemMap = {};
let bossCollectionCache = {};
let selectedIndex = -1;
let debounceTimer;

// DOM elements
const searchInput = document.getElementById("itemSearch"),
  resultsDiv = document.getElementById("results"),
  priceBox = document.getElementById("priceDisplay"),
  historyDiv = document.getElementById("history"),
  pinnedDiv = document.getElementById("pinned"),
  card = document.querySelector(".card"),
  infoIcon = document.getElementById("infoIcon"),
  helpBox = document.getElementById("helpBox"),
  updatesIcon = document.getElementById("updatesIcon"),
  changelogBox = document.getElementById("changelogBox"),
  floatingContainer = document.getElementById("floatingContainer"),
  clearAllBtn = document.getElementById("clearAllFloating");

let helpVisible = false;
let changelogVisible = false;

