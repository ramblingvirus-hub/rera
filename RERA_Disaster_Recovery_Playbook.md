# RERA – Disaster Recovery Playbook

Last Updated: March 3, 2026 (Manila Time)
System Classification:
Integrity-Hardened, Versioned, Retry-Protected,
PostgreSQL-Backed, Environment-Disciplined,
Operationally Observable Core

--------------------------------------------------

## 1. Purpose

This document defines the manual backup and restore
procedure for the RERA production database.

Primary objective:
Guarantee recoverability of:

- REPORT
- CREDIT_TRANSACTION (ledger)
- AUDIT_EVENT
- SUBSCRIPTION
- AUTH_USER

No revenue operation should proceed without
validated restore capability.

--------------------------------------------------

## 2. Manual Backup Procedure

From project root:

pg_dump -U rera_user -h localhost -d rera_db -F p -f backups\rera_backup_YYYYMMDD_HHMM.sql

Password required.

Expected behavior:
Silent return to prompt.

Verification steps:

1. dir backups
2. Confirm new .sql file exists
3. Confirm file size > 5KB

Backups must never overwrite prior files.

--------------------------------------------------

## 3. Restore Validation Drill (Required for Verification)

1. Create test database:

createdb -U rera_user -h localhost rera_restore_test

2. Restore:

psql -U rera_user -h localhost -d rera_restore_test -f backups\<backup_file>.sql

3. Verify tables:

psql -U rera_user -h localhost -d rera_restore_test

Inside shell:

\dt
SELECT COUNT(*) FROM reports_report;

4. Cleanup:

dropdb -U rera_user -h localhost rera_restore_test

Restore drill must be executed at least once before revenue activation.

--------------------------------------------------

## 4. Backup Policy (Baseline)

• Weekly manual backup minimum.
• Mandatory backup before:
    - Schema changes
    - Major deployment
    - Migration
• Store monthly backup copy outside local machine.
• Never edit backup files.

--------------------------------------------------

## 5. Disaster Definition

A disaster includes:

• Accidental table deletion
• Ledger corruption
• Audit corruption
• Database engine failure
• Hardware failure
• Production data loss

Recovery strategy:
Restore most recent valid backup.

--------------------------------------------------

## 6. Scope Limitations (Phase 3F)

This baseline does NOT include:

• Automated scheduled backups
• Cloud replication
• Hot standby servers
• Incremental backups
• WAL archiving

Those belong to Phase 4+.

--------------------------------------------------

Status: Phase 3F Baseline Established