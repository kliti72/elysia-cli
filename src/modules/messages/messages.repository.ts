import { db } from '../../db'
import type { Messages, CreateMessagesDto } from './messages.types'

// ─── Prepared Statements ──────────────────────────────────────────────────────

const stmts = {
  findAll: db.prepare<Messages, []>(
    `SELECT * FROM messages ORDER BY created_at DESC`
  ),
  findById: db.prepare<Messages, [number]>(
    `SELECT * FROM messages WHERE id = ?`
  ),
  insert: db.prepare<Messages, [string]>(
    `INSERT INTO messages (text) VALUES (?) RETURNING *`
  ),
  remove: db.prepare(
    `DELETE FROM messages WHERE id = ?`
  ),
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function findAll(): Messages[] {
  return stmts.findAll.all()
}

export function findById(id: number): Messages | undefined {
  return stmts.findById.get(id)
}

export function insert(dto: CreateMessagesDto): Messages {
  const row = stmts.insert.get(dto.text)
  if (!row) throw new Error('Errore nel salvataggio.')
  return row
}

export function remove(id: number): boolean {
  const result = stmts.remove.run(id)
  return result.changes > 0
}
