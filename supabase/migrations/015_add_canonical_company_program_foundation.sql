-- ============================================================
-- 015_add_canonical_company_program_foundation.sql
-- Add canonical catalog, bucket, company-program, and employer
-- eligibility configuration tables while keeping programs and
-- program_enrollments as the live operational compatibility layer.
-- ============================================================

CREATE TABLE IF NOT EXISTS catalog_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    item_type TEXT NOT NULL CHECK (item_type IN ('package', 'service_tier', 'add_on', 'support')),
    category TEXT NOT NULL CHECK (category IN ('eu_package', 'service_tier', 'program_add_on', 'support')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    default_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
    is_program_assignable BOOLEAN NOT NULL DEFAULT true,
    is_order_selectable BOOLEAN NOT NULL DEFAULT false,
    is_billable BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS program_buckets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    bucket_type TEXT NOT NULL CHECK (bucket_type IN ('eu_package', 'service_tier')),
    display_order INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS program_bucket_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bucket_id UUID NOT NULL REFERENCES program_buckets(id) ON DELETE CASCADE,
    catalog_item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (bucket_id, catalog_item_id)
);

CREATE TABLE IF NOT EXISTS company_programs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL UNIQUE REFERENCES programs(id) ON DELETE CASCADE,
    company_code TEXT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    eu_package_bucket_id UUID REFERENCES program_buckets(id) ON DELETE SET NULL,
    service_tier_bucket_id UUID REFERENCES program_buckets(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_program_item_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_program_id UUID NOT NULL REFERENCES company_programs(id) ON DELETE CASCADE,
    catalog_item_id UUID NOT NULL REFERENCES catalog_items(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (company_program_id, catalog_item_id)
);

CREATE TABLE IF NOT EXISTS eligibility_field_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE CHECK (
        key IN (
            'employeeId',
            'firstName',
            'lastName',
            'email',
            'companyId',
            'department',
            'location',
            'eligibilityStatus',
            'hireDate',
            'allowanceGroup',
            'notes'
        )
    ),
    label TEXT NOT NULL,
    required_default BOOLEAN NOT NULL DEFAULT false,
    field_type TEXT NOT NULL CHECK (field_type IN ('text', 'email', 'date', 'select', 'textarea')),
    description TEXT,
    example TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS eligibility_import_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    company_program_id UUID REFERENCES company_programs(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_eligibility_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    program_id UUID NOT NULL UNIQUE REFERENCES programs(id) ON DELETE CASCADE,
    template_id UUID REFERENCES eligibility_import_templates(id) ON DELETE SET NULL,
    allow_additional_fields BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS company_eligibility_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    configuration_id UUID NOT NULL REFERENCES company_eligibility_configurations(id) ON DELETE CASCADE,
    field_definition_id UUID NOT NULL REFERENCES eligibility_field_definitions(id) ON DELETE CASCADE,
    is_required BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (configuration_id, field_definition_id)
);

CREATE INDEX IF NOT EXISTS idx_catalog_items_status
    ON catalog_items(status, display_order);
CREATE INDEX IF NOT EXISTS idx_program_buckets_status
    ON program_buckets(status, display_order);
CREATE INDEX IF NOT EXISTS idx_program_bucket_items_bucket
    ON program_bucket_items(bucket_id, display_order);
CREATE INDEX IF NOT EXISTS idx_company_programs_status
    ON company_programs(status);
CREATE INDEX IF NOT EXISTS idx_company_programs_program_id
    ON company_programs(program_id);
CREATE INDEX IF NOT EXISTS idx_company_program_item_assignments_program
    ON company_program_item_assignments(company_program_id, display_order);
CREATE INDEX IF NOT EXISTS idx_company_eligibility_fields_configuration
    ON company_eligibility_fields(configuration_id, display_order);

CREATE TRIGGER tr_catalog_items_updated
    BEFORE UPDATE ON catalog_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_program_buckets_updated
    BEFORE UPDATE ON program_buckets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_company_programs_updated
    BEFORE UPDATE ON company_programs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_eligibility_field_definitions_updated
    BEFORE UPDATE ON eligibility_field_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_eligibility_import_templates_updated
    BEFORE UPDATE ON eligibility_import_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_company_eligibility_configurations_updated
    BEFORE UPDATE ON company_eligibility_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER tr_audit_company_programs
    AFTER INSERT OR UPDATE OR DELETE ON company_programs
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER tr_audit_company_program_item_assignments
    AFTER INSERT OR UPDATE OR DELETE ON company_program_item_assignments
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER tr_audit_company_eligibility_configurations
    AFTER INSERT OR UPDATE OR DELETE ON company_eligibility_configurations
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER tr_audit_company_eligibility_fields
    AFTER INSERT OR UPDATE OR DELETE ON company_eligibility_fields
    FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

ALTER TABLE catalog_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_bucket_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_program_item_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligibility_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE eligibility_import_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_eligibility_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_eligibility_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "catalog_items_select" ON catalog_items;
CREATE POLICY "catalog_items_select" ON catalog_items
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "program_buckets_select" ON program_buckets;
CREATE POLICY "program_buckets_select" ON program_buckets
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "program_bucket_items_select" ON program_bucket_items;
CREATE POLICY "program_bucket_items_select" ON program_bucket_items
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "company_programs_select" ON company_programs;
CREATE POLICY "company_programs_select" ON company_programs
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "company_programs_insert" ON company_programs;
CREATE POLICY "company_programs_insert" ON company_programs
    FOR INSERT TO authenticated
    WITH CHECK (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));

DROP POLICY IF EXISTS "company_programs_update" ON company_programs;
CREATE POLICY "company_programs_update" ON company_programs
    FOR UPDATE TO authenticated
    USING (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));

DROP POLICY IF EXISTS "company_program_item_assignments_select" ON company_program_item_assignments;
CREATE POLICY "company_program_item_assignments_select" ON company_program_item_assignments
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "company_program_item_assignments_insert" ON company_program_item_assignments;
CREATE POLICY "company_program_item_assignments_insert" ON company_program_item_assignments
    FOR INSERT TO authenticated
    WITH CHECK (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));

DROP POLICY IF EXISTS "company_program_item_assignments_update" ON company_program_item_assignments;
CREATE POLICY "company_program_item_assignments_update" ON company_program_item_assignments
    FOR UPDATE TO authenticated
    USING (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));

DROP POLICY IF EXISTS "eligibility_field_definitions_select" ON eligibility_field_definitions;
CREATE POLICY "eligibility_field_definitions_select" ON eligibility_field_definitions
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "eligibility_import_templates_select" ON eligibility_import_templates;
CREATE POLICY "eligibility_import_templates_select" ON eligibility_import_templates
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "company_eligibility_configurations_select" ON company_eligibility_configurations;
CREATE POLICY "company_eligibility_configurations_select" ON company_eligibility_configurations
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "company_eligibility_configurations_insert" ON company_eligibility_configurations;
CREATE POLICY "company_eligibility_configurations_insert" ON company_eligibility_configurations
    FOR INSERT TO authenticated
    WITH CHECK (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));

DROP POLICY IF EXISTS "company_eligibility_configurations_update" ON company_eligibility_configurations;
CREATE POLICY "company_eligibility_configurations_update" ON company_eligibility_configurations
    FOR UPDATE TO authenticated
    USING (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));

DROP POLICY IF EXISTS "company_eligibility_fields_select" ON company_eligibility_fields;
CREATE POLICY "company_eligibility_fields_select" ON company_eligibility_fields
    FOR SELECT TO authenticated
    USING (true);

DROP POLICY IF EXISTS "company_eligibility_fields_insert" ON company_eligibility_fields;
CREATE POLICY "company_eligibility_fields_insert" ON company_eligibility_fields
    FOR INSERT TO authenticated
    WITH CHECK (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));

DROP POLICY IF EXISTS "company_eligibility_fields_update" ON company_eligibility_fields;
CREATE POLICY "company_eligibility_fields_update" ON company_eligibility_fields
    FOR UPDATE TO authenticated
    USING (get_employee_role() IN ('admin', 'manager', 'sales', 'optician'));

INSERT INTO catalog_items (
    code,
    name,
    description,
    item_type,
    category,
    status,
    default_amount,
    currency,
    is_program_assignable,
    is_order_selectable,
    is_billable,
    display_order
)
VALUES
    ('EU_PACKAGE_COMPLIANCE', 'Compliance', 'Base EU package for compliance-oriented company programs.', 'package', 'eu_package', 'active', 235, 'USD', true, false, true, 10),
    ('EU_PACKAGE_COMFORT', 'Comfort', 'Base EU package for broader employee program coverage.', 'package', 'eu_package', 'active', 290, 'USD', true, false, true, 20),
    ('EU_PACKAGE_COMPLETE', 'Complete', 'Base EU package for the most inclusive default coverage set.', 'package', 'eu_package', 'active', 435, 'USD', true, false, true, 30),
    ('SERVICE_TIER_ESSENTIAL', 'Essential', 'Base service tier for program setup and recurring support.', 'service_tier', 'service_tier', 'active', 65, 'USD', true, false, true, 40),
    ('SERVICE_TIER_ACCESS', 'Access', 'Expanded service tier for higher-touch program operations.', 'service_tier', 'service_tier', 'active', 85, 'USD', true, false, true, 50),
    ('SERVICE_TIER_PREMIER', 'Premier', 'Highest active service tier for recurring program support.', 'service_tier', 'service_tier', 'active', 105, 'USD', true, false, true, 60),
    ('ADD_ON_ANTI_FOG', 'Anti-Fog', 'Program add-on for anti-fog lens treatment.', 'add_on', 'program_add_on', 'active', 65, 'USD', true, false, true, 70),
    ('ADD_ON_ANTI_REFLECTIVE_STANDARD', 'Anti-Reflective Standard', 'Program add-on for standard anti-reflective treatment.', 'add_on', 'program_add_on', 'active', 50, 'USD', true, false, true, 80),
    ('ADD_ON_ANTI_REFLECTIVE_ANTI_FOG_COMBO', 'Anti-Reflective + Anti-Fog Combo', 'Program add-on for combined anti-reflective and anti-fog treatment.', 'add_on', 'program_add_on', 'active', 95, 'USD', true, false, true, 90),
    ('ADD_ON_BLUE_LIGHT_ANTI_REFLECTIVE', 'Blue Light + Anti-Reflective', 'Program add-on for blue light and anti-reflective treatment.', 'add_on', 'program_add_on', 'active', 90, 'USD', true, false, true, 100),
    ('ADD_ON_BLUE_LIGHT_FILTER', 'Blue Light Filter', 'Program add-on for blue light filtering lenses.', 'add_on', 'program_add_on', 'active', 50, 'USD', true, false, true, 110),
    ('ADD_ON_TRANSITIONS', 'Transitions', 'Program add-on for light-reactive transition lenses.', 'add_on', 'program_add_on', 'active', 135, 'USD', true, false, true, 120),
    ('ADD_ON_EXTRA_SCRATCH_COATING', 'Extra Scratch Coating', 'Program add-on for additional scratch-resistant coating.', 'add_on', 'program_add_on', 'active', 65, 'USD', true, false, true, 130),
    ('SUPPORT_EXTRA_SITE_VISIT', 'Extra Site Visit', 'Support item for additional on-site visits outside the base tier.', 'support', 'support', 'active', 60, 'USD', true, false, true, 140)
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    item_type = EXCLUDED.item_type,
    category = EXCLUDED.category,
    status = EXCLUDED.status,
    default_amount = EXCLUDED.default_amount,
    currency = EXCLUDED.currency,
    is_program_assignable = EXCLUDED.is_program_assignable,
    is_order_selectable = EXCLUDED.is_order_selectable,
    is_billable = EXCLUDED.is_billable,
    display_order = EXCLUDED.display_order;

INSERT INTO program_buckets (code, name, bucket_type, display_order, status)
VALUES
    ('EU_COMPLIANCE', 'EU Compliance', 'eu_package', 10, 'active'),
    ('EU_COMFORT', 'EU Comfort', 'eu_package', 20, 'active'),
    ('EU_COMPLETE', 'EU Complete', 'eu_package', 30, 'active'),
    ('SERVICE_ESSENTIAL', 'Service Essential', 'service_tier', 40, 'active'),
    ('SERVICE_ACCESS', 'Service Access', 'service_tier', 50, 'active'),
    ('SERVICE_PREMIER', 'Service Premier', 'service_tier', 60, 'active')
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    bucket_type = EXCLUDED.bucket_type,
    display_order = EXCLUDED.display_order,
    status = EXCLUDED.status;

INSERT INTO program_bucket_items (bucket_id, catalog_item_id, display_order)
SELECT b.id, c.id, seeded.display_order
FROM (
    VALUES
        ('EU_COMPLIANCE', 'EU_PACKAGE_COMPLIANCE', 10),
        ('EU_COMFORT', 'EU_PACKAGE_COMFORT', 10),
        ('EU_COMPLETE', 'EU_PACKAGE_COMPLETE', 10),
        ('SERVICE_ESSENTIAL', 'SERVICE_TIER_ESSENTIAL', 10),
        ('SERVICE_ACCESS', 'SERVICE_TIER_ACCESS', 10),
        ('SERVICE_PREMIER', 'SERVICE_TIER_PREMIER', 10)
) AS seeded(bucket_code, catalog_item_code, display_order)
JOIN program_buckets b ON b.code = seeded.bucket_code
JOIN catalog_items c ON c.code = seeded.catalog_item_code
ON CONFLICT (bucket_id, catalog_item_id) DO UPDATE
SET display_order = EXCLUDED.display_order;

INSERT INTO eligibility_field_definitions (
    key,
    label,
    required_default,
    field_type,
    description,
    example,
    display_order
)
VALUES
    ('employeeId', 'Employee ID', false, 'text', 'Stable employer-provided employee identifier.', 'E12345', 10),
    ('firstName', 'First Name', true, 'text', 'Employee legal or roster first name.', 'Jordan', 20),
    ('lastName', 'Last Name', true, 'text', 'Employee legal or roster last name.', 'Lee', 30),
    ('email', 'Email', false, 'email', 'Employee work or personal email when available.', 'jordan.lee@example.com', 40),
    ('companyId', 'Company ID', false, 'text', 'Employer-side company identifier when supplied in the roster.', 'ACME-WEST', 50),
    ('department', 'Department', false, 'text', 'Department or cost center grouping from the employer.', 'Warehouse', 60),
    ('location', 'Location', false, 'text', 'Primary work location or site name.', 'Phoenix DC', 70),
    ('eligibilityStatus', 'Eligibility Status', false, 'select', 'Normalized eligibility decision from the employer roster when supplied.', 'eligible', 80),
    ('hireDate', 'Hire Date', false, 'date', 'Hire date used for waiting periods when applicable.', '2026-01-15', 90),
    ('allowanceGroup', 'Allowance Group', false, 'text', 'Optional group used to map coverage or pricing variations.', 'Manufacturing Annual', 100),
    ('notes', 'Notes', false, 'textarea', 'Employer-supplied notes that should travel with the intake row.', 'Supervisor approval required for specialty add-ons.', 110)
ON CONFLICT (key) DO UPDATE
SET
    label = EXCLUDED.label,
    required_default = EXCLUDED.required_default,
    field_type = EXCLUDED.field_type,
    description = EXCLUDED.description,
    example = EXCLUDED.example,
    display_order = EXCLUDED.display_order;

INSERT INTO eligibility_import_templates (code, name, description, company_program_id)
VALUES (
    'DEFAULT_EMPLOYER_ELIGIBILITY',
    'Default Employer Eligibility Intake',
    'Baseline company roster template for employee program eligibility intake.',
    NULL
)
ON CONFLICT (code) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description;

INSERT INTO company_programs (
    program_id,
    company_code,
    code,
    name,
    eu_package_bucket_id,
    service_tier_bucket_id,
    status
)
SELECT
    p.id,
    p.company_code,
    COALESCE(NULLIF(trim(p.company_code), ''), 'PROGRAM-' || upper(left(replace(p.id::text, '-', ''), 8))),
    p.company_name,
    eu_bucket.id,
    tier_bucket.id,
    CASE WHEN p.is_active THEN 'active' ELSE 'inactive' END
FROM programs p
LEFT JOIN program_buckets eu_bucket
    ON eu_bucket.code = CASE
        WHEN p.eu_package = 'Compliance' THEN 'EU_COMPLIANCE'
        WHEN p.eu_package = 'Comfort' THEN 'EU_COMFORT'
        WHEN p.eu_package = 'Complete' THEN 'EU_COMPLETE'
        WHEN lower(COALESCE(p.eu_package, '')) = ('cov' || 'ered') THEN 'EU_COMPLIANCE'
        ELSE NULL
    END
LEFT JOIN program_buckets tier_bucket
    ON tier_bucket.code = CASE
        WHEN p.service_tier = 'Essential' THEN 'SERVICE_ESSENTIAL'
        WHEN p.service_tier = 'Access' THEN 'SERVICE_ACCESS'
        WHEN p.service_tier = 'Premier' THEN 'SERVICE_PREMIER'
        WHEN lower(COALESCE(p.service_tier, '')) = ('enter' || 'prise') THEN 'SERVICE_PREMIER'
        ELSE NULL
    END
ON CONFLICT (program_id) DO UPDATE
SET
    company_code = EXCLUDED.company_code,
    name = EXCLUDED.name,
    eu_package_bucket_id = EXCLUDED.eu_package_bucket_id,
    service_tier_bucket_id = EXCLUDED.service_tier_bucket_id,
    status = EXCLUDED.status;

INSERT INTO company_program_item_assignments (company_program_id, catalog_item_id, display_order)
SELECT
    cp.id,
    c.id,
    c.display_order
FROM programs p
JOIN company_programs cp
    ON cp.program_id = p.id
JOIN LATERAL unnest(COALESCE(p.eu_package_add_ons, ARRAY[]::TEXT[])) AS add_on(add_on_key)
    ON true
JOIN catalog_items c
    ON c.code = CASE add_on.add_on_key
        WHEN 'antiFog' THEN 'ADD_ON_ANTI_FOG'
        WHEN 'antiReflectiveStd' THEN 'ADD_ON_ANTI_REFLECTIVE_STANDARD'
        WHEN 'antiReflectiveAntiFogCombo' THEN 'ADD_ON_ANTI_REFLECTIVE_ANTI_FOG_COMBO'
        WHEN 'blueLightAntiReflective' THEN 'ADD_ON_BLUE_LIGHT_ANTI_REFLECTIVE'
        WHEN 'blueLightFilter' THEN 'ADD_ON_BLUE_LIGHT_FILTER'
        WHEN 'transitions' THEN 'ADD_ON_TRANSITIONS'
        WHEN 'extraScratchCoating' THEN 'ADD_ON_EXTRA_SCRATCH_COATING'
        ELSE NULL
    END
ON CONFLICT (company_program_id, catalog_item_id) DO NOTHING;

INSERT INTO company_eligibility_configurations (program_id, template_id, allow_additional_fields)
SELECT
    p.id,
    t.id,
    false
FROM programs p
CROSS JOIN eligibility_import_templates t
WHERE t.code = 'DEFAULT_EMPLOYER_ELIGIBILITY'
ON CONFLICT (program_id) DO UPDATE
SET
    template_id = EXCLUDED.template_id,
    allow_additional_fields = EXCLUDED.allow_additional_fields;

INSERT INTO company_eligibility_fields (
    configuration_id,
    field_definition_id,
    is_required,
    is_active,
    display_order
)
SELECT
    cec.id,
    efd.id,
    efd.required_default,
    true,
    efd.display_order
FROM company_eligibility_configurations cec
JOIN eligibility_field_definitions efd ON true
ON CONFLICT (configuration_id, field_definition_id) DO UPDATE
SET
    is_required = EXCLUDED.is_required,
    is_active = EXCLUDED.is_active,
    display_order = EXCLUDED.display_order;

UPDATE programs
SET eu_package = 'Compliance'
WHERE lower(COALESCE(eu_package, '')) = ('cov' || 'ered');

UPDATE programs
SET service_tier = 'Premier'
WHERE lower(COALESCE(service_tier, '')) = ('enter' || 'prise');

ALTER TABLE programs
    DROP CONSTRAINT IF EXISTS programs_eu_package_check;

ALTER TABLE programs
    ADD CONSTRAINT programs_eu_package_check
    CHECK (
        eu_package IS NULL
        OR eu_package IN ('Compliance', 'Comfort', 'Complete')
    );

ALTER TABLE programs
    DROP CONSTRAINT IF EXISTS programs_service_tier_check;

ALTER TABLE programs
    ADD CONSTRAINT programs_service_tier_check
    CHECK (
        service_tier IS NULL
        OR service_tier IN ('Essential', 'Access', 'Premier')
    );
