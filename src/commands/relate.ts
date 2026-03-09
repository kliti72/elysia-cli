// src/commands/relate.ts
import { defineCommand } from 'citty'
import fs from 'node:fs'
import path from 'node:path'
import yoctoSpinner from 'yocto-spinner'
import { isElysiaProject } from './generateFull'

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function toPascal(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function toCamel(str: string) {
  return str.replace(/_([a-z])/g, (_, l) => l.toUpperCase())
}

async function prompt(question: string): Promise<string> {
  process.stdout.write(question)
  return new Promise((resolve) => {
    process.stdin.resume()
    process.stdin.setEncoding('utf-8')
    process.stdin.once('data', (data) => {
      process.stdin.pause()
      resolve(data.toString().trim())
    })
  })
}

async function promptChoice(question: string, choices: string[]): Promise<string> {
  console.log(`\n  ${c.bold}${question}${c.reset}`)
  choices.forEach((c, i) => console.log(`    ${i + 1}) ${c}`))
  const answer = await prompt(`\n  choice [1-${choices.length}]: `)
  const idx = parseInt(answer) - 1
  if (idx < 0 || idx >= choices.length) {
    console.error(`\n  ${c.red}✗ invalid choice${c.reset}\n`)
    process.exit(1)
  }
  return choices[idx] ?? '';
}

// ─── Schema parser ────────────────────────────────────────────────────────────

function getSchemaPath(cwd: string): string {
  return path.resolve(cwd, 'config', 'schema.ts')
}

function tableExists(schemaContent: string, tableName: string): boolean {
  const regex = new RegExp(`export const ${tableName}\\s*=\\s*sqliteTable`)
  return regex.test(schemaContent)
}

function relationsBlockExists(schemaContent: string, tableName: string): boolean {
  return schemaContent.includes(`export const ${tableName}Relations`)
}

// ─── Command ──────────────────────────────────────────────────────────────────

export const relateCommand = defineCommand({
  meta: {
    name: 'relate',
    description: 'Add a relation between two tables in config/schema.ts',
  },
  args: {
    from: {
      type: 'positional',
      description: 'Source table (e.g. messages)',
      required: true,
    },
    to: {
      type: 'positional',
      description: 'Target table (e.g. users)',
      required: true,
    },
  },
  async run({ args }) {
    const from = args.from.toLowerCase()
    const to = args.to.toLowerCase()
    const cwd = process.cwd()

    console.log()
    console.log(`${c.bold}${c.cyan}  ⚡ elysia-cli${c.reset}  ${c.gray}relate ${from} → ${to}${c.reset}`)

    // ── check elysia project ──────────────────────────────────────────────────
    if (!isElysiaProject()) {
      console.error(`  ${c.red}✗ no elysia project found in current directory${c.reset}`)
      console.error(`  ${c.yellow}→ run this command inside an elysia project${c.reset}\n`)
      process.exit(1)
    }

    // ── check schema file ─────────────────────────────────────────────────────
    const schemaPath = getSchemaPath(cwd)
    if (!fs.existsSync(schemaPath)) {
      console.error(`\n  ${c.red}✗ config/schema.ts not found${c.reset}`)
      console.error(`  ${c.yellow}→ make sure you are using the elysia-template structure${c.reset}\n`)
      process.exit(1)
    }

    let schema = fs.readFileSync(schemaPath, 'utf-8')

    // ── check both tables exist ───────────────────────────────────────────────
    if (!tableExists(schema, from)) {
      console.error(`\n  ${c.red}✗ table "${from}" not found in config/schema.ts${c.reset}\n`)
      process.exit(1)
    }
    if (!tableExists(schema, to)) {
      console.error(`\n  ${c.red}✗ table "${to}" not found in config/schema.ts${c.reset}\n`)
      process.exit(1)
    }

    // ── ask relation type ─────────────────────────────────────────────────────
    const relationType = await promptChoice(
      'What type of relation?',
      [
        `one-to-many  — one ${to} has many ${from}`,
        `many-to-one  — many ${from} belong to one ${to}`,
      ]
    )
    const isOneToMany = relationType.startsWith('one-to-many')

    // ── ask FK field name ─────────────────────────────────────────────────────
    const defaultField = `${toCamel(to)}Id`
    const fieldAnswer = await prompt(`\n  Write here FK field name on "${from}" [${defaultField}]: `)
    const fkField = fieldAnswer || defaultField
    const fkColumn = fkField.replace(/([A-Z])/g, '_$1').toLowerCase()

    console.log()
    const spinner = yoctoSpinner({ text: 'updating config/schema.ts…' }).start()

    // ── add FK field to "from" table ──────────────────────────────────────────
    const fromTableRegex = new RegExp(
      `(export const ${from}\\s*=\\s*sqliteTable\\('[^']+',\\s*\\{[^}]+\\}\\),)`,
      's'
    )

    const fkLine = `\n  ${fkField}: integer('${fkColumn}').notNull().references(() => ${to}.id),`

    schema = schema.replace(fromTableRegex, (match) => {
      if (match.includes(fkField)) return match
      // inserisce dopo la riga dell'id — cerca }).notNull() o primaryKey({...}),
      return match.replace(
        /(id:\s*integer\('[^']+'\)\.primaryKey\(\{[^}]+\}\),)/,
        `$1\n  ${fkField}: integer('${fkColumn}').notNull().references(() => ${to}.id),`
      )
    })

    // ── add relations() block ─────────────────────────────────────────────────

    // check imports
    if (!schema.includes('relations')) {
      schema = schema.replace(
        `from 'drizzle-orm/sqlite-core'`,
        `from 'drizzle-orm/sqlite-core'\nimport { relations } from 'drizzle-orm'`
      )
    }

    // from relations (messages → users: many-to-one)
    if (!relationsBlockExists(schema, from)) {
      const fromRelBlock = isOneToMany
        ? `\nexport const ${from}Relations = relations(${from}, ({ many }) => ({\n  ${to}: many(${to}),\n}))\n`
        : `\nexport const ${from}Relations = relations(${from}, ({ one }) => ({\n  ${to}: one(${to}, {\n    fields: [${from}.${fkField}],\n    references: [${to}.id],\n  }),\n}))\n`
      schema = schema.trimEnd() + '\n' + fromRelBlock
    }

    // to relations (users → messages: one-to-many)
    if (!relationsBlockExists(schema, to)) {
      const toRelBlock = isOneToMany
        ? `\nexport const ${to}Relations = relations(${to}, ({ many }) => ({\n  ${from}: many(${from}),\n}))\n`
        : `\nexport const ${to}Relations = relations(${to}, ({ one }) => ({\n  ${from}: one(${from}, {\n    fields: [${to}.id],\n    references: [${from}.${fkField}],\n  }),\n}))\n`
      schema = schema.trimEnd() + '\n' + toRelBlock
    }

    fs.writeFileSync(schemaPath, schema)
    spinner.success('config/schema.ts updated')

    console.log(`
  ${c.gray}added:${c.reset}
    ${c.green}✓${c.reset} FK field  ${c.cyan}${fkField}${c.reset} on ${from}
    ${c.green}✓${c.reset} ${from}Relations
    ${c.green}✓${c.reset} ${to}Relations

  ${c.yellow}→ run bun run push to sync the database${c.reset}
`)
  },
})