#!/usr/bin/env bun
import { defineCommand, runMain } from 'citty'
import { newCommand } from './commands/new'
import { generateCommand } from './commands/generate'
import { generateFullCommand } from './commands/generateFull'
import { relateCommand } from './commands/relate'

const main = defineCommand({
  meta: {
    name: 'elysia-cli',
    version: '0.1.0',
    description: 'CLI for scaffolding and generating Elysia modules',
  },
  subCommands: {
    new:      newCommand,
    generate: generateCommand,
    gfull:    generateFullCommand,
    relate:   relateCommand,
  },
})

runMain(main)