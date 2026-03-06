// src/commands/generate.ts
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

function isElysiaProject(): boolean {
  const pkgPath = path.resolve(process.cwd(), 'package.json')
  if (!fs.existsSync(pkgPath)) return false
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    return !!(pkg.dependencies?.elysia || pkg.devDependencies?.elysia)
  } catch {
    return false
  }
}

function hasAppStructure(): boolean {
  return fs.existsSync(path.resolve(process.cwd(), 'app'))
}

export const generateCommand = defineCommand({
  meta: {
    name: 'generate',
    description: 'Generate a module with controller, service, repository and types',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Module name (e.g. messages, users)',
      required: true,
    },
  },
  async run({ args }) {
    const name = args.name.toLowerCase()
    const pascal = toPascal(name)
    const cwd = process.cwd()

    console.log()
    console.log(`${c.bold}${c.cyan}  ⚡ elysia-cli${c.reset}  ${c.gray}generate ${name}${c.reset}`)
    console.log()

    // ── check elysia project ──────────────────────────────────────────────────
    if (!isElysiaProject()) {
      console.error(`  ${c.red}✗ no elysia project found in current directory${c.reset}`)
      console.error(`  ${c.yellow}→ run this command inside an elysia project${c.reset}\n`)
      process.exit(1)
    }

    // ── check app/ structure ──────────────────────────────────────────────────
    if (!hasAppStructure()) {
      console.error(`  ${c.red}✗ app/ folder not found${c.reset}`)
      console.error(`  ${c.yellow}→ make sure you are using the elysia-template structure${c.reset}\n`)
      process.exit(1)
    }

    // ── check duplicates ──────────────────────────────────────────────────────
    const controllerPath   = path.resolve(cwd, 'app', 'controllers',  `${name}.controller.ts`)
    const servicePath      = path.resolve(cwd, 'app', 'services',     `${name}.service.ts`)
    const repositoryPath   = path.resolve(cwd, 'app', 'repositories', `${name}.repository.ts`)
    const typesPath        = path.resolve(cwd, 'app', 'types',        `${name}.types.ts`)

    if (fs.existsSync(controllerPath)) {
      console.error(`  ${c.red}✗ module "${name}" already exists${c.reset}\n`)
      process.exit(1)
    }

    // ── generate files ────────────────────────────────────────────────────────
    const spinner = yoctoSpinner({ text: `generating module "${name}"…` }).start()

    const files = [
      { path: controllerPath,  content: controllerTemplate(name, pascal) },
      { path: servicePath,     content: serviceTemplate(name, pascal) },
      { path: repositoryPath,  content: repositoryTemplate(name, pascal) },
      { path: typesPath,       content: typesTemplate(pascal) },
    ]

    for (const file of files) {
      await Bun.write(file.path, file.content)
    }

    // ── update app/routes.ts ──────────────────────────────────────────────────
    const routesPath = path.resolve(cwd, 'app', 'routes.ts')
    if (fs.existsSync(routesPath)) {
      let routes = fs.readFileSync(routesPath, 'utf-8')

      // add import after last import line
      const lastImport = routes.lastIndexOf('\nimport ')
      const endOfImport = routes.indexOf('\n', lastImport + 1)
      const importLine = `\nimport { ${name}Controller } from './controllers/${name}.controller'`
      routes = routes.slice(0, endOfImport + 1) + importLine + routes.slice(endOfImport + 1)

      // add route entry before closing bracket of array
      const routeEntry = `\n  {\n    controller: ${name}Controller,\n    enabled: true,\n    middleware: [],\n  },`
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

  ${c.gray}registered in:${c.reset}
    app/routes.ts  ${c.green}✓${c.reset}
`)
  },
})

// ─── Templates ────────────────────────────────────────────────────────────────

function controllerTemplate(name: string, pascal: string) {
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
      // define your fields here
    }),
  })

  .delete('/:id', ({ params }) => {
    return ${name}Service.delete(Number(params.id))
  }, {
    params: t.Object({ id: t.Numeric() }),
  })
`
}

function serviceTemplate(name: string, pascal: string) {
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

  delete(id: number) {
    const deleted = ${name}Repository.remove(id)
    if (!deleted) throw new Error(\`${pascal} \${id} not found.\`)
    return { ok: true }
  },

}
`
}

function repositoryTemplate(name: string, pascal: string) {
  return `import { db } from '../../config/db'
import { ${name} } from '../../config/schema'
import type { ${pascal}, Create${pascal}Dto } from '../types/${name}.types'
import { desc } from 'drizzle-orm'

export function findAll(): ${pascal}[] {
  return db.select().from(${name}).orderBy(desc(${name}.createdAt)).all()
}

export function findById(id: number): ${pascal} | undefined {
  return db.select().from(${name}).where(eq(${name}.id, id)).get()
}

export function insert(dto: Create${pascal}Dto): ${pascal} {
  return db.insert(${name}).values(dto).returning().get()
}

export function remove(id: number): boolean {
  const result = db.delete(${name}).where(eq(${name}.id, id)).run()
  return result.changes > 0
}
`
}

function typesTemplate(pascal: string) {
  return `import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'
import { ${pascal.toLowerCase()} } from '../../config/schema'

export type ${pascal}    = InferSelectModel<typeof ${pascal.toLowerCase()}>
export type Create${pascal}Dto = InferInsertModel<typeof ${pascal.toLowerCase()}>
`
}

function toPascal(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}