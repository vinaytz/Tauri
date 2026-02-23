use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{Emitter, Manager, State};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONCEPT 1: Managed State
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tauri lets you store shared application state on the Rust side.
// Wrap mutable data in Mutex for thread-safe access.
// Register it with `.manage()` and inject via `State<'_, T>`.

struct AppState {
    counter: Mutex<i32>,
    notes: Mutex<Vec<Note>>,
}

#[derive(Serialize, Deserialize, Clone)]
struct Note {
    id: usize,
    text: String,
}

#[derive(Serialize)]
struct SystemInfo {
    os_name: String,
    arch: String,
    num_cpus: usize,
    current_dir: String,
    tauri_version: String,
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONCEPT 2: Commands
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// #[tauri::command] turns a Rust fn into something callable
// from JavaScript via `invoke("command_name", { args })`.
// Arguments are automatically deserialized from JSON.
// Return values are serialized back to JSON.

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn get_system_info() -> SystemInfo {
    SystemInfo {
        os_name: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        num_cpus: std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(1),
        current_dir: std::env::current_dir()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|_| "unknown".to_string()),
        tauri_version: tauri::VERSION.to_string(),
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONCEPT 3: State in Commands
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Inject managed state into a command with `State<'_, AppState>`.
// The state persists for the app's lifetime — perfect for
// counters, caches, open connections, etc.

#[tauri::command]
fn get_counter(state: State<'_, AppState>) -> i32 {
    *state.counter.lock().unwrap()
}

#[tauri::command]
fn update_counter(delta: i32, state: State<'_, AppState>) -> i32 {
    let mut counter = state.counter.lock().unwrap();
    *counter += delta;
    *counter
}

#[tauri::command]
fn reset_counter(state: State<'_, AppState>) -> i32 {
    let mut counter = state.counter.lock().unwrap();
    *counter = 0;
    *counter
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONCEPT 4: Complex Data Passing
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Tauri uses serde to auto-serialize structs, Vecs, etc.
// You can pass and return complex nested data seamlessly.

#[tauri::command]
fn add_note(text: String, state: State<'_, AppState>) -> Vec<Note> {
    let mut notes = state.notes.lock().unwrap();
    let id = notes.last().map_or(1, |n| n.id + 1);
    notes.push(Note { id, text });
    notes.clone()
}

#[tauri::command]
fn get_notes(state: State<'_, AppState>) -> Vec<Note> {
    state.notes.lock().unwrap().clone()
}

#[tauri::command]
fn delete_note(id: usize, state: State<'_, AppState>) -> Vec<Note> {
    let mut notes = state.notes.lock().unwrap();
    notes.retain(|n| n.id != id);
    notes.clone()
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONCEPT 5: File I/O + Events (Rust → JS)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Commands can access the filesystem using std::fs.
// Use `app.path().app_data_dir()` for the correct platform path.
// After file operations, emit events to notify the frontend.
// Events are a push mechanism: Rust → JavaScript.

#[tauri::command]
fn save_notes_to_file(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let notes = state.notes.lock().unwrap();
    let json = serde_json::to_string_pretty(&*notes).map_err(|e| e.to_string())?;

    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    let path = app_dir.join("notes.json");

    std::fs::write(&path, &json).map_err(|e| e.to_string())?;

    // Emit an event to the frontend!
    let msg = format!("Saved {} notes to {}", notes.len(), path.display());
    let _ = app.emit("file-operation", &msg);

    Ok(msg)
}

#[tauri::command]
fn load_notes_from_file(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<Note>, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = app_dir.join("notes.json");

    let json = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let loaded: Vec<Note> = serde_json::from_str(&json).map_err(|e| e.to_string())?;

    let mut notes = state.notes.lock().unwrap();
    *notes = loaded.clone();

    let msg = format!("Loaded {} notes from {}", notes.len(), path.display());
    let _ = app.emit("file-operation", &msg);

    Ok(loaded)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONCEPT 6: Error Handling with Result
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Commands can return Result<T, String>.
// Ok(value) → resolved promise in JS
// Err(message) → rejected promise in JS (caught with .catch)

#[tauri::command]
fn divide(a: f64, b: f64) -> Result<f64, String> {
    if b == 0.0 {
        Err("Cannot divide by zero! This error was sent from Rust.".to_string())
    } else {
        Ok(a / b)
    }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// App Entry Point
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Builder pattern: register plugins, state, commands, then run.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            counter: Mutex::new(0),
            notes: Mutex::new(Vec::new()),
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_system_info,
            get_counter,
            update_counter,
            reset_counter,
            add_note,
            get_notes,
            delete_note,
            save_notes_to_file,
            load_notes_from_file,
            divide,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
