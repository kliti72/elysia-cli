// src/commands/add.ts
import { defineCommand } from 'citty'
import { $ } from 'bun'
import fs from 'node:fs'
import path from 'node:path'
import yoctoSpinner from 'yocto-spinner'

// ─── Plugin registry ──────────────────────────────────────────────────────────

const PLUGINS: Record<string, {
  package: string
  import: string
  usage: string
  description: string
}> = {
  cors: {
    package: '@elysiajs/cors',
    import: `import { cors } from '@elysiajs/cors'`,
    usage: `.use(cors())`,
    description: 'Cross-Origin Resource Sharing',
  },
  jwt: {
    package: '@elysiajs/jwt',
    import: `import { jwt } from '@elysiajs/jwt'`,
    usage: `.use(jwt({ name: 'jwt', secret: process.env.JWT_SECRET! }))`,
    description: 'JSON Web Token auth',
  },
  bearer: {
    package: '@elysiajs/bearer',
    import: `import { bearer } from '@elysiajs/bearer'`,
    usage: `.use(bearer())`,
    description: 'Bearer token extractor',
  },
  swagger: {
    package: '@elysiajs/swagger',
    import: `import { swagger } from '@elysiajs/swagger'`,
    usage: `.use(swagger())`,
    description: 'Swagger UI / OpenAPI docs',
  },
  static: {
    package: '@elysiajs/static',
    import: `import { staticPlugin } from '@elysiajs/static'`,
    usage: `.use(staticPlugin())`,
    description: 'Serve file statici',
  },
}

// ─── Command ──────────────────────────────────────────────────────────────────

export const addCommand = defineCommand({
  meta: {
    name: 'add',
    description: 'Installa e integra un plugin Elysia',
  },
  args: {
    plugin: {
      type: 'positional',
      description: `Plugin disponibili: ${Object.keys(PLUGINS).join(', ')}`,
      required: true,
    },
  },
  async run({ args }) {
    const pluginName = args.plugin.toLowerCase()
    const plugin = PLUGINS[pluginName]

    if (!plugin) {
      console.error(`\n✗ Plugin "${pluginName}" non trovato.`)
      console.error(`  Disponibili: ${Object.keys(PLUGINS).join(', ')}\n`)
      process.exit(1)
    }

    console.log(`\n  Aggiungendo ${pluginName} — ${plugin.description}\n`)

    // installa pacchetto
    const installSpinner = yoctoSpinner({ text: `bun add ${plugin.package}…` }).start()
    try {
      await $`bun add ${plugin.package}`.quiet()
      installSpinner.success(`${plugin.package} installato`)
    } catch {
      installSpinner.error(`Errore nell'installazione`)
      process.exit(1)
    }

    // integra in index.ts
    const indexPath = path.resolve(process.cwd(), 'src', 'index.ts')
    if (!fs.existsSync(indexPath)) {
      console.warn(`\n  ⚠ src/index.ts non trovato — aggiungi manualmente:\n`)
      console.log(`  ${plugin.import}`)
      console.log(`  app${plugin.usage}\n`)
      return
    }

    const integrateSpinner = yoctoSpinner({ text: 'Integrando in src/index.ts…' }).start()
    try {
      let content = fs.readFileSync(indexPath, 'utf-8')

      // aggiungi import dopo l'ultimo import esistente
      const lastImportIdx = content.lastIndexOf('\nimport ')
      const endOfLastImport = content.indexOf('\n', lastImportIdx + 1)
      content =
        content.slice(0, endOfLastImport + 1) +
        plugin.import + '\n' +
        content.slice(endOfLastImport + 1)

      // aggiungi .use() prima di .listen(
      content = content.replace(
        /(\s*)\.listen\(/,
        `\n  ${plugin.usage}\n  .listen(`
      )

      fs.writeFileSync(indexPath, content)
      integrateSpinner.success('Integrato in src/index.ts')
    } catch {
      integrateSpinner.error('Errore nella modifica di index.ts')
      console.log(`\n  Aggiungi manualmente:\n  ${plugin.import}\n  app${plugin.usage}\n`)
    }

    console.log(`\n  ✓ ${pluginName} pronto.\n`)
  },
})