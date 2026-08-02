# mymacros-cli

Unofficial CLI client for [GetMyMacros](https://getmymacros.com), optimized for AI agent use.

> **Unofficial software:** this project is not affiliated with, endorsed by, or supported by GetMyMacros. It relies on undocumented web endpoints that may change or stop working at any time. Review GetMyMacros' terms before use and use only with your own account.

The client is based on observed web-app behavior. See `docs/` for implementation notes; no GetMyMacros source code is included.

## Setup

```bash
git clone https://github.com/crcatala/mymacros-cli.git
cd mymacros-cli
npm ci
```

### Authentication

Set credentials as environment variables (never stored to disk):

```bash
export MYMACROS_USER="your_username"
export MYMACROS_PASSWORD="your_password"
```

Or authenticate interactively:

```bash
npx tsx src/cli.ts login
```

Sessions are cached in your operating system keyring by default (macOS Keychain, Windows Credential Manager, or Linux Secret Service) and auto-refresh on expiry (~1 hour). In headless environments without a keyring, the CLI falls back to `~/.config/mymacros-cli/session.json`, protected with `0600` permissions. Use `mymacros login --use-config` to choose that fallback explicitly. Never commit credentials or session files.

### Running

```bash
# During development (no build step needed)
npx tsx src/cli.ts <command>

# Or build and run from dist
npm run build
node dist/cli.js <command>
```

## Commands

### Viewing Data

```bash
# Daily meals (default: today)
mymacros daily
mymacros daily yesterday
mymacros daily 2026-01-15

# Search the food database
mymacros search "chicken breast"
mymacros search "eggs" --limit 5

# Food details
mymacros food 164298
mymacros food -- -2288          # negative IDs need -- separator

# Browse by category
mymacros browse custom          # your custom foods & favorites
mymacros browse recent          # recently used
mymacros browse types           # list categories
mymacros browse types Chicken   # foods in a category
mymacros browse brands          # list brands
mymacros browse brands Costco   # foods from a brand

# Dates with logged data
mymacros dates --limit 10
```

### Tracking Food

```bash
# Add a food (fetches food details automatically for required params)
mymacros add 164298 --meal Breakfast --serving 2

# Quick-add by macros (creates a persistent custom food)
mymacros add-quick --name "Protein shake" --cal 200 --protein 30 --carbs 10 --fat 3

# Update serving size or move between meals
mymacros update 668 --serving 3
mymacros update 668 --meal Lunch

# Remove a food entry
mymacros remove 668

# Copy a meal to another date
mymacros copy-meal Breakfast --to-date tomorrow
mymacros copy-meal Lunch --to-date 2026-02-20 --to-meal Dinner

# Delete all entries from a meal
mymacros delete-meal Lunch --date yesterday
```

### Notes & Favorites

```bash
# Day note
mymacros note "Felt great today"

# Meal note
mymacros note "Light meal" --meal Breakfast

# Clear a note
mymacros note ""

# Star / unstar a food
mymacros star 164298
mymacros unstar 164298
```

## Output Modes

| Flag | Behavior |
|------|----------|
| *(default)* | JSON when piped (non-TTY), plain text in terminal |
| `--json` | Force structured JSON output |
| `--plain` | Force human-readable text |
| `--table` | Force aligned table output for list commands |
| `--quiet` | Minimal output |
| `--debug` | Show HTTP request/response details |

Command data is always written to stdout; progress, status, warnings, and errors go to stderr, so piping output stays machine-safe.

### JSON Output (Agent Use)

When piped or with `--json`, all commands return structured JSON with IDs included for chaining:

```bash
# Agent workflow: find food → add it → check totals
FOOD_ID=$(mymacros search "chicken breast" | jq -r '.sections[0].foods[0].foodId')
mymacros add "$FOOD_ID" --meal Lunch --serving 6
mymacros daily | jq '.dailyTotals'
```

### Plain Output

Plain text includes `[foodId/uniqueId]` prefixes so IDs are accessible even in human-readable mode:

```
2026-02-17

Breakfast (301.79 kcal | 2.78P 38.18C 15.01F)
  [-28204/1583]    Double Espresso                1 Serving      200 kcal  2.1P 28C 8.9F
  [164298/2797]    Pringles                       19 Gr          101.79 kcal  0.68P 10.18C 6.11F

Daily Totals: 301.79 kcal | 2.78P 38.18C 15.01F
```

## Agent Integration Notes

**Designed for AI agents** that help track food/nutrition. Key behaviors:

- **JSON by default when piped** — agents get structured data automatically without `--json`
- **IDs always visible** — `foodId` and `uniqueId` in every response for command chaining
- **Pre-computed values** — nutrition values are pre-multiplied by serving size (no math needed)
- **Input validation** — commands validate inputs before hitting the API to avoid bad data
- **Helpful errors** — invalid meal names show valid options, missing entries list available ones
- **Result limits** — search/browse default to 25 items (override with `--limit N`, use `--limit 0` for all)

### Important: uniqueId is Volatile

The `uniqueId` for a food entry **changes on every update** (the API does delete + re-insert). After any mutation (`add`, `update`, `remove`, `copy-meal`, `delete-meal`), re-read `daily` to get current IDs.

Write commands return the updated daily data in their JSON response, so agents can read the new IDs directly from the response.

### Typical Agent Workflow

```
1. mymacros daily                          → see what's logged today
2. mymacros search "greek yogurt"          → find a food
3. mymacros food -1660                     → check nutrition details
4. mymacros add -1660 --meal Breakfast     → add it (response includes updated daily)
5. mymacros daily                          → verify the result
```

## Date Formats

Commands accept these date formats:

| Input | Meaning |
|-------|---------|
| `today` | Current date (default) |
| `yesterday` | Previous day |
| `tomorrow` | Next day |
| `2026-02-17` | Specific date (YYYY-MM-DD) |

Dates are converted to the API's internal `MM-DD-YYYY` format automatically.

## Project Structure

```
src/
  cli.ts              # Entrypoint
  cli-main.ts         # Testable main (DI pattern)
  run.ts              # Commander setup
  client.ts           # HTTP client — auth, secure session cache, API methods, normalization
  credentials.ts      # Keyring and protected-config session storage
  types.ts            # API + normalized output types
  cli/
    context.ts        # Output config, colors, TTY detection
    client.ts         # Client factory with progress/debug wiring
    output.ts         # stdout/stderr helpers
    prompt.ts         # Interactive and masked-password prompts
    spinner.ts        # Delayed TTY-only progress indicator
    table.ts          # ANSI-safe terminal table renderer
    help.ts           # Shared Commander help formatting
    options.ts        # Shared output option registration
    errors.ts         # Typed errors
  commands/           # One file per command
    login.ts, daily.ts, search.ts, food.ts, browse.ts, dates.ts,
    add.ts, remove.ts, update.ts, copy-meal.ts, delete-meal.ts,
    note.ts, star.ts
  lib/
    date.ts           # Date parsing/formatting
tests/
  date.test.ts        # Date utility tests
docs/                 # Observed API behavior and schema notes
captures/             # Deterministic synthetic fixtures (generated by scripts/generate-fixtures.mjs)
```

## Development

```bash
npm run dev -- daily                 # Run via tsx (no build)
npm run build                        # Compile TypeScript
npm test                             # Run tests
npm run lint                         # Check with Biome
npm run lint:fix                     # Auto-fix lint issues
npm run fixtures:check               # Verify committed fixtures are generated
```

## Not Implemented

These features are out of scope for this CLI:

- Weight tracking (`Weight.php`)
- Settings / profile / goals (`Settings.php`)
- Recipe management
- Custom food creation (`CreateCustomFood.php`)

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). This project is available under the [MIT License](LICENSE).
