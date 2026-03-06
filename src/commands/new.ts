// src/commands/new.ts
import { defineCommand } from 'citty'
import { $ } from 'bun'
import fs from 'node:fs'
import path from 'node:path'
import yoctoSpinner from 'yocto-spinner'

const TEMPLATE_URL = 'https://github.com/kliti72/elysia-template.git'

const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  cyan:   '\x1b[36m',
  red:    '\x1b[31m',
  gray:   '\x1b[90m',
}

async function prompt(question: string): Promise<string> {
  process.stdout.write(question)
  for await (const line of console) {
    return line.trim()
  }
  return ''
}

export const newCommand = defineCommand({
  meta: {
    name: 'new',
    description: 'Crea un nuovo progetto Elysia',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Nome del progetto',
      required: false,
    },
  },
  async run({ args }) {
    console.log()
    console.log(`${c.bold}${c.cyan}  ⚡ elysia-cli${c.reset}  ${c.gray}new project${c.reset}`)
    console.log()

    // chiede il nome se non passato come argomento
    let projectName = args.name?.trim()
    if (!projectName) {
      projectName = await prompt(`  ${c.bold}project name:${c.reset} `)
    }

    if (!projectName) {
      console.error(`\n  ${c.red}✗ nome progetto obbligatorio${c.reset}\n`)
      process.exit(1)
    }

    const targetDir = path.resolve(process.cwd(), projectName)

    // check cartella
    if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
      console.error(`\n  ${c.red}✗ la cartella "${projectName}" esiste già e non è vuota${c.reset}\n`)
      process.exit(1)
    }

    console.log()

    // clone template
    const gitSpinner = yoctoSpinner({ text: 'cloning template…' }).start()
    try {
      await $`git clone ${TEMPLATE_URL} --depth 1 ${targetDir}`.quiet()
      gitSpinner.success('template cloned')
    } catch {
      gitSpinner.error('errore nel clone del template')
      process.exit(1)
    }

    // bun install
    const bunSpinner = yoctoSpinner({ text: 'installing dependencies…' }).start()
    try {
      await $`cd ${targetDir} && bun install`.quiet()
      bunSpinner.success('depndecies installed')
    } catch {
      bunSpinner.error('error in bun install')
      process.exit(1)
    }

    // bun run push
    const pushSpinner = yoctoSpinner({ text: 'syncing database schema…' }).start()
    try {
      await $`cd ${targetDir} && bun run push`.quiet()
      pushSpinner.success('schema synchronized')
    } catch {
      pushSpinner.error('errore nel push — esegui bun run push manualmente')
    }

    // cleanup + rinomina package.json
    const fsSpinner = yoctoSpinner({ text: 'finalizing…' }).start()
    fs.rmSync(`${targetDir}/.git`, { recursive: true, force: true })
    const pkgPath = `${targetDir}/package.json`
    const pkg = await Bun.file(pkgPath).json()
    pkg.name = projectName
    await Bun.write(pkgPath, JSON.stringify(pkg, null, 2))
    fsSpinner.success('pronto')

    console.log(`
  ${c.green}${c.bold}✓ progetto creato${c.reset}

  ${c.gray}cd${c.reset} ${c.cyan}${projectName}${c.reset}
  ${c.gray}bun run${c.reset} ${c.cyan}dev${c.reset}
`)
  },
})