const { invoke } = window.__TAURI__.core;
const { open } = window.__TAURI__.dialog;
const { listen } = window.__TAURI__.event;
const updater = window.__TAURI__.updater;
const processApi = window.__TAURI__.process;

const selectedFolder = document.querySelector("#selected-folder");
const chooseFolderButton = document.querySelector("#choose-folder");
const removeSelectedFolderButton = document.querySelector("#remove-selected-folder");
const scanFolderButton = document.querySelector("#scan-folder");
const normalizeFolderButton = document.querySelector("#normalize-folder");
const message = document.querySelector("#message");
const targetsList = document.querySelector("#targets");
const resultBox = document.querySelector(".result-box");
const logsList = document.querySelector("#logs");
const batchProgress = document.querySelector("#batch-progress");
const progressTitle = document.querySelector("#progress-title");
const progressCount = document.querySelector("#progress-count");
const progressBar = document.querySelector("#progress-bar");
const progressDetail = document.querySelector("#progress-detail");
const folderList = document.querySelector("#folder-list");
const waitTimeSelect = document.querySelector("#wait-time");
const defaultRecursiveInput = document.querySelector("#default-recursive");
const selectedFolderEnabledInput = document.querySelector("#selected-folder-enabled");
const selectedFolderRecursiveInput = document.querySelector("#selected-folder-recursive");
const autoWatchInput = document.querySelector("#auto-watch");
const launchAtLoginInput = document.querySelector("#launch-at-login");
const watchStatus = document.querySelector("#watch-status");
const waitSummary = document.querySelector("#wait-summary");
const folderCount = document.querySelector("#folder-count");
const refreshLogsButton = document.querySelector("#refresh-logs");
const tabButtons = document.querySelectorAll("[data-tab]");
const tabPanels = document.querySelectorAll("[data-panel]");
const appVersion = document.querySelector("#app-version");
const appDataDir = document.querySelector("#app-data-dir");
const settingsPath = document.querySelector("#settings-path");
const logPath = document.querySelector("#log-path");
const launchState = document.querySelector("#launch-state");
const websiteLink = document.querySelector("#website-link");
const checkUpdateButton = document.querySelector("#check-update");
const updateState = document.querySelector("#update-state");
const updateProgress = document.querySelector("#update-progress");
const updateProgressBar = document.querySelector("#update-progress-bar");
const updateProgressDetail = document.querySelector("#update-progress-detail");

let folderPath = "";
let lastTargets = [];
let settings = defaultSettings();
let progressHideTimer = null;

chooseFolderButton.addEventListener("click", async () => {
  const selection = await open({
    directory: true,
    multiple: true,
    title: "감시할 폴더 추가"
  });

  const selectedFolders = normalizeDialogSelection(selection);
  if (selectedFolders.length === 0) {
    return;
  }

  const addResult = addWatchFolders(selectedFolders);
  selectFolder(addResult.selectedPath);
  await saveCurrentSettings({ syncWatch: settings.autoWatchEnabled });

  if (addResult.addedCount === 0) {
    message.textContent = "이미 저장된 폴더입니다. 먼저 검사해보세요.";
    return;
  }

  message.textContent = `${addResult.addedCount}개 폴더를 추가했습니다. 먼저 검사해보세요.`;
});

waitTimeSelect.addEventListener("change", async () => {
  settings.stabilizationWaitMs = Number(waitTimeSelect.value);
  await saveCurrentSettings();
});

defaultRecursiveInput.addEventListener("change", async () => {
  settings.defaultRecursive = defaultRecursiveInput.checked;
  await saveCurrentSettings();
});

selectedFolderEnabledInput.addEventListener("change", async () => {
  const folder = currentFolder();
  if (!folder) {
    return;
  }

  folder.enabled = selectedFolderEnabledInput.checked;
  await saveCurrentSettings({ syncWatch: settings.autoWatchEnabled });
});

selectedFolderRecursiveInput.addEventListener("change", async () => {
  const folder = currentFolder();
  if (!folder) {
    return;
  }

  folder.recursive = selectedFolderRecursiveInput.checked;
  await saveCurrentSettings({ syncWatch: settings.autoWatchEnabled });
});

autoWatchInput.addEventListener("change", async () => {
  settings.autoWatchEnabled = autoWatchInput.checked;
  await saveCurrentSettings({ syncWatch: true });
});

launchAtLoginInput.addEventListener("change", async () => {
  settings.launchAtLogin = launchAtLoginInput.checked;
  await saveCurrentSettings();
});

refreshLogsButton.addEventListener("click", loadRecentLogs);
websiteLink.addEventListener("click", async (event) => {
  event.preventDefault();

  try {
    await invoke("open_website");
  } catch (error) {
    updateState.textContent = "웹사이트 열기 실패";
    updateState.title = String(error);
  }
});

checkUpdateButton.addEventListener("click", checkForUpdates);
removeSelectedFolderButton.addEventListener("click", async () => {
  await removeSelectedFolder();
});

for (const button of tabButtons) {
  button.addEventListener("click", () => {
    showTab(button.dataset.tab);
  });
}

scanFolderButton.addEventListener("click", async () => {
  if (!folderPath) {
    return;
  }

  await runWithBusyState(scanFolderButton, "검사 중", async () => {
    hideProgress();
    lastTargets = await invoke("scan_folder", {
      path: folderPath,
      recursive: currentFolder()?.recursive ?? settings.defaultRecursive
    });

    setResultBoxVisible(true);
    renderTargets(lastTargets);
    normalizeFolderButton.disabled = lastTargets.length === 0;
    message.textContent = lastTargets.length === 0
      ? "정리할 파일명이나 폴더명이 없습니다."
      : `${lastTargets.length}개 항목을 정리할 수 있습니다.`;
  });
});

normalizeFolderButton.addEventListener("click", async () => {
  if (!folderPath) {
    return;
  }

  await runWithBusyState(normalizeFolderButton, "정리 중", async () => {
    showProgress("정리 준비 중", 0, lastTargets.length);
    const results = await invoke("normalize_folder", {
      path: folderPath,
      recursive: currentFolder()?.recursive ?? settings.defaultRecursive,
      dryRun: false,
      stabilizationWaitMs: settings.stabilizationWaitMs
    });

    setResultBoxVisible(true);
    renderResults(results);
    await loadRecentLogs();
    lastTargets = [];
    normalizeFolderButton.disabled = true;
    message.textContent = `${results.length}개 항목 처리 결과를 기록했습니다.`;
    hideProgressSoon();
  });
});

init();

async function init() {
  settings = await invoke("load_settings");
  applySettingsToUi();
  await loadAppInfo();
  await refreshWatchStatus();
  await loadRecentLogs();
  await listen("watcher-results", async (event) => {
    const results = Array.isArray(event.payload) ? event.payload : [];
    if (results.length > 0) {
      renderResults(results);
      showTab("logs");
      message.textContent = `자동 감시로 ${results.length}개 항목을 정리했습니다.`;
      await loadRecentLogs();
    }
  });
  await listen("manual-results", async (event) => {
    const results = Array.isArray(event.payload) ? event.payload : [];
    renderResults(results);
    showTab("logs");
    message.textContent = results.length === 0
      ? "즉시 확인할 항목이 없습니다."
      : `즉시 확인 및 변경으로 ${results.length}개 항목을 정리했습니다.`;
    await loadRecentLogs();
    setButtonsDisabled(false);
    renderSelectedFolderControls();
    hideProgressSoon();
  });
  await listen("normalize-progress", (event) => {
    renderProgressEvent(event.payload);
  });
}

function showTab(tabName) {
  for (const button of tabButtons) {
    button.classList.toggle("active", button.dataset.tab === tabName);
  }

  for (const panel of tabPanels) {
    panel.classList.toggle("active", panel.dataset.panel === tabName);
  }
}

async function loadRecentLogs() {
  const logs = await invoke("recent_logs", { limit: 10 });
  renderLogs(logs);
}

async function loadAppInfo() {
  const info = await invoke("app_info");
  appVersion.textContent = `Version ${info.version}`;
  appDataDir.textContent = info.appDataDir;
  appDataDir.title = info.appDataDir;
  settingsPath.textContent = info.settingsPath;
  settingsPath.title = info.settingsPath;
  logPath.textContent = info.logPath;
  logPath.title = info.logPath;
  launchState.textContent = info.launchAtLogin ? "켜짐" : "꺼짐";
}

async function checkForUpdates() {
  if (!updater?.check || !processApi?.relaunch) {
    updateState.textContent = "사용할 수 없음";
    updateState.title = "업데이트 플러그인을 불러오지 못했습니다.";
    return;
  }

  checkUpdateButton.disabled = true;
  updateState.textContent = "확인 중";
  updateState.removeAttribute("title");
  hideUpdateProgress();

  try {
    const update = await updater.check();

    if (!update) {
      updateState.textContent = "최신 버전";
      return;
    }

    updateState.textContent = `새 버전 ${update.version}`;
    showUpdateProgress("다운로드 준비 중", 0, 1);

    let downloaded = 0;
    let contentLength = 0;
    await update.downloadAndInstall((event) => {
      if (event.event === "Started") {
        downloaded = 0;
        contentLength = Number(event.data.contentLength) || 0;
        showUpdateProgress("다운로드 중", 0, contentLength || 1);
        return;
      }

      if (event.event === "Progress") {
        downloaded += Number(event.data.chunkLength) || 0;
        showUpdateProgress("다운로드 중", downloaded, contentLength || downloaded || 1);
        return;
      }

      if (event.event === "Finished") {
        showUpdateProgress("설치 중", contentLength || downloaded || 1, contentLength || downloaded || 1);
      }
    });

    updateState.textContent = "재시작 중";
    await processApi.relaunch();
  } catch (error) {
    const errorText = String(error);
    const userMessage = errorText.includes("platforms")
      ? "배포 파일 확인 필요"
      : "업데이트 정보를 확인할 수 없습니다.";
    updateState.textContent = "확인 실패";
    updateState.title = errorText;
    updateProgressDetail.textContent = userMessage;
    updateProgressDetail.title = errorText;
    updateProgress.hidden = false;
  } finally {
    checkUpdateButton.disabled = false;
  }
}

async function saveCurrentSettings(options = {}) {
  settings = await invoke("save_settings", { settings });
  applySettingsToUi();
  await loadAppInfo();

  if (options.syncWatch) {
    await syncAutoWatch();
  } else {
    await refreshWatchStatus();
  }
}

async function syncAutoWatch() {
  const status = settings.autoWatchEnabled
    ? await invoke("start_auto_watch")
    : await invoke("stop_auto_watch");
  renderWatchStatus(status);
}

async function refreshWatchStatus() {
  const status = await invoke("auto_watch_status");
  renderWatchStatus(status);
}

function renderWatchStatus(status) {
  if (status.running) {
    watchStatus.textContent = `자동 감시 중 (${status.folderCount}개)`;
    return;
  }

  watchStatus.textContent = settings.autoWatchEnabled
    ? "감시할 폴더 없음"
    : "수동 검사 우선";
}

function applySettingsToUi() {
  settings = normalizeSettings(settings);
  waitTimeSelect.value = String(settings.stabilizationWaitMs);
  defaultRecursiveInput.checked = settings.defaultRecursive;
  autoWatchInput.checked = settings.autoWatchEnabled;
  launchAtLoginInput.checked = settings.launchAtLogin;
  waitSummary.textContent = `${settings.stabilizationWaitMs / 1000}초`;
  folderCount.textContent = `${settings.watchFolders.length}개`;

  if (!folderPath && settings.watchFolders.length > 0) {
    folderPath = settings.watchFolders[0].path;
  } else if (folderPath) {
    const stillExists = settings.watchFolders.some((folder) => folder.path === folderPath);
    if (!stillExists) {
      folderPath = settings.watchFolders[0]?.path ?? "";
    }
  }

  renderFolderList();
  renderSelectedFolderControls();
}

function renderFolderList() {
  if (settings.watchFolders.length === 0) {
    folderList.innerHTML = emptyFolderRows().join("");
    return;
  }

  const rows = settings.watchFolders.map((folder, index) => {
    const recursiveLabel = folder.recursive ? "하위 폴더 포함" : "현재 폴더만";
    const enabledLabel = folder.enabled ? "감시 켬" : "감시 끔";
    const enabledClass = folder.enabled ? "is-enabled" : "is-disabled";
    const selectedRowClass = folder.path === folderPath ? " is-selected" : "";
    return `
      <li class="folder-row ${enabledClass}${selectedRowClass}" data-index="${index}">
        <div class="folder-main">
          <span class="folder-name">${escapeHtml(lastPathComponent(folder.path))}</span>
          <span class="folder-meta">${escapeHtml(folder.path)}</span>
          <span class="folder-badges">
            <span>${escapeHtml(enabledLabel)}</span>
            <span>${escapeHtml(recursiveLabel)}</span>
          </span>
        </div>
      </li>
    `;
  });

  folderList.innerHTML = rows.concat(emptyFolderRows(Math.max(0, 3 - rows.length))).join("");
}

folderList.addEventListener("click", async (event) => {
  const row = event.target.closest(".folder-row[data-index]");
  if (!row) {
    return;
  }

  const index = Number(row.dataset.index);
  const folder = settings.watchFolders[index];

  if (!folder) {
    return;
  }

  selectFolder(folder.path);
});

function selectFolder(path, options = {}) {
  folderPath = path;
  lastTargets = [];
  selectedFolder.textContent = folderPath;
  scanFolderButton.disabled = false;
  normalizeFolderButton.disabled = true;
  setResultBoxVisible(false);
  renderTargets([]);
  renderSelectedFolderControls();
  if (options.render !== false) {
    renderFolderList();
  }
}

function currentFolder() {
  return settings.watchFolders.find((folder) => folder.path === folderPath);
}

function normalizeDialogSelection(selection) {
  if (!selection) {
    return [];
  }

  return Array.isArray(selection) ? selection : [selection];
}

function addWatchFolders(paths) {
  let addedCount = 0;
  let selectedPath = paths[0] ?? "";

  for (const path of paths) {
    const exists = settings.watchFolders.some((folder) => folder.path === path);
    if (exists) {
      continue;
    }

    settings.watchFolders.push({
      path,
      recursive: settings.defaultRecursive,
      enabled: true
    });
    addedCount += 1;
    selectedPath = path;
  }

  return { addedCount, selectedPath };
}

async function removeSelectedFolder() {
  if (!folderPath) {
    return;
  }

  const index = settings.watchFolders.findIndex((folder) => folder.path === folderPath);
  if (index === -1) {
    return;
  }

  settings.watchFolders.splice(index, 1);
  folderPath = settings.watchFolders[Math.max(0, index - 1)]?.path ?? settings.watchFolders[0]?.path ?? "";
  lastTargets = [];
  setResultBoxVisible(false);
  renderTargets([]);
  normalizeFolderButton.disabled = true;
  await saveCurrentSettings({ syncWatch: settings.autoWatchEnabled });
  message.textContent = folderPath
    ? "선택한 폴더를 삭제했습니다."
    : "저장된 폴더가 없습니다.";
}

function renderSelectedFolderControls() {
  const folder = currentFolder();
  const hasFolder = Boolean(folder);

  selectedFolder.textContent = folder?.path ?? "선택된 폴더가 없습니다.";
  selectedFolderEnabledInput.checked = folder?.enabled ?? false;
  selectedFolderRecursiveInput.checked = folder?.recursive ?? false;
  selectedFolderEnabledInput.disabled = !hasFolder;
  selectedFolderRecursiveInput.disabled = !hasFolder;
  removeSelectedFolderButton.disabled = !hasFolder;
  scanFolderButton.disabled = !hasFolder;

  if (!hasFolder) {
    normalizeFolderButton.disabled = true;
  }
}

function emptyFolderRows(count = 5) {
  return Array.from({ length: count }, () => "<li class=\"empty-row\"></li>");
}

function setResultBoxVisible(visible) {
  resultBox.classList.toggle("visible", visible);
}

async function runWithBusyState(button, busyText, callback) {
  const originalText = button.textContent;
  setButtonsDisabled(true);
  button.textContent = busyText;

  try {
    await callback();
  } catch (error) {
    message.textContent = `오류: ${error}`;
  } finally {
    button.textContent = originalText;
    setButtonsDisabled(false);
    scanFolderButton.disabled = !folderPath;
    normalizeFolderButton.disabled = lastTargets.length === 0;
    renderSelectedFolderControls();
  }
}

function renderProgressEvent(payload) {
  if (!payload || !payload.phase) {
    return;
  }

  const total = Number(payload.total) || 0;
  const completed = Number(payload.completed) || 0;

  if (payload.phase === "started") {
    showTab("folders");
    setButtonsDisabled(true);
    showProgress(total === 0 ? "정리할 항목 없음" : "정리 중", completed, total);
    progressDetail.textContent = total === 0
      ? "정리할 파일명이나 폴더명이 없습니다."
      : "항목을 하나씩 확인하고 있습니다.";
    return;
  }

  if (payload.phase === "item") {
    showProgress("정리 중", completed, total);
    const currentName = payload.currentName ?? "";
    const finalName = payload.finalName ?? "";
    const status = statusLabel(payload.status);
    const suffix = payload.reason ? ` · ${payload.reason}` : "";
    const detail = finalName
      ? `${status}: ${currentName} → ${finalName}${suffix}`
      : `${status}: ${currentName}${suffix}`;
    progressDetail.textContent = detail;
    progressDetail.title = detail;
    return;
  }

  if (payload.phase === "completed") {
    showProgress("정리 완료", total, total);
    progressDetail.textContent = total === 0
      ? "정리할 항목이 없습니다."
      : "모든 항목 처리가 끝났습니다.";
    hideProgressSoon();
  }
}

function showProgress(title, completed, total) {
  if (progressHideTimer) {
    clearTimeout(progressHideTimer);
    progressHideTimer = null;
  }

  const normalizedTotal = Math.max(Number(total) || 0, 0);
  const normalizedCompleted = Math.min(Math.max(Number(completed) || 0, 0), normalizedTotal);
  batchProgress.hidden = false;
  progressTitle.textContent = title;
  progressCount.textContent = `${normalizedCompleted} / ${normalizedTotal}`;
  progressBar.max = Math.max(normalizedTotal, 1);
  progressBar.value = normalizedTotal === 0 ? 0 : normalizedCompleted;
}

function hideProgressSoon(delay = 700) {
  if (progressHideTimer) {
    clearTimeout(progressHideTimer);
  }

  progressHideTimer = setTimeout(() => {
    hideProgress();
    setButtonsDisabled(false);
    renderSelectedFolderControls();
  }, delay);
}

function hideProgress() {
  if (progressHideTimer) {
    clearTimeout(progressHideTimer);
    progressHideTimer = null;
  }

  batchProgress.hidden = true;
  progressTitle.textContent = "정리 중";
  progressCount.textContent = "0 / 0";
  progressBar.max = 1;
  progressBar.value = 0;
  progressDetail.textContent = "항목을 준비하고 있습니다.";
  progressDetail.removeAttribute("title");
}

function showUpdateProgress(label, completed, total) {
  const normalizedTotal = Math.max(Number(total) || 1, 1);
  const normalizedCompleted = Math.min(Math.max(Number(completed) || 0, 0), normalizedTotal);
  updateProgress.hidden = false;
  updateProgressBar.max = normalizedTotal;
  updateProgressBar.value = normalizedCompleted;
  updateProgressDetail.textContent = label;
  updateProgressDetail.title = label;
}

function hideUpdateProgress() {
  updateProgress.hidden = true;
  updateProgressBar.max = 1;
  updateProgressBar.value = 0;
  updateProgressDetail.textContent = "대기 중";
  updateProgressDetail.removeAttribute("title");
}

function setButtonsDisabled(disabled) {
  chooseFolderButton.disabled = disabled;
  removeSelectedFolderButton.disabled = disabled || !folderPath;
  scanFolderButton.disabled = disabled;
  normalizeFolderButton.disabled = disabled;
  waitTimeSelect.disabled = disabled;
  defaultRecursiveInput.disabled = disabled;
  selectedFolderEnabledInput.disabled = disabled || !folderPath;
  selectedFolderRecursiveInput.disabled = disabled || !folderPath;
  autoWatchInput.disabled = disabled;
  launchAtLoginInput.disabled = disabled;
}

function renderTargets(targets) {
  if (targets.length === 0) {
    targetsList.innerHTML = "<li>정리할 항목이 없습니다.</li>";
    return;
  }

  targetsList.innerHTML = targets.map((target) => {
    const status = target.collision ? "충돌 처리" : "변환 예정";
    return `<li>${escapeHtml(status)}: ${escapeHtml(target.originalName)} → ${escapeHtml(target.finalName)}</li>`;
  }).join("");
}

function renderResults(results) {
  setResultBoxVisible(true);

  if (results.length === 0) {
    targetsList.innerHTML = "<li>처리한 항목이 없습니다.</li>";
    return;
  }

  targetsList.innerHTML = results.map((result) => {
    const status = statusLabel(result.status);
    const detail = result.reason ? ` (${result.reason})` : "";
    return `<li>${escapeHtml(status)}: ${escapeHtml(result.originalName)} → ${escapeHtml(result.finalName)}${escapeHtml(detail)}</li>`;
  }).join("");
}

function renderLogs(logs) {
  if (logs.length === 0) {
    logsList.innerHTML = "<li>아직 처리한 파일이 없습니다.</li>";
    return;
  }

  logsList.innerHTML = logs.map((entry) => {
    const date = new Date(Number(entry.timestampMs));
    const time = formatLogTime(date);
    const fullTime = date.toLocaleString("ko-KR");
    const message = logMessage(entry);
    const change = `${entry.originalName} → ${entry.finalName}`;
    const fullText = `${fullTime} · ${message} · ${change}`;

    return `
      <li class="log-row" title="${escapeHtml(fullText)}">
        <span class="log-time">${escapeHtml(time)}</span>
        <span class="log-message">${escapeHtml(message)}</span>
        <span class="log-change">${escapeHtml(change)}</span>
      </li>
    `;
  }).join("");
}

function formatLogTime(date) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function logMessage(entry) {
  const label = statusLabel(entry.status);
  return entry.reason ? `${label}: ${entry.reason}` : label;
}

function statusLabel(status) {
  switch (status) {
    case "success":
      return "성공";
    case "collision":
      return "충돌 처리";
    case "failed":
      return "실패";
    case "dry-run":
      return "검사";
    default:
      return status ?? "처리";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function lastPathComponent(path) {
  const normalized = String(path).replace(/\/+$/, "");
  const parts = normalized.split("/");
  return parts.at(-1) || normalized;
}

function defaultSettings() {
  return {
    watchFolders: [],
    autoWatchEnabled: false,
    launchAtLogin: false,
    stabilizationWaitMs: 3000,
    defaultRecursive: true
  };
}

function normalizeSettings(value) {
  return {
    ...defaultSettings(),
    ...value,
    watchFolders: Array.isArray(value?.watchFolders) ? value.watchFolders : []
  };
}
