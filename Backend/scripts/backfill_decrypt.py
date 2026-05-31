from __future__ import annotations

import argparse
import base64
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Optional

import psycopg
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import load_dotenv
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb


BACKEND_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

load_dotenv(ROOT_DIR / ".env", override=False)
load_dotenv(BACKEND_DIR / ".env", override=False)

from db_config import CONNECTION_PARAMS  # noqa: E402


@dataclass(frozen=True)
class ColumnSpec:
    name: str
    kind: str


@dataclass(frozen=True)
class TableSpec:
    name: str
    pk: str
    columns: tuple[ColumnSpec, ...]


@dataclass
class ColumnStats:
    scanned: int = 0
    rewrites: int = 0
    failures: int = 0


TABLES: tuple[TableSpec, ...] = (
    TableSpec(
        "crowdping_posts",
        "id",
        (
            ColumnSpec("content", "text"),
            ColumnSpec("custom_data", "json"),
        ),
    ),
    TableSpec(
        "post_interactions",
        "id",
        (ColumnSpec("comment_text", "text"),),
    ),
    TableSpec(
        "place_reviews",
        "id",
        (
            ColumnSpec("title", "text"),
            ColumnSpec("body", "text"),
        ),
    ),
    TableSpec(
        "users",
        "id",
        (
            ColumnSpec("full_name", "text"),
            ColumnSpec("email", "text"),
        ),
    ),
    TableSpec(
        "admin_applications",
        "id",
        (
            ColumnSpec("email", "text"),
            ColumnSpec("organization_name", "text"),
            ColumnSpec("reason", "text"),
        ),
    ),
    TableSpec(
        "admin_events",
        "id",
        (
            ColumnSpec("title", "text"),
            ColumnSpec("description", "text"),
            ColumnSpec("location_name", "text"),
        ),
    ),
)


class Keyring:
    def __init__(self, keys: list[bytes]) -> None:
        self._ciphers = [AESGCM(key) for key in keys]

    @classmethod
    def from_base64_values(cls, values: Iterable[str]) -> "Keyring":
        keys: list[bytes] = []
        seen: set[bytes] = set()
        for value in values:
            value = value.strip()
            if not value:
                continue
            key = base64.b64decode(value, validate=True)
            if len(key) != 32:
                raise ValueError("Each AES key must decode to exactly 32 bytes.")
            if key not in seen:
                keys.append(key)
                seen.add(key)
        if not keys:
            raise ValueError(
                "No AES keys were provided. Set AES_ENCRYPTION_KEY, "
                "LEGACY_AES_ENCRYPTION_KEYS, or pass --key."
            )
        return cls(keys)

    @property
    def count(self) -> int:
        return len(self._ciphers)

    def decrypt_text(self, value: Any) -> Optional[str]:
        if not isinstance(value, str) or not value:
            return None
        try:
            combined = base64.b64decode(value, validate=True)
        except Exception:
            return None
        if len(combined) < 28:
            return None

        nonce = combined[:12]
        ciphertext = combined[12:]
        for cipher in self._ciphers:
            try:
                plaintext = cipher.decrypt(nonce, ciphertext, None)
                return plaintext.decode("utf-8")
            except Exception:
                continue
        return None


def _json_loads(value: str) -> Optional[Any]:
    try:
        return json.loads(value)
    except Exception:
        return None


def decrypt_json_value(value: Any, keyring: Keyring) -> tuple[Any, bool, bool]:
    """Return (new_value, changed, failed_encrypted_wrapper)."""
    if isinstance(value, str):
        parsed = _json_loads(value)
        if parsed is not None:
            return decrypt_json_value(parsed, keyring)
        decrypted = keyring.decrypt_text(value)
        if decrypted is None:
            return value, False, False
        parsed_decrypted = _json_loads(decrypted)
        return (parsed_decrypted if parsed_decrypted is not None else decrypted), True, False

    if isinstance(value, dict):
        encrypted = value.get("_enc")
        if isinstance(encrypted, str):
            decrypted = keyring.decrypt_text(encrypted)
            if decrypted is None:
                return value, False, True
            parsed = _json_loads(decrypted)
            return (parsed if isinstance(parsed, dict) else value), isinstance(parsed, dict), False

        changed = False
        rewritten: dict[str, Any] = {}
        for key, item in value.items():
            next_item, item_changed, _item_failed = decrypt_json_value(item, keyring)
            rewritten[key] = next_item
            changed = changed or item_changed
        return rewritten, changed, False

    if isinstance(value, list):
        changed = False
        rewritten = []
        for item in value:
            next_item, item_changed, _item_failed = decrypt_json_value(item, keyring)
            rewritten.append(next_item)
            changed = changed or item_changed
        return rewritten, changed, False

    return value, False, False


def candidate_keys(extra_keys: list[str]) -> list[str]:
    values: list[str] = []
    env_key = os.getenv("AES_ENCRYPTION_KEY")
    if env_key:
        values.append(env_key)
    legacy = os.getenv("LEGACY_AES_ENCRYPTION_KEYS", "")
    values.extend(part.strip() for part in legacy.split(",") if part.strip())
    values.extend(extra_keys)
    return values


def get_existing_columns(conn: psycopg.Connection, table_name: str) -> set[str]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            """,
            (table_name,),
        )
        return {row[0] for row in cur.fetchall()}


def table_exists(conn: psycopg.Connection, table_name: str) -> bool:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = %s
            )
            """,
            (table_name,),
        )
        return bool(cur.fetchone()[0])


def scan_and_rewrite_table(
    conn: psycopg.Connection,
    table: TableSpec,
    keyring: Keyring,
    dry_run: bool,
    limit: Optional[int],
) -> dict[str, ColumnStats]:
    if not table_exists(conn, table.name):
        print(f"skip {table.name}: table does not exist")
        return {}

    columns = get_existing_columns(conn, table.name)
    if table.pk not in columns:
        print(f"skip {table.name}: primary key column {table.pk!r} not found")
        return {}

    active_specs = [spec for spec in table.columns if spec.name in columns]
    missing = [spec.name for spec in table.columns if spec.name not in columns]
    for column in missing:
        print(f"skip {table.name}.{column}: column does not exist")
    if not active_specs:
        return {}

    stats = {spec.name: ColumnStats() for spec in active_specs}
    selected = ", ".join([table.pk] + [spec.name for spec in active_specs])
    sql = f"SELECT {selected} FROM {table.name}"
    params: tuple[Any, ...] = ()
    if limit:
        sql += " LIMIT %s"
        params = (limit,)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()

    with conn.cursor() as cur:
        for row in rows:
            pk_value = row[table.pk]
            for spec in active_specs:
                old_value = row[spec.name]
                if old_value is None:
                    continue
                stats[spec.name].scanned += 1

                if spec.kind == "json":
                    new_value, changed, failed = decrypt_json_value(old_value, keyring)
                    if failed:
                        stats[spec.name].failures += 1
                    if not changed:
                        continue
                    update_value: Any = Jsonb(new_value)
                else:
                    new_value = keyring.decrypt_text(old_value)
                    if new_value is None:
                        continue
                    update_value = new_value

                stats[spec.name].rewrites += 1
                if dry_run:
                    continue

                cur.execute(
                    f"UPDATE {table.name} SET {spec.name} = %s WHERE {table.pk} = %s",
                    (update_value, pk_value),
                )

    return stats


def clear_canvas_tokens(conn: psycopg.Connection, dry_run: bool) -> int:
    if not table_exists(conn, "users"):
        return 0
    columns = get_existing_columns(conn, "users")
    required = {"canvas_access_token", "canvas_refresh_token"}
    if not required.issubset(columns):
        return 0

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT COUNT(*)
            FROM users
            WHERE canvas_access_token IS NOT NULL
               OR canvas_refresh_token IS NOT NULL
            """
        )
        count = int(cur.fetchone()[0])
        if count and not dry_run:
            cur.execute(
                """
                UPDATE users
                SET canvas_access_token = NULL,
                    canvas_refresh_token = NULL,
                    canvas_expires_at = NULL
                WHERE canvas_access_token IS NOT NULL
                   OR canvas_refresh_token IS NOT NULL
                """
            )
    return count


def print_stats(all_stats: dict[str, dict[str, ColumnStats]], dry_run: bool) -> int:
    total_rewrites = 0
    action = "would rewrite" if dry_run else "rewrote"
    for table_name, stats in all_stats.items():
        for column_name, column_stats in stats.items():
            total_rewrites += column_stats.rewrites
            print(
                f"{table_name}.{column_name}: scanned={column_stats.scanned} "
                f"{action}={column_stats.rewrites} decrypt_failures={column_stats.failures}"
            )
    print(f"total {action}: {total_rewrites}")
    return total_rewrites


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="One-time backfill that decrypts AES-GCM encrypted DB fields into plaintext."
    )
    parser.add_argument("--dry-run", action="store_true", help="Scan and report without writing.")
    parser.add_argument(
        "--key",
        action="append",
        default=[],
        help="Additional base64 AES-256 key. Prefer env vars so keys do not land in shell history.",
    )
    parser.add_argument("--limit", type=int, default=None, help="Limit rows scanned per table for testing.")
    parser.add_argument(
        "--clear-canvas-tokens",
        action="store_true",
        help="Set unused Canvas OAuth token columns to NULL instead of decrypting them.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        keyring = Keyring.from_base64_values(candidate_keys(args.key))
    except Exception as exc:
        print(f"Failed to load AES keys: {exc}")
        return 2

    print(f"Loaded {keyring.count} AES candidate key(s).")
    if args.dry_run:
        print("DRY RUN: no database values will be changed.")

    all_stats: dict[str, dict[str, ColumnStats]] = {}
    try:
        with psycopg.connect(CONNECTION_PARAMS) as conn:
            for table in TABLES:
                stats = scan_and_rewrite_table(conn, table, keyring, args.dry_run, args.limit)
                if stats:
                    all_stats[table.name] = stats

            if args.clear_canvas_tokens:
                count = clear_canvas_tokens(conn, args.dry_run)
                action = "would clear" if args.dry_run else "cleared"
                print(f"users.canvas_*: {action}={count}")

            if args.dry_run:
                conn.rollback()
            else:
                conn.commit()
    except Exception as exc:
        print(f"Backfill failed: {exc}")
        return 1

    print_stats(all_stats, args.dry_run)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
