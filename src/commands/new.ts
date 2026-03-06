// src/commands/new.ts
import { defineCommand } from 'citty'
import { $, sleep } from 'bun'
import fs from 'node:fs'
import path from 'node:path'
import yoctoSpinner from 'yocto-spinner'

const TEMPLATE_URL = 'https://github.com/elysia-cli/template.git' // placeholder, cambieremo con il nostro

export const newCommand = defineCommand({
  meta: {
    name: 'new',
    description: 'Crea un nuovo progetto Elysia',
  },
  args: {
    name: {
      type: 'positional',
      description: 'Nome del progetto',
      required: true,
    },
  },
  async run({ args }) {
    const projectName = args.name
    const targetDir = path.resolve(process.cwd(), projectName)

    // check cartella
    if (fs.existsSync(targetDir)) {
      if (fs.readdirSync(targetDir).length > 0) {
        console.error(`\n✗ La cartella "${projectName}" esiste già e non è vuota.\n`)
        process.exit(1)
      }
    }

    console.log(`\n  elysia-cli — nuovo progetto: ${projectName}\n`)

    // clone template
    const gitSpinner = yoctoSpinner({ text: 'Cloning template…' }).start()
    try {
      await $`git clone ${TEMPLATE_URL} --depth 1 ${targetDir}`.quiet()
      gitSpinner.success('Template clonato')
    } catch {
      gitSpinner.error('Errore nel clone del template')
      process.exit(1)
    }

    // bun install
    const bunSpinner = yoctoSpinner({ text: 'Installando dipendenze…' }).start()
    try {
      await $`cd ${targetDir} && bun install`.quiet()
      bunSpinner.success('Dipendenze installate')
    } catch {
      bunSpinner.error('Errore in bun install')
      process.exit(1)
    }

    // cleanup + rinomina
    const fsSpinner = yoctoSpinner({ text: 'Finalizzando progetto…' }).start()
    fs.rmSync(`${targetDir}/.git`, { recursive: true, force: true })
    const pkgPath = `${targetDir}/package.json`
    const pkg = await Bun.file(pkgPath).json()
    pkg.name = projectName
    await Bun.write(pkgPath, JSON.stringify(pkg, null, 2))
    fsSpinner.success('Pronto')

    console.log(`
  ✓ Progetto creato con successo!

  cd ${projectName}
  bun run dev
`)
  },
})