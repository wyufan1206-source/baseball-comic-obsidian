// ===== Repo configuration =====
const GITHUB_OWNER = "ycshu";
const GITHUB_REPO  = "baseball-comic-obsidian";
const BRANCH       = "main";

// Data lives in repo root; we read it via GitHub Contents API (NOT via relative URLs)
const STUDENTS_DIR = "data/students";
const NAME_MAP_PATH = "data/student_name_map.json";

// ===== Utilities =====
function isStudentId(name) {
  // Accept 9–10 alphanumeric IDs (e.g., C44116146)
  return /^[A-Za-z0-9]{9,10}$/.test(name);
}

function ghApi(path) {
  return `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}?ref=${BRANCH}`;
}

async function fetchJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

function decodeContent(j) {
  // GitHub API returns base64 with potential newlines
  const b64 = (j.content || "").replace(/\n/g, "");
  return decodeURIComponent(escape(atob(b64)));
}

function el(id){ return document.getElementById(id); }

// ===== App State =====
let nameMap = {};
let datasets = []; // { owner, path, data }

// ===== Loaders =====
async function loadNameMap(){
  try{
    const j = await fetchJson(ghApi(NAME_MAP_PATH));
    nameMap = JSON.parse(decodeContent(j));
  }catch(e){
    console.warn("Name map load failed:", e);
    nameMap = {};
  }
}

async function scanStudents(){
  const listing = await fetchJson(ghApi(STUDENTS_DIR));
  const dirs = listing.filter(x => x.type === "dir" && isStudentId(x.name));
  return dirs.map(d => d.name);
}

async function loadDataset(studentId){
  const path = `${STUDENTS_DIR}/${studentId}/index.json`;
  const j = await fetchJson(ghApi(path));
  const data = JSON.parse(decodeContent(j));
  return { owner: studentId, path, data };
}

// ===== UI =====
function renderProviders(){
  const ul = el("providersList");
  ul.innerHTML = "";
  datasets.forEach(ds=>{
    const li = document.createElement("li");
    const id = ds.owner;
    const label = nameMap[id] ? `${nameMap[id]}（${id}）` : id;
    li.innerHTML = `<label><input type="checkbox" data-owner="${id}" checked> ${label}</label>`;
    ul.appendChild(li);
  });
  el("providersNote").textContent = `共 ${datasets.length} 位`;
}

function selectedOwners(){
  return Array.from(document.querySelectorAll("#providersList input[type=checkbox]:checked"))
    .map(x=>x.dataset.owner);
}

function search(q){
  const owners = new Set(selectedOwners());
  const hits = [];
  datasets.forEach(ds=>{
    if(!owners.has(ds.owner)) return;
    const sections = ["players","events","glossary"];
    sections.forEach(sec=>{
      (ds.data[sec]||[]).forEach(item=>{
        const text = JSON.stringify(item);
        if(text.includes(q)){
          hits.push({ owner: ds.owner, sec, item });
        }
      });
    });
  });
  return hits;
}

function renderResults(items){
  const box = el("results");
  box.innerHTML = "";
  el("resultsSummary").textContent = `找到 ${items.length} 筆`;
  items.forEach(x=>{
    const d = document.createElement("div");
    d.className = "card small";
    d.textContent = `[${x.owner}] ${x.sec} :: ${x.item.name_zh || x.item.title || x.item.term || x.item.id}`;
    box.appendChild(d);
  });
}

function generateScript(){
  const owners = selectedOwners();
  const parts = [];
  owners.forEach(id=>{
    const ds = datasets.find(x=>x.owner===id);
    if(!ds) return;
    parts.push(`## ${nameMap[id] || id}`);
    ["players","events","glossary"].forEach(sec=>{
      (ds.data[sec]||[]).forEach(it=>{
        parts.push(`- ${it.name_zh || it.title || it.term || it.id}: ${it.summary || it.explain_zh || ""}`);
      });
    });
  });
  el("scriptOut").value = parts.join("\n");
}

// ===== Init =====
async function init(){
  try{
    await loadNameMap();
    const ids = await scanStudents();
    const loaded = [];
    for(const id of ids){
      try{
        loaded.push(await loadDataset(id));
      }catch(e){
        console.warn("Dataset load failed:", id, e);
      }
    }
    datasets = loaded;
    el("status").textContent = `完成載入：${datasets.length} 份可用資料集`;
    renderProviders();
  }catch(e){
    console.error(e);
    el("status").textContent = "載入失敗";
  }
}

document.addEventListener("DOMContentLoaded", ()=>{
  init();
  el("btnSearch").onclick = ()=>{
    const q = el("q").value.trim();
    renderResults(q ? search(q) : []);
  };
  el("btnClear").onclick = ()=>{
    el("q").value = "";
    el("results").innerHTML = "";
    el("resultsSummary").textContent = "";
  };
  el("btnGenerate").onclick = generateScript;
  el("btnCopy").onclick = ()=>{
    el("scriptOut").select();
    document.execCommand("copy");
  };
  el("btnAll").onclick = ()=>document.querySelectorAll("#providersList input").forEach(x=>x.checked=true);
  el("btnNone").onclick = ()=>document.querySelectorAll("#providersList input").forEach(x=>x.checked=false);
  el("btnInvert").onclick = ()=>document.querySelectorAll("#providersList input").forEach(x=>x.checked=!x.checked);
});
