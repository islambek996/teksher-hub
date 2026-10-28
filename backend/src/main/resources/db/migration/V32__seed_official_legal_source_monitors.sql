-- Seed trusted public legal-information portals for automatic integrity checks.
-- The monitor detects a changed response hash; a specialist must review the legal meaning.
INSERT INTO source_monitors
    (name, jurisdiction, source_url, enabled, interval_hours, created_by, created_at, updated_at)
SELECT seed.name, seed.jurisdiction, seed.source_url, TRUE, seed.interval_hours, 'SYSTEM', NOW(), NOW()
FROM (VALUES
    ('Централизованный банк данных правовой информации КР', 'KG', 'https://cbd.minjust.gov.kg/', 24),
    ('Портал нормативных правовых актов Кабинета Министров КР', 'KG', 'https://www.gov.kg/ru/npa/', 24),
    ('Официальный интернет-портал правовой информации РФ', 'RU', 'https://publication.pravo.gov.ru/', 24),
    ('Правовой портал Евразийского экономического союза', 'EAEU', 'https://docs.eaeunion.org/', 24),
    ('Евразийская экономическая комиссия – официальный сайт', 'EAEU', 'https://eec.eaeunion.org/', 48)
) AS seed(name, jurisdiction, source_url, interval_hours)
WHERE NOT EXISTS (
    SELECT 1 FROM source_monitors existing WHERE existing.source_url = seed.source_url
);
