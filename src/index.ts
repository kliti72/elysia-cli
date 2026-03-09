#!/usr/bin/env bun
import { defineCommand, runMain } from 'citty'
import { newCommand } from './commands/new'
import { generateCommand } from './commands/generate'
import { generateFullCommand } from './commands/generateFull'
import { relateCommand } from './commands/relate'

const main = defineCommand({
  meta: {
    name: 'elysia-kit',
    version: '0.1.3',
    description: 'CLI for scaffolding and generating Elysia modules, MVC, Drizzle CRUD, ORM.',
  },
  subCommands: {
    new:      newCommand,
    generate: generateCommand,
    gfull:    generateFullCommand,
    relate:   relateCommand,
  },
})

runMain(main)