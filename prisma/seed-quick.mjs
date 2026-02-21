import Database from "better-sqlite3"

const db = new Database("./prisma/dev.db")

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all()
console.log("Tablas en la BD:", tables.map(t => t.name).join(", "))

const email = "mfajmsa@gmail.com"
const role = "admin"
const id = "admin-" + Date.now()

const existing = db.prepare("SELECT id FROM AllowedEmail WHERE email = ?").get(email)
if (existing) {
  db.prepare("UPDATE AllowedEmail SET role = ? WHERE email = ?").run(role, email)
  console.log(`✓ "${email}" actualizado a ${role}`)
} else {
  db.prepare("INSERT INTO AllowedEmail (id, email, role, createdAt) VALUES (?, ?, ?, datetime('now'))").run(id, email, role)
  console.log(`✓ "${email}" agregado como ${role}`)
}

db.close()
