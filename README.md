# elysia-cli

CLI tool for [Elysia](https://elysiajs.com/) that scaffolds new projects and generates fully structured modules with a single command. Built for [elysia-template](https://github.com/kliti72/elysia-template).

## Installation

```bash
bun add -g elysia-kit
```

## Commands

| Command | Description |
|---|---|
| `elysia-cli new <app>` | Create a new project from the official template |
| `elysia-cli generate <name>` | Generate an empty module |
| `elysia-cli gfull <name>` | Generate a full CRUD module with schema |
| `elysia-cli relate <a> <b>` | Add a relation between two tables |

---

## new

Scaffolds a new Elysia project from the official template. Runs `bun install` and `bun run push` automatically.

```bash
elysia-cli new my-app

# or without arguments — prompts for project name
elysia-cli new
```

---

## generate

Generates an empty module with all four layers. No schema, no logic — just the structure.

```bash
elysia-cli generate messages
```

**Files created:**
```
app/controllers/messages.controller.ts
app/services/messages.service.ts
app/repositories/messages.repository.ts
app/types/messages.types.ts
```

Automatically registered in `app/routes.ts`.

---

## gfull

Generates a complete CRUD module. Pass a JSON schema to generate the Drizzle table, typed repository methods, service logic, and controller routes — all wired together.

```bash
# inline JSON (Linux/Mac)
elysia-cli gfull messages --schema '{"text":"string","userId":"number"}'

# JSON file (recommended on Windows)
elysia-cli gfull messages --schema ./schema.json

# with custom type name
elysia-cli gfull messages --schema ./schema.json --type Message

# without schema — same as generate
elysia-cli gfull messages
```

**schema.json example:**
```json
{
  "text": "string",
  "userId": "number",
  "published": "boolean",
  "publishedAt": "date"
}
```

**Type mapping:**

| JSON type | Drizzle field |
|---|---|
| `string` | `text().notNull()` |
| `number` | `integer().notNull()` |
| `boolean` | `integer({ mode: 'boolean' }).notNull()` |
| `date` | `text().default(datetime('now'))` |

**Files created:**
```
app/controllers/messages.controller.ts
app/services/messages.service.ts
app/repositories/messages.repository.ts
app/types/messages.types.ts
config/schema.ts               ← updated with new table
app/routes.ts                  ← updated with new route
```

After running `gfull` with a schema, sync the database:

```bash
bun run push
```

---

## relate

Adds a relation between two existing tables interactively. Prompts for relation type and FK field name.

```bash
elysia-cli relate messages users
```

```
What type of relation?
  1) one-to-many  — one users has many messages
  2) many-to-one  — many messages belong to one users

choice [1-2]: 2

FK field name on "messages" [usersId]: userId
```

**What it adds to `config/schema.ts`:**
- FK field with `.references()` on the source table
- `messagesRelations` block
- `usersRelations` block

After running `relate`, sync the database:

```bash
bun run push
```

---

## Project structure

`elysia-cli` is designed to work with [elysia-template](https://github.com/kliti72/elysia-template), which follows this structure:

```
my-app/
├── index.ts              # entry point — do not modify
├── config/
│   ├── db.ts             # database connection
│   ├── schema.ts         # drizzle table definitions
│   └── env.ts            # environment variables
├── core/
│   └── loader.ts         # route loader
└── app/
    ├── routes.ts         # register routes here
    ├── controllers/
    ├── services/
    ├── repositories/
    ├── middleware/
    └── types/
```

## License

MIT