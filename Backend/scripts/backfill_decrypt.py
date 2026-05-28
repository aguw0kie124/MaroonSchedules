"""
One-time migration that decrypts every AES-GCM-encrypted column on this
project back to plaintext, in preparation for fully removing the
`encryption_service` module.

This script is intentionally self-contained:
  - It inlines the AES-GCM decrypt logic so it keeps working even after
    `Backend/services/encryption_service.py` is deleted.
  - It only depends on `psycopg`, `python-dotenv`, and `cryptography`.
  - It does NOT import any other project module.

Required environment variables (read from process env or a `.env` file in
the current working directory, then in `Backend/`):
  AES_ENCRYPTION_KEY  base64-encoded 32-byte key used by the existing
                      backend for encryption
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS

Usage:
  python Backend/scripts/backfill_decrypt.py [--dry-run] [--table NAME]
                                              [--limit N]

The script is idempotent: a successful run followed by a second run
should report zero rewrites.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Optional

import psycopg
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from dotenv import load_dotenv


SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
ROOT_DIR = BACKEND_DIR.parent

load_dotenv(Path.cwd() / ".env", override=False)
load_dotenv(BACKEND_DIR / ".env", override=False)
load_dotenv(ROOT_DIR / ".env", override=False)


def _build_cipher() -> AESGCM:
    key_b64 = os.environ.get("AES_ENCRYPTION_KEY")
    if not key_b64:
        sys.exit(
            "AES_ENCRYPTION_KEY is not set. Refusing to run a backfill without "
            "the key that originally encrypted the data."
        )
    try:
        key_bytes = base64.b64decode(key_b64)
    except Exception as exc:
        sys.exit(f"AES_ENCRYPTION_KEY is not valid base64: {exc}")
    if len(key_bytes) != 32:
        sys.exit("AES_ENCRYPTION_KEY must decode to exactly 32 bytes.")
    return AESGCM(key_bytes)


def try_decrypt_string(cipher: AESGCM, value: Any) -> Optional[str]:
    """
    Returns the plaintext when `value` is a valid AES-GCM payload produced
    by this codebase. Returns None when it can't be decrypted (already
    plaintext, corrupted, or never encrypted in the first place).
    """
    if value is None or not isinstance(value, str) or not value:
        return None
    try:
        combined = base64.b64decode(value, validate=True)
    except Exception:
        return None
    if len(combined) < 12 + 16:  # nonce + min GCM tag
        return None
    nonce, ciphertext = combined[:12], combined[12:]
    try:
        plaintext = cipher.decrypt(nonce, ciphertext, None)
    except Exception:
        return None
    try:
        return plaintext.decode("utf-8")
    except UnicodeDecodeError:
        return None


def _build_connection_params() -> str:
    required = ["DB_HOST", "DB_NAME", "DB_USER", "DB_PASS"]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        sys.exit(f"Missing DB env vars: {', '.join(missing)}")
    host = os.environ["DB_HOST"]
    port = os.environ.get("DB_PORT", "5432")
    name = os.environ["DB_NAME"]
    user = os.environ["DB_USER"]
    password = os.environ["DB_PASS"]
    timeout = os.environ.get("DB_CONNECT_TIMEOUT", "15")
    return (
        f"host={host} port={port} dbname={name} user={user} password={password} "
        f"connect_timeout={timeout}"
    )


@dataclass
class ColumnSummary:
    table: str
    column: str
    scanned: int = 0
    rewritten: int = 0
    left_as_is: int = 0
    decrypt_failed: int = 0

    def line(self) -> str:
        return (
            f"  {self.table}.{self.column:<22} "
            f"scanned={self.scanned:<6} "
            f"rewritten={self.rewritten:<6} "
            f"unchanged={self.left_as_is:<6} "
            f"failed={self.decrypt_failed}"
        )


# ---------------------------------------------------------------------------
# Per-column backfill routines
# ---------------------------------------------------------------------------


def backfill_string_column(
    conn: psycopg.Connection,
    cipher: AESGCM,
    table: str,
    column: str,
    id_column: str = "id",
    dry_run: bool = False,
    limit: Optional[int] = None,
) -> ColumnSummary:
    summary = ColumnSummary(table=table, column=column)
    select_sql = (
        f"SELECT {id_column}, {column} FROM {table} "
        f"WHERE {column} IS NOT NULL"
    )
    if limit is not None:
        select_sql += f" LIMIT {int(limit)}"

    update_sql = f"UPDATE {table} SET {column} = %s WHERE {id_column} = %s"

    with conn.cursor() as cur:
        cur.execute(select_sql)
        rows = cur.fetchall()

    with conn.cursor() as update_cur:
        for row_id, value in rows:
            summary.scanned += 1
            if value is None or value == "":
                summary.left_as_is += 1
                continue
            plaintext = try_decrypt_string(cipher, value)
            if plaintext is None:
                # Either already plaintext or unrecoverable. We can't tell the
                # two apart without a marker, so leave it as-is.
                summary.decrypt_failed += 1
                continue
            if plaintext == value:
                summary.left_as_is += 1
                continue
            summary.rewritten += 1
            if not dry_run:
                update_cur.execute(update_sql, (plaintext, row_id))
    if not dry_run:
        conn.commit()
    return summary


def backfill_custom_data(
    conn: psycopg.Connection,
    cipher: AESGCM,
    dry_run: bool = False,
    limit: Optional[int] = None,
) -> ColumnSummary:
    """
    Special-case for crowdping_posts.custom_data, which is stored as a JSONB
    object wrapped as `{"_enc": "<ciphertext>"}`. We unwrap and rewrite as
    raw JSONB.
    """
    summary = ColumnSummary(table="crowdping_posts", column="custom_data")
    select_sql = (
        "SELECT id, custom_data FROM crowdping_posts "
        "WHERE custom_data IS NOT NULL"
    )
    if limit is not None:
        select_sql += f" LIMIT {int(limit)}"

    update_sql = "UPDATE crowdping_posts SET custom_data = %s::jsonb WHERE id = %s"

    with conn.cursor() as cur:
        cur.execute(select_sql)
        rows = cur.fetchall()

    with conn.cursor() as update_cur:
        for row_id, custom_data in rows:
            summary.scanned += 1
            if not isinstance(custom_data, dict) or "_enc" not in custom_data:
                summary.left_as_is += 1
                continue
            enc_value = custom_data.get("_enc")
            # When encrypt_json was called with an empty dict, the wrapper
            # stored the literal string "{}", not ciphertext. Handle that
            # explicitly so we still unwrap those rows.
            if enc_value == "{}":
                new_value: dict = {}
            else:
                decrypted = try_decrypt_string(cipher, enc_value)
                if decrypted is None:
                    summary.decrypt_failed += 1
                    continue
                try:
                    new_value = json.loads(decrypted)
                except json.JSONDecodeError:
                    summary.decrypt_failed += 1
                    continue
                if not isinstance(new_value, dict):
                    summary.decrypt_failed += 1
                    continue
            summary.rewritten += 1
            if not dry_run:
                update_cur.execute(update_sql, (json.dumps(new_value), row_id))
    if not dry_run:
        conn.commit()
    return summary


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

# (table, column, id_column)
STRING_COLUMNS = [
    ("crowdping_posts", "content", "id"),
    ("post_interactions", "comment_text", "id"),
    ("place_reviews", "title", "id"),
    ("place_reviews", "body", "id"),
    ("users", "email", "clerk_id"),
    ("users", "full_name", "clerk_id"),
    ("users", "canvas_access_token", "clerk_id"),
    ("users", "canvas_refresh_token", "clerk_id"),
    ("admin_applications", "email", "id"),
    ("admin_applications", "organization_name", "id"),
    ("admin_applications", "reason", "id"),
    ("admin_events", "title", "id"),
    ("admin_events", "description", "id"),
    ("admin_events", "location_name", "id"),
]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Read and report what would change without writing.",
    )
    parser.add_argument(
        "--table",
        default=None,
        help="Only process a single table (e.g. crowdping_posts).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Per-column row cap, useful for smoke tests.",
    )
    args = parser.parse_args()

    cipher = _build_cipher()
    conn_params = _build_connection_params()

    mode = "DRY RUN" if args.dry_run else "LIVE"
    print(f"[backfill_decrypt] mode={mode} table_filter={args.table or '*'} "
          f"limit={args.limit or '*'}")

    summaries: list[ColumnSummary] = []

    with psycopg.connect(conn_params) as conn:
        for table, column, id_column in STRING_COLUMNS:
            if args.table and args.table != table:
                continue
            try:
                summary = backfill_string_column(
                    conn,
                    cipher,
                    table=table,
                    column=column,
                    id_column=id_column,
                    dry_run=args.dry_run,
                    limit=args.limit,
                )
            except psycopg.errors.UndefinedTable:
                conn.rollback()
                print(f"  {table}.{column}: table not present in this DB; skipping")
                continue
            except psycopg.errors.UndefinedColumn:
                conn.rollback()
                print(f"  {table}.{column}: column not present; skipping")
                continue
            summaries.append(summary)

        if not args.table or args.table == "crowdping_posts":
            try:
                summaries.append(
                    backfill_custom_data(
                        conn,
                        cipher,
                        dry_run=args.dry_run,
                        limit=args.limit,
                    )
                )
            except (psycopg.errors.UndefinedTable, psycopg.errors.UndefinedColumn):
                conn.rollback()
                print("  crowdping_posts.custom_data: missing; skipping")

    print("\n[backfill_decrypt] per-column summary:")
    for s in summaries:
        print(s.line())

    total_rewritten = sum(s.rewritten for s in summaries)
    total_failed = sum(s.decrypt_failed for s in summaries)
    print(
        f"\n[backfill_decrypt] done. rewritten={total_rewritten} "
        f"undecryptable={total_failed} mode={mode}"
    )
    if total_failed:
        print(
            "  Note: 'undecryptable' rows are either already plaintext OR were "
            "encrypted with a different key. The script cannot distinguish; it "
            "leaves them untouched."
        )


if __name__ == "__main__":
    main()
