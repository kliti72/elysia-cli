import * as messagesRepository from './messages.repository'
import type { CreateMessagesDto } from './messages.types'

export const messagesService = {

  getAll() {
    return messagesRepository.findAll()
  },

  getById(id: number) {
    const item = messagesRepository.findById(id)
    if (!item) throw new Error(`Messages ${id} non trovato.`)
    return item
  },

  create(dto: CreateMessagesDto) {
    return messagesRepository.insert(dto)
  },

  delete(id: number) {
    const deleted = messagesRepository.remove(id)
    if (!deleted) throw new Error(`Messages ${id} non trovato.`)
    return { ok: true }
  },

}
