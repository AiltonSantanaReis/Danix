# Backup and Restore

## Backup

- Manual SQLite backup is available via internal API/UI.
- Backup files are generated from the local database.

## Restore

- Import validates SQLite integrity.
- Restore replaces local data.
- Existing sessions are invalidated and a new login is required.

## Paths

- Main DB: `%AppData%\\Danix\\danix.db`
- Synchronized copy: `<Danix folder>\\database\\danix.db`

## Operational Recommendation

Before importing backups:

1. Close other running app instances.
2. Keep a copy of the current database.
3. Validate the backup source.
