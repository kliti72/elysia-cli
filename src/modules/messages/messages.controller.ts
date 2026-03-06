import { Elysia, t } from 'elysia'
import { messagesService } from './messages.service'

export const messagesController = new Elysia({ prefix: '/messages' })

  .get('/', () => {
    return messagesService.getAll()
  })

  .get('/:id', ({ params }) => {
    return messagesService.getById(Number(params.id))
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .post('/', ({ body }) => {
    return messagesService.create(body)
  }, {
    body: t.Object({
      // definisci i campi qui
    }),
  })

  .delete('/:id', ({ params }) => {
    return messagesService.delete(Number(params.id))
  }, {
    params: t.Object({ id: t.Numeric() }),
  })
