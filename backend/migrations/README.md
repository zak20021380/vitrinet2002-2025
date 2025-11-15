# Database Migrations

This directory contains database migration scripts for Vitrinet marketplace.

## Available Migrations

### `merge-user-profiles.js`

**Purpose:** Merge separate product and service user systems into a unified dashboard.

**What it does:**
1. Links existing bookings to users by matching phone numbers
2. Creates placeholder user accounts for service customers without accounts
3. Updates `userType` field based on user activity (product/service/both)
4. Links ServiceShopCustomer records to user accounts

**Usage:**

```bash
# Dry run (see what would change without making changes)
node backend/migrations/merge-user-profiles.js --dry-run

# Actually run the migration
node backend/migrations/merge-user-profiles.js
```

**Prerequisites:**
- Ensure `.env` file has correct `MONGO_URI`
- Backup your database before running
- Run in dry-run mode first to verify changes

**What to expect:**
- Existing bookings will be linked to matching user accounts
- New user accounts will be created for service customers
- Users will be categorized as 'product', 'service', or 'both'
- No data loss - all existing fields preserved

**Rollback:**
If needed, restore from database backup taken before migration.

## Safety Notes

1. **Always backup your database first**
2. **Run in dry-run mode** to preview changes
3. **Review the output** before running actual migration
4. **Keep database backups** for at least 7 days after migration

## Migration History

| Date | Migration | Status |
|------|-----------|--------|
| TBD  | merge-user-profiles.js | Pending |
