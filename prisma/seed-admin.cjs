const Database = require("better-sqlite3")
const path = require("path")

const dbPath = path.join(__dirname, "..", "dev.db")
console.log("DB path:", dbPath)

const db = new Database(dbPath)

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
console.log("Tablas:", tables.map(t => t.name).join(", "))

const email = "mfajmsa@gmail.com"
const role = "admin"
const id = "cuid_admin_" + Date.now()

try {
  const existing = db.prepare("SELECT id FROM AllowedEmail WHERE email = ?").get(email)
  if (existing) {
    db.prepare("UPDATE AllowedEmail SET role = ? WHERE email = ?").run(role, email)
    console.log("Actualizado:", email, "->", role)
  } else {
    db.prepare("INSERT INTO AllowedEmail (id, email, role, createdAt) VALUES (?, ?, ?, datetime('now'))").run(id, email, role)
    console.log("Agregado:", email, "->", role)
  }

  const all = db.prepare("SELECT email, role FROM AllowedEmail").all()
  console.log("\nLista blanca:")
  for (const row of all) {
    console.log("  -", row.email, "(" + row.role + ")")
  }
} catch (err) {
  console.error("Error:", err.message)
}

db.close()
