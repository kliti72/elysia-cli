// src/commands/generateFull.ts
import { defineCommand } from 'citty'
import fs from 'node:fs'
import path from 'node:path'
import yoctoSpinner from 'yocto-spinner'

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
  yellow: '\x1b[33m',
}

// ─── Type mapping ─────────────────────────────────────────────────────────────

type FieldType = 'string' | 'number' | 'boolean' | 'date'

interface SchemaField {
  type: FieldType
  optional?: boolean
}

type SchemaInput = Record<string, FieldType | SchemaField>

function toDrizzleField(key: string, field: FieldType | SchemaField): string {
  const type    = typeof field === 'string' ? field : field.type
  const optional = typeof field === 'object' && field.optional

  const notNull = optional ? '' : '.notNull()'

  switch (type) {
    case 'string':  return `  ${toCamel(key)}: text('${toSnake(key)}')${notNull},`
    case 'number':  return `  ${toCamel(key)}: integer('${toSnake(key)}')${notNull},`
    case 'boolean': return `  ${toCamel(key)}: integer('${toSnake(key)}', { mode: 'boolean' })${notNull},`
    case 'date':    return `  ${toCamel(key)}: text('${toSnake(key)}').notNull().default(sql\`(datetime('now'))\`),`
    default:        return `  ${toCamel(key)}: text('${toSnake(key)}')${notNull},`
  }
}

function toElysiaField(key: string, field: FieldType | SchemaField): string {
  const type     = typeof field === 'string' ? field : field.type
  const optional = typeof field === 'object' && field.optional

  const eType = type === 'string' ? 't.String()' : type === 'number' ? 't.Number()' : type === 'boolean' ? 't.Boolean()' : 't.String()'
  return optional ? `      ${key}: t.Optional(${eType}),` : `      ${key}: ${eType},`
}

// ─── Project checks ───────────────────────────────────────────────────────────

export function isElysiaProject(): boolean {
  const pkgPath = path.resolve(process.cwd(), 'package.json')
  if (!fs.existsSync(pkgPath)) return false
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    return !!(pkg.dependencies?.elysia || pkg.devDependencies?.elysia)
  } catch { return false }
}

function hasAppStructure(): boolean {
  return fs.existsSync(path.resolve(process.cwd(), 'app'))
}

// ─── Parse schema ─────────────────────────────────────────────────────────────

function parseSchema(input: string): SchemaInput {
  // file path
  if (input.endsWith('.json')) {
    const filePath = path.resolve(process.cwd(), input)
    if (!fs.existsSync(filePath)) throw new Error(`schema file not found: ${input}`)
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'))
  }
  // inline JSON
  return JSON.parse(input)
}

// ─── Command ──────────────────────────────────────────────────────────────────

export const generateFullCommand = defineCommand({
  meta: {
    name: 'gfull',
    description: 'Generate a full CRUD module with schema, types, repository, service and controller',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Module name (e.g. messages, users)',
      required: true,
    },
    schema: {
      type: 'string',
      description: 'JSON schema inline or path to .json file',
      required: false,
    },
    type: {
      type: 'string',
      description: 'Custom type name (default: PascalCase of module name)',
      required: false,
    },
  },
  async run({ args }) {
    const name   = args.name.toLowerCase()
    const pascal = args.type ? toPascal(args.type) : toPascal(name)
    const cwd    = process.cwd()

    console.log()
    console.log(`${c.bold}${c.cyan}  ⚡ elysia-cli${c.reset}  ${c.gray}gfull ${name}${c.reset}`)
    console.log()

    // ── checks ────────────────────────────────────────────────────────────────
    if (!isElysiaProject()) {
      console.error(`  ${c.red}✗ no elysia project found in current directory${c.reset}`)
      console.error(`  ${c.yellow}→ run this command inside an elysia project${c.reset}\n`)
      process.exit(1)
    }
    if (!hasAppStructure()) {
      console.error(`  ${c.red}✗ app/ folder not found${c.reset}`)
      console.error(`  ${c.yellow}→ make sure you are using the elysia-template structure${c.reset}\n`)
      process.exit(1)
    }

    const controllerPath = path.resolve(cwd, 'app', 'controllers',  `${name}.controller.ts`)
    if (fs.existsSync(controllerPath)) {
      console.error(`  ${c.red}✗ module "${name}" already exists${c.reset}\n`)
      process.exit(1)
    }

    // ── parse schema ──────────────────────────────────────────────────────────
    let schemaFields: SchemaInput | null = null
    if (args.schema) {
      try {
        schemaFields = parseSchema(args.schema)
      } catch (e: any) {
        console.error(`  ${c.red}✗ invalid schema: ${e.message}${c.reset}\n`)
        process.exit(1)
      }
    }

    const spinner = yoctoSpinner({ text: `generating full module "${name}"…` }).start()

    // ── files ─────────────────────────────────────────────────────────────────
    const files: { path: string; content: string }[] = [
      {
        path: controllerPath,
        content: controllerTemplate(name, pascal, schemaFields),
      },
      {
        path: path.resolve(cwd, 'app', 'services', `${name}.service.ts`),
        content: serviceTemplate(name, pascal),
      },
      {
        path: path.resolve(cwd, 'app', 'repositories', `${name}.repository.ts`),
        content: repositoryTemplate(name, pascal),
      },
      {
        path: path.resolve(cwd, 'app', 'types', `${name}.types.ts`),
        content: typesTemplate(name, pascal),
      },
    ]

    for (const file of files) {
      await Bun.write(file.path, file.content)
    }

    // ── update config/schema.ts ───────────────────────────────────────────────
    if (schemaFields) {
      const schemaPath = path.resolve(cwd, 'config', 'schema.ts')
      if (fs.existsSync(schemaPath)) {
        let schemaFile = fs.readFileSync(schemaPath, 'utf-8')
        const tableBlock = drizzleTableTemplate(name, pascal, schemaFields)

        // append table at end of file
        schemaFile = schemaFile.trimEnd() + '\n\n' + tableBlock + '\n'
        fs.writeFileSync(schemaPath, schemaFile)
      }
    }

    // ── update app/routes.ts ──────────────────────────────────────────────────
    const routesPath = path.resolve(cwd, 'app', 'routes.ts')
    if (fs.existsSync(routesPath)) {
      let routes = fs.readFileSync(routesPath, 'utf-8')
      const lastImport   = routes.lastIndexOf('\nimport ')
      const endOfImport  = routes.indexOf('\n', lastImport + 1)
      const importLine   = `\nimport { ${name}Controller } from './controllers/${name}.controller' \n`
      routes = routes.slice(0, endOfImport + 1) + importLine + routes.slice(endOfImport + 1)
      const routeEntry   = `\n  {\n    controller: ${name}Controller,\n    enabled: true,\n    middleware: [],\n  },`
      routes = routes.replace(/(\]\s*$)/, `${routeEntry}\n]`)
      fs.writeFileSync(routesPath, routes)
    }

    spinner.success(`module "${name}" generated`)

    console.log(`
  ${c.gray}files created:${c.reset}
    app/controllers/${name}.controller.ts
    app/services/${name}.service.ts
    app/repositories/${name}.repository.ts
    app/types/${name}.types.ts
    ${schemaFields ? `config/schema.ts  ${c.green}updated${c.reset}` : ''}
  ${c.gray}registered in:${c.reset}
    app/routes.ts  ${c.green}✓${c.reset}
  ${schemaFields ? `\n  ${c.yellow}→ run bun run push to sync the database${c.reset}` : ''}
`)
  },
})

// ─── Drizzle schema template ──────────────────────────────────────────────────

function drizzleTableTemplate(name: string, pascal: string, fields: SchemaInput): string {
  const hasDate = Object.values(fields).some(f => (typeof f === 'string' ? f : f.type) === 'date')
  const fieldLines = Object.entries(fields).map(([k, v]) => toDrizzleField(k, v)).join('\n')

  return `export const ${name} = sqliteTable('${name}', {
  id: integer('id').primaryKey({ autoIncrement: true }),
${fieldLines}
  createdAt: text('created_at').notNull().default(sql\`(datetime('now'))\`),
})`
}

// ─── Controller template ──────────────────────────────────────────────────────

function controllerTemplate(name: string, pascal: string, fields: SchemaInput | null): string {
  const bodyFields = fields
    ? Object.entries(fields).map(([k, v]) => toElysiaField(k, v)).join('\n')
    : '      // define your fields here'

  return `import { Elysia, t } from 'elysia'
import { ${name}Service } from '../services/${name}.service'

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
${bodyFields}
    }),
  })

  .put('/:id', ({ params, body }) => {
    return ${name}Service.update(Number(params.id), body)
  }, {
    params: t.Object({ id: t.Numeric() }),
    body: t.Object({
${bodyFields}
    }),
  })

  .delete('/:id', ({ params }) => {
    return ${name}Service.delete(Number(params.id))
  }, {
    params: t.Object({ id: t.Numeric() }),
  })
`
}

// ─── Service template ─────────────────────────────────────────────────────────

function serviceTemplate(name: string, pascal: string): string {
  return `import * as ${name}Repository from '../repositories/${name}.repository'
import type { Create${pascal}Dto } from '../types/${name}.types'

export const ${name}Service = {

  getAll() {
    return ${name}Repository.findAll()
  },

  getById(id: number) {
    const item = ${name}Repository.findById(id)
    if (!item) throw new Error(\`${pascal} \${id} not found.\`)
    return item
  },

  create(dto: Create${pascal}Dto) {
    return ${name}Repository.insert(dto)
  },

  update(id: number, dto: Partial<Create${pascal}Dto>) {
    const updated = ${name}Repository.update(id, dto)
    if (!updated) throw new Error(\`${pascal} \${id} not found.\`)
    return updated
  },

  delete(id: number) {
    const deleted = ${name}Repository.remove(id)
    if (!deleted) throw new Error(\`${pascal} \${id} not found.\`)
    return { ok: true }
  },

}
`
}

// ─── Repository template ──────────────────────────────────────────────────────

function repositoryTemplate(name: string, pascal: string): string {
  return `import { db } from '../../config/db'
import { ${name} } from '../../config/schema'
import type { ${pascal}, Create${pascal}Dto } from '../types/${name}.types'
import { eq, desc } from 'drizzle-orm'

export function findAll(): ${pascal}[] {
  return db.select().from(${name}).orderBy(desc(${name}.createdAt)).all()
}

export function findById(id: number): ${pascal} | undefined {
  return db.select().from(${name}).where(eq(${name}.id, id)).get()
}

export function insert(dto: Create${pascal}Dto): ${pascal} {
  return db.insert(${name}).values(dto).returning().get()!
}

export function update(id: number, dto: Partial<Create${pascal}Dto>): ${pascal} | undefined {
  return db.update(${name}).set(dto).where(eq(${name}.id, id)).returning().get()
}

export function remove(id: number): boolean {
  const result = db.delete(${name}).where(eq(${name}.id, id)).returning().get()
  return result != undefined;
}
`
}

// ─── Types template ───────────────────────────────────────────────────────────

function typesTemplate(name: string, pascal: string): string {
  return `import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { ${name} } from '../../config/schema'

export type ${pascal}          = InferSelectModel<typeof ${name}>
export type Create${pascal}Dto = InferInsertModel<typeof ${name}>
`
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function toPascal(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function toCamel(str: string) {
  return str.replace(/_([a-z])/g, (_, l) => l.toUpperCase())
}

function toSnake(str: string) {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase()
}