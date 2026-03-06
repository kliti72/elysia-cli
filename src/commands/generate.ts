// src/commands/generate.ts
import { defineCommand } from 'citty'
import fs from 'node:fs'
import path from 'node:path'
import yoctoSpinner from 'yocto-spinner'

export const generateCommand = defineCommand({
  meta: {
    name: 'generate',
    description: 'Genera un modulo con controller, service e repository',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Nome del modulo (es. messages, users)',
      required: true,
    },
  },
  async run({ args }) {
    const name = args.name.toLowerCase()
    const modulesDir = path.resolve(process.cwd(), 'src', 'modules', name)

    if (fs.existsSync(modulesDir)) {
      console.error(`\n✗ Il modulo "${name}" esiste già.\n`)
      process.exit(1)
    }

    fs.mkdirSync(modulesDir, { recursive: true })

    const spinner = yoctoSpinner({ text: `Generando modulo "${name}"…` }).start()

    const files = [
      {
        path: `${modulesDir}/${name}.controller.ts`,
        content: controllerTemplate(name),
      },
      {
        path: `${modulesDir}/${name}.service.ts`,
        content: serviceTemplate(name),
      },
      {
        path: `${modulesDir}/${name}.repository.ts`,
        content: repositoryTemplate(name),
      },
      {
        path: `${modulesDir}/${name}.types.ts`,
        content: typesTemplate(name),
      },
    ]

    for (const file of files) {
      await Bun.write(file.path, file.content)
    }

    spinner.success(`Modulo "${name}" generato`)

    console.log(`
  File creati:
    src/modules/${name}/${name}.controller.ts
    src/modules/${name}/${name}.service.ts
    src/modules/${name}/${name}.repository.ts
    src/modules/${name}/${name}.types.ts

  Aggiungi al tuo index.ts:
    import { ${name}Controller } from './modules/${name}/${name}.controller'
    app.use(${name}Controller)
`)
  },
})

// ─── Templates ────────────────────────────────────────────────────────────────

function controllerTemplate(name: string) {
  const pascal = toPascal(name)
  return `import { Elysia, t } from 'elysia'
import { ${name}Service } from './${name}.service'

export const ${name}Controller = new Elysia({ prefix: '/${name}' })

  .get('/', () => {
    return ${name}Service.getAll()
  })

  .get('/:id', ({ params }) => {
    return ${name}Service.getById(Number(params.id))
  }, {
    params: t.Object({ id: t.Numeric() }),
  })

  .post('/', ({ body }) => {
    return ${name}Service.create(body)
  }, {
    body: t.Object({
      // definisci i campi qui
    }),
  })

  .delete('/:id', ({ params }) => {
    return ${name}Service.delete(Number(params.id))
  }, {
    params: t.Object({ id: t.Numeric() }),
  })
`
}

function serviceTemplate(name: string) {
  return `import * as ${name}Repository from './${name}.repository'
import type { Create${toPascal(name)}Dto } from './${name}.types'

export const ${name}Service = {

  getAll() {
    return ${name}Repository.findAll()
  },

  getById(id: number) {
    const item = ${name}Repository.findById(id)
    if (!item) throw new Error(\`${toPascal(name)} \${id} non trovato.\`)
    return item
  },

  create(dto: Create${toPascal(name)}Dto) {
    return ${name}Repository.insert(dto)
  },

  delete(id: number) {
    const deleted = ${name}Repository.remove(id)
    if (!deleted) throw new Error(\`${toPascal(name)} \${id} non trovato.\`)
    return { ok: true }
  },

}
`
}

function repositoryTemplate(name: string) {
  return `import { db } from '../../db'
import type { ${toPascal(name)}, Create${toPascal(name)}Dto } from './${name}.types'

// ─── Prepared Statements ──────────────────────────────────────────────────────

const stmts = {
  findAll: db.prepare<${toPascal(name)}, []>(
    \`SELECT * FROM ${name} ORDER BY created_at DESC\`
  ),
  findById: db.prepare<${toPascal(name)}, [number]>(
    \`SELECT * FROM ${name} WHERE id = ?\`
  ),
  insert: db.prepare<${toPascal(name)}, [string]>(
    \`INSERT INTO ${name} (text) VALUES (?) RETURNING *\`
  ),
  remove: db.prepare(
    \`DELETE FROM ${name} WHERE id = ?\`
  ),
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export function findAll(): ${toPascal(name)}[] {
  return stmts.findAll.all()
}

export function findById(id: number): ${toPascal(name)} | undefined {
  return stmts.findById.get(id)
}

export function insert(dto: Create${toPascal(name)}Dto): ${toPascal(name)} {
  const row = stmts.insert.get(dto.text)
  if (!row) throw new Error('Errore nel salvataggio.')
  return row
}

export function remove(id: number): boolean {
  const result = stmts.remove.run(id)
  return result.changes > 0
}
`
}

function typesTemplate(name: string) {
  const pascal = toPascal(name)
  return `export interface ${pascal} {
  id: number
  created_at: number
  // aggiungi i campi qui
}

export interface Create${pascal}Dto {
  // campi per la creazione
}
`
}

function toPascal(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}