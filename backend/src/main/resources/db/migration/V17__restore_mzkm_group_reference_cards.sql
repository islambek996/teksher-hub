-- Move six MZKM product-group reference cards back into the MZKM catalogue.
-- Restore their full prior content from document_versions instead of leaving the archive stub.
-- Keep them UNDER_REVIEW: published Teksher code lists are reference material and need legal/code-list verification.
-- The seventh V9 card (alcohol/tobacco national methodology) is intentionally not restored to MZKM.
WITH
target_ids(id) AS (
  VALUES
    ('b3000000-0000-4000-8000-000000000001'::uuid),
    ('b3000000-0000-4000-8000-000000000002'::uuid),
    ('b3000000-0000-4000-8000-000000000003'::uuid),
    ('b3000000-0000-4000-8000-000000000004'::uuid),
    ('b3000000-0000-4000-8000-000000000005'::uuid),
    ('b3000000-0000-4000-8000-000000000006'::uuid)
),
previous_versions AS (
  SELECT DISTINCT
    ON (v.document_id) v.*
  FROM
    document_versions v
    JOIN documents current ON current.id = v.document_id
    JOIN target_ids t ON t.id = current.id
  WHERE
    v.version_number < current.version_number
  ORDER BY
    v.document_id,
    v.version_number DESC
)
UPDATE
  documents d
SET
  title = v.title,
  jurisdiction = v.jurisdiction,
  kind = v.kind,
  area = 'МЗКМ / товарные группы и коды ТН ВЭД',
  product_group = v.product_group,
  keywords = v.keywords,
  document_number = v.document_number,
  document_date = v.document_date,
  effective_from = v.effective_from,
  effective_until = v.effective_until,
  source_url = v.source_url,
  description = v.description,
  content = v.content,
  status = 'UNDER_REVIEW',
  official_source_checked_at = NULL,
  source_check_note = 'Возвращено в каталог МЗКМ по запросу пользователя. Таблица/перечень из публикации оператора остаётся справочным материалом; сверить полный код ТН ВЭД и актуальный нормативный акт перед практическим применением.',
  updated_by = 'system-migration-v17',
  updated_at = NOW(),
  version_number = d.version_number + 1
FROM
  previous_versions v
WHERE
  d.id = v.document_id
  AND d.status = 'ARCHIVED';
-- Save the restored state to the revision history.
INSERT INTO
  document_versions (
    document_id,
    version_number,
    title,
    jurisdiction,
    kind,
    area,
    product_group,
    keywords,
    document_number,
    document_date,
    effective_from,
    effective_until,
    source_url,
    description,
    content,
    status,
    related_document_ids,
    change_note,
    changed_by,
    created_at
  )
SELECT
  d.id,
  d.version_number,
  d.title,
  d.jurisdiction,
  d.kind,
  d.area,
  d.product_group,
  d.keywords,
  d.document_number,
  d.document_date,
  d.effective_from,
  d.effective_until,
  d.source_url,
  d.description,
  d.content,
  d.status,
  '',
  'Карточка восстановлена в каталоге МЗКМ; архивный префикс удалён, полное предыдущее содержание восстановлено из истории версий. Оставлена на проверке до сверки перечня кодов и нормативных исключений.',
  'system-migration-v17',
  NOW()
FROM
  documents d
WHERE
  d.id IN (
    'b3000000-0000-4000-8000-000000000001'::uuid,
    'b3000000-0000-4000-8000-000000000002'::uuid,
    'b3000000-0000-4000-8000-000000000003'::uuid,
    'b3000000-0000-4000-8000-000000000004'::uuid,
    'b3000000-0000-4000-8000-000000000005'::uuid,
    'b3000000-0000-4000-8000-000000000006'::uuid
  )
  AND d.status = 'UNDER_REVIEW'
ON CONFLICT
  (document_id, version_number)
DO NOTHING
;