# `backfill_decrypt.py` — runbook

This is a one-time migration that decrypts every AES-GCM-encrypted column on
this project back to plaintext. It is intended to be run **once** against the
deployed Postgres before deploying the version of the backend that has the
`encryption_service` module removed.

The script is **self-contained**: it does not import any other project module
and inlines the AES-GCM logic. It works whether or not the rest of the
encryption code still exists in the codebase.

## Required environment

Set these in your shell or in a `.env` file in the current working directory:

```
AES_ENCRYPTION_KEY=<the base64-encoded 32-byte key the deployed backend
                    currently uses to encrypt>
DB_HOST=...
DB_PORT=5432
DB_NAME=...
DB_USER=...
DB_PASS=...
```

`AES_ENCRYPTION_KEY` MUST be the key that the deployed backend used at write
time. If you don't have it, the script cannot decrypt; rows will be reported
as `undecryptable` and left untouched.

## Dependencies

`pip install psycopg python-dotenv cryptography` — these are already in
`Backend/requirements.txt`.

## How to run

```bash
# 1. Dry-run. Reads everything, writes nothing. Prints what would change.
python Backend/scripts/backfill_decrypt.py --dry-run

# 2. For real.
python Backend/scripts/backfill_decrypt.py

# 3. Verify idempotency. Second pass should show rewritten=0 everywhere.
python Backend/scripts/backfill_decrypt.py --dry-run
```

Useful flags for a staged rollout:

- `--table NAME` — restrict to one table (e.g. `--table crowdping_posts`).
- `--limit N` — only process the first N rows per column.

## What it does

For each (table, column) below: select non-null rows, attempt to decrypt with
the supplied key. If decryption succeeds and produces a different value,
overwrite the column with the plaintext. If decryption fails, leave the row
untouched.

| Table | Columns |
| --- | --- |
| `crowdping_posts` | `content`, `custom_data` (special: unwraps `{"_enc": ...}` into raw JSONB) |
| `post_interactions` | `comment_text` |
| `place_reviews` | `title`, `body` |
| `users` | `email`, `full_name`, `canvas_access_token`, `canvas_refresh_token` |
| `admin_applications` | `email`, `organization_name`, `reason` |
| `admin_events` | `title`, `description`, `location_name` |

## What to spot-check after running

```sql
SELECT id, content FROM crowdping_posts ORDER BY created_at DESC LIMIT 5;
SELECT id, custom_data FROM crowdping_posts ORDER BY created_at DESC LIMIT 5;
SELECT clerk_id, full_name, email FROM users LIMIT 5;
SELECT id, comment_text FROM post_interactions
  WHERE comment_text IS NOT NULL ORDER BY created_at DESC LIMIT 5;
```

All values should be human-readable. `custom_data` should be a raw JSON
object, not `{"_enc": "..."}`.

## Rollback

There is no data rollback. The script overwrites columns in place. If you
need to recover the original encrypted state, restore from a pre-migration
DB snapshot. (Take one before running.)

The code change that removes `encryption_service` can be rolled back via
`git revert` independently, but only do that if you don't run the backfill
— otherwise the rolled-back code will fail to decrypt the plaintext rows.
