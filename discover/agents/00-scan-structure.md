# Scan Project Structure

You receive a JSON context:
```json
{
  "projectRoot": "<absolute path>",
  "fileTree": "<output of find command — all files, max depth 4>",
  "packageJson": "<content or null>",
  "readme": "<content or null>"
}
```

Analyze the project structure and infer:

**Project type** — what kind of system is this? (web app, API, mobile, library, monorepo, etc.)

**Tech stack** — languages, frameworks, databases, infrastructure clues (from package.json, go.mod, requirements.txt, Dockerfile, etc.)

**Key modules** — top-level directories or feature areas that represent distinct responsibilities. Use folder names and file patterns to name them.

**Entry points** — main files, route files, API handlers (e.g. `src/routes/`, `pages/`, `controllers/`, `cmd/main.go`)

**External integrations** — any third-party services, APIs, or databases referenced (from imports, env var names, config files, docker-compose)

**Team signals** — any clues about team structure, ownership, or workflow (multiple package.json, separate docker services, CI config)

Output a single JSON object:
```json
{
  "projectType": "...",
  "techStack": ["..."],
  "modules": [
    { "name": "...", "path": "...", "description": "..." }
  ],
  "entryPoints": ["..."],
  "integrations": ["..."],
  "teamSignals": ["..."]
}
```
