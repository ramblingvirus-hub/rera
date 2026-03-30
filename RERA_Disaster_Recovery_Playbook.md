# RERA – Disaster Recovery Playbook

Last Updated: March 30, 2026 (Manila Time)
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
- CONTACT_MESSAGE
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
    - Contact or billing workflow changes
• Store monthly backup copy outside local machine.
• Never edit backup files.

--------------------------------------------------

## 5. Disaster Definition

A disaster includes:

• Accidental table deletion
• Ledger corruption
• Audit corruption
• Contact message loss
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

--------------------------------------------------

## 7. Operational Recovery Notes

After restoring a production backup, also verify:

1. `CONTACT_MESSAGE` rows are present if Contact Us was live at backup time.
2. `AUDIT_EVENT` still contains contact submission events and billing events.
3. Environment variables required for recovery are still configured:
    - `DATABASE_URL`
    - `DB_SSLMODE`
    - `RESEND_API_KEY`
    - `RESEND_FROM_EMAIL`
    - `CONTACT_ADMIN_EMAIL`
4. Django admin static assets load correctly after restore or redeploy.

Restore is not considered complete until admin access, API access, and contact submission intake all function again.