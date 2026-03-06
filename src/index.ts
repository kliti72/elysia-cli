#!/usr/bin/env bun

import { defineCommand, runMain } from 'citty'
import { newCommand } from './commands/new'
import { generateCommand } from './commands/generate'
import { addCommand } from './commands/add'

const main = defineCommand({
  meta: {
    name: 'elysia-cli',
    version: '0.1.0',
    description: 'CLI per scaffolding e generazione moduli Elysia',
  },
  subCommands: {
    new: newCommand,
    generate: generateCommand,
    add: addCommand,
  },
})

runMain(main)