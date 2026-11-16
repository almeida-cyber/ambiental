import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  initializeFirestore,
  collection,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
  setDoc,
  getDoc,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";
import { firebaseConfig } from "./firebase-config.js";

const configured = Boolean(
  firebaseConfig?.apiKey &&
  firebaseConfig?.projectId &&
  firebaseConfig.apiKey !== "SUA_API_KEY" &&
  firebaseConfig.projectId !== "SEU-PROJETO"
);

const app = configured ? initializeApp(firebaseConfig) : null;
const auth = app ? getAuth(app) : null;
const db = app
  ? initializeFirestore(app, {
      experimentalForceLongPolling: true
    })
  : null;
const storage = app ? getStorage(app) : null;

const $ = (id) => document.getElementById(id);
const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

let reports = [];
let settings = {};
let currentUser = null;
let reportsUnsubscribe = null;

function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 3000);
}

function safe(value = "") {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));
}

function showPage(page) {
  document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
  $(page + "Page").classList.remove("hidden");
  document.querySelectorAll(".nav-link").forEach((b) => b.classList.toggle("active", b.dataset.page === page));
  $("pageTitle").textContent = ({
    dashboard: "Dashboard",
    reports: "Relatórios mensais",
    annual: "Relatório anual",
    settings: "Configurações"
  })[page];
}

function initSelects() {
  months.forEach((m, i) => $("reportMonth").add(new Option(m, String(i + 1).padStart(2, "0"))));
  $("reportYear").value = new Date().getFullYear();
  syncYearOptions();
}

function syncYearOptions() {
  const currentYear = new Date().getFullYear();
  const years = [...new Set([
    currentYear - 1,
    currentYear,
    currentYear + 1,
    ...reports.map((r) => Number(r.year)).filter(Number.isInteger)
  ])].sort((a, b) => b - a);

  for (const id of ["filterYear", "annualYear"]) {
    const sel = $(id);
    const prev = Number(sel.value) || currentYear;
    sel.innerHTML = "";
    years.forEach((y) => sel.add(new Option(y, y)));
    sel.value = years.includes(prev) ? prev : currentYear;
  }
}

function activityTemplate(data = {}) {
  const wrap = document.createElement("div");
  wrap.className = "activity-card";
  wrap._existingPhotos = Array.isArray(data.photos) ? [...data.photos] : [];
  wrap._removedPhotoPaths = [];

  wrap.innerHTML = `
    <div class="activity-top"><strong>Atividade</strong><button type="button" class="remove-activity">Remover</button></div>
    <div class="activity-fields">
      <label class="wide">Nome da ação<input data-field="title" required value="${safe(data.title || "")}" placeholder="Ex.: Palestra de educação ambiental"></label>
      <label>Data<input data-field="date" type="date" value="${safe(data.date || "")}"></label>
      <label>Tipo de ação<select data-field="type"><option value="Educação ambiental">Educação ambiental</option><option value="Campanha">Campanha</option><option value="Ação comunitária">Ação comunitária</option><option value="Visita técnica">Visita técnica</option><option value="Plantio">Plantio</option><option value="Outro">Outro</option></select></label>
      <label>Local / instituição<input data-field="place" value="${safe(data.place || "")}" placeholder="Escola, bairro ou comunidade"></label>
      <label>Participantes (quantidade)<input data-field="participants" type="number" min="0" value="${Number(data.participants || 0)}"></label>
      <label class="wide">Descrição e resultados<textarea data-field="description" rows="3" placeholder="Descreva o que foi realizado e os resultados...">${safe(data.description || "")}</textarea></label>
      <label class="wide">Fotografias<input data-field="photos" type="file" accept="image/*" multiple><small class="muted">As imagens serão armazenadas no Firebase Storage (máx. 8 MB por arquivo).</small><div class="photo-preview"></div></label>
    </div>`;

  wrap.querySelector(".remove-activity").onclick = () => wrap.remove();
  const type = wrap.querySelector('[data-field="type"]');
  if (data.type) type.value = data.type;

  const preview = wrap.querySelector(".photo-preview");
  const renderPreviews = () => {
    preview.innerHTML = "";
    wrap._existingPhotos.forEach((p, idx) => {
      const item = document.createElement("div");
      item.className = "photo-thumb";
      item.innerHTML = `<img src="${safe(p.url)}" alt="${safe(p.name || "Fotografia da atividade")}"><button type="button" title="Remover foto">✕</button>`;
      item.querySelector("button").onclick = () => {
        if (p.path) wrap._removedPhotoPaths.push(p.path);
        wrap._existingPhotos.splice(idx, 1);
        renderPreviews();
      };
      preview.append(item);
    });
  };
  renderPreviews();

  wrap.querySelector('[data-field="photos"]').onchange = (ev) => {
    renderPreviews();
    [...ev.target.files].forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const item = document.createElement("div");
      item.className = "photo-thumb";
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      img.alt = file.name;
      img.onload = () => URL.revokeObjectURL(img.src);
      item.append(img);
      preview.append(item);
    });
  };

  return wrap;
}

function openDialog(report = null) {
  $("reportForm").reset();
  $("reportMessage").textContent = "";
  $("activitiesContainer").innerHTML = "";
  $("reportId").value = report?.id || "";
  $("dialogTitle").textContent = report ? "Editar relatório" : "Novo relatório";
  $("reportMonth").value = report?.month || String(new Date().getMonth() + 1).padStart(2, "0");
  $("reportYear").value = report?.year || new Date().getFullYear();
  $("reportTitle").value = report?.title || "";
  $("reportIntro").value = report?.intro || "";

  (report?.activities || []).forEach((a) => $("activitiesContainer").append(activityTemplate(a)));
  if (!report) $("activitiesContainer").append(activityTemplate());
  $("reportDialog").showModal();
}

function collectActivityCards() {
  return [...$("activitiesContainer").querySelectorAll(".activity-card")].map((card) => ({
    card,
    title: card.querySelector('[data-field="title"]').value.trim(),
    date: card.querySelector('[data-field="date"]').value,
    type: card.querySelector('[data-field="type"]').value,
    place: card.querySelector('[data-field="place"]').value.trim(),
    participants: Number(card.querySelector('[data-field="participants"]').value || 0),
    description: card.querySelector('[data-field="description"]').value.trim(),
    files: [...card.querySelector('[data-field="photos"]').files],
    existingPhotos: card._existingPhotos || [],
    removedPhotoPaths: card._removedPhotoPaths || []
  }));
}

async function uploadPhotos(files, userId, reportId, activityIndex) {
  const photos = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    if (file.size > 8 * 1024 * 1024) {
      throw new Error(`A imagem "${file.name}" excede o limite de 8 MB.`);
    }
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `users/${userId}/reports/${reportId}/activity-${activityIndex}/${Date.now()}-${safeName}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    photos.push({
      name: file.name,
      path,
      url: await getDownloadURL(storageRef)
    });
  }
  return photos;
}

async function saveReport(e) {
  e.preventDefault();
  if (!currentUser) return;

  const submitBtn = $("reportForm").querySelector('button[type="submit"]');
  const msgEl = $("reportMessage");
  msgEl.textContent = "";

  const existingId = $("reportId").value.trim();
  const month = String($("reportMonth").value);
  const year = parseInt($("reportYear").value, 10);
  const title = $("reportTitle").value.trim();
  const intro = $("reportIntro").value.trim();

  if (!title || !month || !Number.isInteger(year)) {
    msgEl.textContent = "Preencha o mês, o ano e o título do relatório.";
    return;
  }

  const rawActivities = collectActivityCards();
  if (!rawActivities.length) {
    msgEl.textContent = "Adicione pelo menos uma atividade ao relatório.";
    return;
  }

  submitBtn.disabled = true;
  const originalLabel = submitBtn.textContent;
  submitBtn.textContent = "Salvando...";

  try {
    const reportRef = existingId
      ? doc(db, "reports", existingId)
      : doc(collection(db, "reports"));

    const activities = [];
    for (let i = 0; i < rawActivities.length; i++) {
      const act = rawActivities[i];
      const uploadedPhotos = act.files.length
        ? await uploadPhotos(act.files, currentUser.uid, reportRef.id, i)
        : [];

      activities.push({
        title: act.title,
        date: act.date,
        type: act.type,
        place: act.place,
        participants: Number.isFinite(act.participants) ? act.participants : 0,
        description: act.description,
        photos: [...act.existingPhotos, ...uploadedPhotos]
      });
    }

    const removedPaths = rawActivities.flatMap((act) => act.removedPhotoPaths);
    for (const path of removedPaths) {
      if (path) {
        try {
          await deleteObject(ref(storage, path));
        } catch (err) {
          if (err?.code !== "storage/object-not-found") {
            console.warn("Não foi possível remover foto antiga:", err);
          }
        }
      }
    }

    const payload = {
      ownerUid: currentUser.uid,
      month,
      year,
      title,
      intro,
      activities,
      updatedAt: serverTimestamp()
    };

    if (existingId) {
      await updateDoc(reportRef, payload);
    } else {
      payload.createdAt = serverTimestamp();
      await setDoc(reportRef, payload);
    }

    $("reportDialog").close();
    toast(existingId ? "Relatório atualizado." : "Relatório salvo.");
  } catch (error) {
    console.error("Erro ao salvar relatório:", error);
    msgEl.textContent = firebaseError(error);
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
}

function loadReports() {
  if (reportsUnsubscribe) reportsUnsubscribe();
  const q = query(collection(db, "reports"), where("ownerUid", "==", currentUser.uid));
  reportsUnsubscribe = onSnapshot(q, (snap) => {
    reports = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (Number(b.year) - Number(a.year)) || String(b.month).localeCompare(String(a.month)));
    syncYearOptions();
    renderReports();
    renderDashboard();
    renderAnnual();
  }, (error) => {
    console.error("Erro ao acompanhar relatórios:", error);
    toast(firebaseError(error));
  });
}

function renderReports() {
  const year = Number($("filterYear").value);
  const term = $("searchReports").value.toLowerCase();
  const filtered = reports.filter((r) => Number(r.year) === year && (r.title + " " + (months[Number(r.month) - 1] || "")).toLowerCase().includes(term));
  $("reportsList").innerHTML = filtered.length ? "" : '<div class="empty-state">Nenhum relatório encontrado para este filtro.</div>';
  filtered.forEach((r) => $("reportsList").append(reportRow(r)));
}

function reportRow(r) {
  const el = document.createElement("article");
  el.className = "report-item";
  const count = (r.activities || []).length;
  el.innerHTML = `<div><h3>${safe(r.title)}</h3><p>${months[Number(r.month) - 1] || r.month} de ${r.year} · ${count} atividade(s)</p></div><div class="report-actions"><button class="btn secondary edit">Editar</button><button class="btn ghost export">Word</button><button class="btn ghost print">Imprimir / PDF</button><button class="btn ghost delete">Excluir</button></div>`;
  el.querySelector(".edit").onclick = () => openDialog(r);
  el.querySelector(".export").onclick = () => exportWord(r);
  el.querySelector(".print").onclick = () => printReport(r);
  el.querySelector(".delete").onclick = () => removeReport(r);
  return el;
}

async function removeReport(r) {
  if (!confirm(`Excluir o relatório "${r.title}"? Essa ação não poderá ser desfeita.`)) return;
  try {
    for (const activity of (r.activities || [])) {
      for (const photo of (activity.photos || [])) {
        if (photo.path) {
          try {
            await deleteObject(ref(storage, photo.path));
          } catch (error) {
            if (error.code !== "storage/object-not-found") {
              console.warn("Não foi possível excluir uma fotografia:", error);
            }
          }
        }
      }
    }
    await deleteDoc(doc(db, "reports", r.id));
    toast("Relatório excluído.");
  } catch (error) {
    console.error(error);
    toast(firebaseError(error));
  }
}

function renderDashboard() {
  const year = new Date().getFullYear();
  const current = reports.filter((r) => Number(r.year) === year);
  const acts = current.flatMap((r) => r.activities || []);
  $("statReports").textContent = current.length;
  $("statActivities").textContent = acts.length;
  $("statPeople").textContent = acts.reduce((s, a) => s + Number(a.participants || 0), 0).toLocaleString("pt-BR");
  $("statMonths").textContent = new Set(current.map((r) => r.month)).size + "/12";
  $("recentReports").innerHTML = "";
  if (!reports.length) {
    $("recentReports").className = "report-list empty-state";
    $("recentReports").textContent = "Nenhum relatório cadastrado ainda.";
  } else {
    $("recentReports").className = "report-list";
    reports.slice(0, 5).forEach((r) => $("recentReports").append(reportRow(r)));
  }
}

function annualHTML(year) {
  const list = reports.filter((r) => Number(r.year) === year).sort((a, b) => Number(a.month) - Number(b.month));
  const acts = list.flatMap((r) => r.activities || []);
  const people = acts.reduce((s, a) => s + Number(a.participants || 0), 0);
  const roleText = settings.role ? ` (${safe(settings.role)})` : "";

  let html = `<div class="annual-cover"><p class="eyebrow">CONSOLIDAÇÃO ANUAL</p><h2>Relatório Anual de Atividades Ambientais — ${year}</h2><p>${safe(settings.cityHall || "Prefeitura Municipal")} · ${safe(settings.department || "Secretaria Municipal de Meio Ambiente")}</p><p><strong>Responsável:</strong> ${safe(settings.responsible || "Não informado")}${roleText} · <strong>Município:</strong> ${safe(settings.municipality || "Não informado")}</p></div><div class="stats-grid"><div class="stat-card"><span>Relatórios</span><strong>${list.length}</strong></div><div class="stat-card"><span>Atividades</span><strong>${acts.length}</strong></div><div class="stat-card"><span>Participantes</span><strong>${people.toLocaleString("pt-BR")}</strong></div><div class="stat-card"><span>Meses registrados</span><strong>${new Set(list.map((r) => r.month)).size}/12</strong></div></div><h3>Resumo das atividades</h3>`;

  if (!list.length) html += '<p class="muted">Nenhum relatório cadastrado para este ano.</p>';
  list.forEach((r) => {
    html += `<section class="annual-month"><h3>${months[Number(r.month) - 1] || r.month} — ${safe(r.title)}</h3><p>${safe(r.intro || "")}</p>`;
    (r.activities || []).forEach((a) => {
      html += `<h4>${safe(a.title)}</h4><p><strong>Data:</strong> ${safe(a.date || "Não informada")} · <strong>Tipo:</strong> ${safe(a.type)} · <strong>Local:</strong> ${safe(a.place)} · <strong>Participantes:</strong> ${Number(a.participants || 0)}</p><p>${safe(a.description || "")}</p>`;
      (a.photos || []).forEach((p) => {
        html += `<figure><img src="${safe(p.url)}" alt="${safe(p.name)}"><figcaption>${safe(p.name)}</figcaption></figure>`;
      });
    });
    html += "</section>";
  });
  html += `<p class="muted">Documento gerado pelo Sistema de Gestão Ambiental.</p>`;
  return html;
}

function renderAnnual() {
  $("annualSummary").innerHTML = annualHTML(Number($("annualYear").value));
}

function documentShell(title, body) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${safe(title)}</title><style>body{font:12pt Arial;color:#222;line-height:1.5;margin:2cm}h1,h2,h3{color:#176b4b}h1{font-size:20pt}h2{font-size:16pt}h3{font-size:13pt}img{max-width:240px;max-height:190px;object-fit:contain}figure{display:inline-block;margin:8px}figcaption{font-size:9pt;color:#555}.cover{text-align:center;margin:60px 0 40px}.month{page-break-inside:avoid;border-top:1px solid #ccc;padding-top:15px}.meta{color:#555;font-size:10pt}@media print{body{margin:1.5cm}}</style></head><body>${body}</body></html>`;
}

function reportBody(r) {
  const roleText = settings.role ? ` (${safe(settings.role)})` : "";
  let body = `<div class="cover"><p>${safe(settings.cityHall || "Prefeitura Municipal")}</p><p>${safe(settings.department || "Secretaria Municipal de Meio Ambiente")}</p><h1>${safe(r.title)}</h1><p>${months[Number(r.month) - 1] || r.month} de ${r.year}</p><p class="meta">Responsável: ${safe(settings.responsible || "Não informado")}${roleText} · ${safe(settings.municipality || "")}</p></div><h2>Apresentação</h2><p>${safe(r.intro || "")}</p><h2>Atividades realizadas</h2>`;
  (r.activities || []).forEach((a) => {
    body += `<div class="month"><h3>${safe(a.title)}</h3><p><b>Data:</b> ${safe(a.date || "Não informada")} · <b>Tipo:</b> ${safe(a.type)} · <b>Local:</b> ${safe(a.place)} · <b>Participantes:</b> ${Number(a.participants || 0)}</p><p>${safe(a.description || "")}</p>`;
    (a.photos || []).forEach((p) => {
      body += `<figure><img src="${safe(p.url)}" alt="${safe(p.name)}"><figcaption>${safe(p.name)}</figcaption></figure>`;
    });
    body += "</div>";
  });
  return body;
}

function exportWord(r) {
  const html = documentShell(r.title, reportBody(r));
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  downloadBlob(blob, `relatorio-${r.year}-${r.month}.doc`);
}

function printReport(r) {
  const w = window.open("", "_blank");
  if (!w) {
    toast("Permita pop-ups para imprimir o relatório.");
    return;
  }
  w.document.write(documentShell(r.title, reportBody(r)));
  w.document.close();
  w.onload = () => w.print();
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAnnual() {
  const year = Number($("annualYear").value);
  const html = documentShell(`Relatório anual ${year}`, $("annualSummary").innerHTML);
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  downloadBlob(blob, `relatorio-anual-${year}.doc`);
}

async function loadSettings() {
  const snap = await getDoc(doc(db, "settings", currentUser.uid));
  settings = snap.exists() ? snap.data() : {};
  $("cityHall").value = settings.cityHall || "";
  $("department").value = settings.department || "";
  $("responsible").value = settings.responsible || "";
  $("role").value = settings.role || "";
  $("municipality").value = settings.municipality || "";
}

async function saveSettings(e) {
  e.preventDefault();
  if (!currentUser) return;
  $("settingsMessage").textContent = "";
  try {
    settings = {
      cityHall: $("cityHall").value.trim(),
      department: $("department").value.trim(),
      responsible: $("responsible").value.trim(),
      role: $("role").value.trim(),
      municipality: $("municipality").value.trim()
    };
    await setDoc(doc(db, "settings", currentUser.uid), settings);
    $("settingsMessage").textContent = "Identificação salva.";
    renderAnnual();
    toast("Configurações atualizadas.");
  } catch (error) {
    console.error("Erro ao salvar configurações:", error);
    $("settingsMessage").textContent = firebaseError(error);
  }
}

function setupEvents() {
  $("loginForm").onsubmit = async (e) => {
    e.preventDefault();
    $("loginMessage").textContent = "";

    if (window.location.protocol === "file:") {
      $("loginMessage").textContent = "Não abra direto pelo arquivo. Acesse pelo link da Vercel ou via Live Server.";
      return;
    }

    if (!configured) {
      $("loginMessage").textContent = "Configure as credenciais do Firebase em firebase-config.js antes de entrar.";
      return;
    }

    const btn = $("loginForm").querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Entrando...";

    try {
      await signInWithEmailAndPassword(auth, $("email").value.trim(), $("password").value);
    } catch (err) {
      console.error("Erro no login:", err);
      $("loginMessage").textContent = authError(err);
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  };

  $("logoutBtn").onclick = () => signOut(auth);
  document.querySelectorAll(".nav-link").forEach((b) => b.onclick = () => showPage(b.dataset.page));
  document.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => showPage(b.dataset.go));
  $("newReportBtn").onclick = $("newReportTop").onclick = () => openDialog();
  $("closeDialog").onclick = $("cancelDialog").onclick = () => $("reportDialog").close();
  $("addActivity").onclick = () => $("activitiesContainer").append(activityTemplate());
  $("reportForm").onsubmit = saveReport;
  $("filterYear").onchange = renderReports;
  $("searchReports").oninput = renderReports;
  $("annualYear").onchange = renderAnnual;
  $("exportAnnualWord").onclick = exportAnnual;
  $("printAnnual").onclick = printAnnual;
  $("settingsForm").onsubmit = saveSettings;
}

function authError(err) {
  const messages = {
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/user-not-found": "Usuário não encontrado no Firebase.",
    "auth/wrong-password": "Senha incorreta.",
    "auth/invalid-email": "Formato de e-mail inválido.",
    "auth/unauthorized-domain": "Domínio não autorizado! Adicione o endereço da Vercel no Firebase (Authentication > Settings > Authorized domains).",
    "auth/operation-not-allowed": "Ative o login por E-mail/senha no Firebase (Authentication > Sign-in method).",
    "auth/invalid-api-key": "Chave de API inválida no firebase-config.js.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    "auth/network-request-failed": "Falha de conexão. Verifique sua internet."
  };
  return messages[err.code] || `Erro ao entrar (${err.code || err.message})`;
}

function firebaseError(error) {
  const code = error?.code || "";
  if (code === "permission-denied") return "Acesso negado pelo Firebase. Confira as regras do Firestore/Storage.";
  if (code === "failed-precondition") return "O Firestore precisa de um índice. Abra o console do navegador.";
  if (code === "unavailable" || code === "auth/network-request-failed") return "Firebase indisponível. Verifique sua conexão e tente novamente.";
  if (code === "storage/unauthorized") return "Sem permissão para acessar fotografias. Confira as regras do Firebase Storage.";
  return error?.message || "Ocorreu um erro ao comunicar com o Firebase.";
}

function printAnnual() {
  const year = Number($("annualYear").value);
  const w = window.open("", "_blank");
  if (!w) {
    toast("Permita pop-ups para imprimir o relatório.");
    return;
  }
  w.document.write(documentShell(`Relatório anual ${year}`, $("annualSummary").innerHTML));
  w.document.close();
  w.onload = () => w.print();
}

function start() {
  initSelects();
  setupEvents();

  if (window.location.protocol === "file:") {
    $("loginMessage").textContent = "Atenção: abra o site pelo link da Vercel ou Live Server, não clicando duas vezes no index.html.";
    return;
  }

  if (!configured) {
    $("loginMessage").textContent = "Projeto ainda não conectado ao Firebase. Configure firebase-config.js.";
    return;
  }

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (!user && reportsUnsubscribe) {
      reportsUnsubscribe();
      reportsUnsubscribe = null;
      reports = [];
    }
    $("loginView").classList.toggle("hidden", !!user);
    $("appView").classList.toggle("hidden", !user);
    if (user) {
      $("userEmail").textContent = user.email || "Usuário autenticado";
      try {
        await loadSettings();
        loadReports();
      } catch (e) {
        console.error(e);
        toast(firebaseError(e));
      }
    }
  });
}

start();
