-- Sprint 4.75 data migration — Step 3c/7: enforce NOT NULL on primary_domain.
ALTER TABLE sites ALTER COLUMN primary_domain SET NOT NULL;
