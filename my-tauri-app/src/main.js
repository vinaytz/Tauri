// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tauri Feature Explorer — Frontend (Vanilla JS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// KEY CONCEPT: With `withGlobalTauri: true` in tauri.conf.json,
// Tauri injects APIs into `window.__TAURI__`.
//   - invoke()  → call Rust #[tauri::command] functions
//   - listen()  → listen for events emitted from Rust
//   - emit()    → send events from JS to Rust
//
// This is the bridge between your JS frontend and Rust backend.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

// ─────────────────────────────────────────────
// Helper: show result in a result-box element
// ─────────────────────────────────────────────
function showResult(el, html, isError = false) {
  el.innerHTML = html;
  el.classList.remove("hidden", "error", "success");
  el.classList.add(isError ? "error" : "success");
}

// ─────────────────────────────────────────────
// Helper: add an event to the event log
// ─────────────────────────────────────────────
function logEvent(message) {
  const container = document.getElementById("event-messages");
  const placeholder = container.querySelector(".placeholder");
  if (placeholder) placeholder.remove();

  const entry = document.createElement("div");
  entry.className = "event-entry";
  const time = new Date().toLocaleTimeString();
  entry.innerHTML = `<span class="event-time">${time}</span> ${message}`;
  container.prepend(entry);
}

// ─────────────────────────────────────────────
// Helper: render notes list
// ─────────────────────────────────────────────
function renderNotes(notes) {
  const container = document.getElementById("notes-list");
  if (notes.length === 0) {
    container.innerHTML = '<p class="placeholder">No notes yet. Add one above!</p>';
    return;
  }
  container.innerHTML = notes
    .map(
      (n) => `
      <div class="note-item">
        <span class="note-text">${escapeHtml(n.text)}</span>
        <button class="note-delete" data-id="${n.id}">✕</button>
      </div>`
    )
    .join("");

  // Attach delete handlers
  container.querySelectorAll(".note-delete").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = parseInt(btn.dataset.id);
      const updatedNotes = await invoke("delete_note", { id });
      renderNotes(updatedNotes);
      logEvent(`🗑️ Note #${id} deleted via Rust command`);
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Initialize everything when the DOM is ready
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

window.addEventListener("DOMContentLoaded", async () => {
  // ─── SECTION 1: Greet Command ───
  const greetForm = document.getElementById("greet-form");
  const greetInput = document.getElementById("greet-input");
  const greetResult = document.getElementById("greet-result");

  greetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = greetInput.value || "World";
    // invoke() calls the Rust #[tauri::command] fn greet()
    const message = await invoke("greet", { name });
    showResult(greetResult, `🦀 <strong>${message}</strong>`);
  });

  // ─── SECTION 2: System Info ───
  const sysinfoBtn = document.getElementById("sysinfo-btn");
  const sysinfoResult = document.getElementById("sysinfo-result");

  sysinfoBtn.addEventListener("click", async () => {
    // invoke() returns the serialized SystemInfo struct as a JS object!
    const info = await invoke("get_system_info");
    showResult(
      sysinfoResult,
      `<table class="info-table">
        <tr><td>OS</td><td><strong>${info.os_name}</strong></td></tr>
        <tr><td>Architecture</td><td><strong>${info.arch}</strong></td></tr>
        <tr><td>CPU Threads</td><td><strong>${info.num_cpus}</strong></td></tr>
        <tr><td>Working Dir</td><td><strong>${info.current_dir}</strong></td></tr>
        <tr><td>Tauri Version</td><td><strong>${info.tauri_version}</strong></td></tr>
      </table>`
    );
  });

  // ─── SECTION 3: Counter (State Management) ───
  const counterDisplay = document.getElementById("counter-display");
  const counterInc = document.getElementById("counter-inc");
  const counterDec = document.getElementById("counter-dec");
  const counterReset = document.getElementById("counter-reset");

  // Fetch initial value from Rust state
  counterDisplay.textContent = await invoke("get_counter");

  counterInc.addEventListener("click", async () => {
    // delta: +1 is passed to Rust, which updates its Mutex<i32> state
    counterDisplay.textContent = await invoke("update_counter", { delta: 1 });
  });

  counterDec.addEventListener("click", async () => {
    counterDisplay.textContent = await invoke("update_counter", { delta: -1 });
  });

  counterReset.addEventListener("click", async () => {
    counterDisplay.textContent = await invoke("reset_counter");
  });

  // ─── SECTION 4: Notes CRUD ───
  const noteForm = document.getElementById("note-form");
  const noteInput = document.getElementById("note-input");

  // Load any existing notes
  const initialNotes = await invoke("get_notes");
  renderNotes(initialNotes);

  noteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = noteInput.value.trim();
    if (!text) return;
    // Rust receives the string, creates a Note struct, returns Vec<Note>
    const notes = await invoke("add_note", { text });
    renderNotes(notes);
    noteInput.value = "";
    logEvent(`📝 Note added via Rust command`);
  });

  // ─── SECTION 5: File I/O + Events ───
  const saveBtn = document.getElementById("save-btn");
  const loadBtn = document.getElementById("load-btn");

  // Listen for events emitted from Rust!
  // This is the EVENT SYSTEM — Rust pushes data to JS.
  await listen("file-operation", (event) => {
    logEvent(`📁 <strong>${event.payload}</strong>`);
  });

  saveBtn.addEventListener("click", async () => {
    try {
      await invoke("save_notes_to_file");
    } catch (err) {
      logEvent(`❌ Error: ${err}`);
    }
  });

  loadBtn.addEventListener("click", async () => {
    try {
      const notes = await invoke("load_notes_from_file");
      renderNotes(notes);
    } catch (err) {
      logEvent(`❌ Error: ${err}`);
    }
  });

  // ─── SECTION 6: Error Handling ───
  const divideForm = document.getElementById("divide-form");
  const divideA = document.getElementById("divide-a");
  const divideB = document.getElementById("divide-b");
  const divideResult = document.getElementById("divide-result");

  divideForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const a = parseFloat(divideA.value) || 0;
    const b = parseFloat(divideB.value) || 0;
    try {
      // When Rust returns Ok(value) → promise resolves
      const result = await invoke("divide", { a, b });
      showResult(divideResult, `✅ ${a} ÷ ${b} = <strong>${result}</strong>`);
    } catch (err) {
      // When Rust returns Err(msg) → promise rejects, caught here!
      showResult(divideResult, `❌ <strong>${err}</strong>`, true);
    }
  });
});
