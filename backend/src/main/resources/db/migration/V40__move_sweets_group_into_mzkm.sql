-- MZKM is the external-marking contour. Move the sweets group from the
-- mistakenly introduced separate externalGroups collection into mzkmGroups.

UPDATE product_group_catalog
SET payload_json =
    (
      jsonb_set(
        jsonb_set(
          COALESCE(payload_json::jsonb, '{}'::jsonb),
          '{mzkmGroups}',
          CASE
            WHEN COALESCE(payload_json::jsonb->'mzkmGroups', '[]'::jsonb)
                 @> jsonb_build_array('Сладости и кондитерские изделия')
            THEN COALESCE(payload_json::jsonb->'mzkmGroups', '[]'::jsonb)
            ELSE COALESCE(payload_json::jsonb->'mzkmGroups', '[]'::jsonb)
                 || jsonb_build_array('Сладости и кондитерские изделия')
          END,
          true
        ),
        '{mzkmDetails}',
        COALESCE(payload_json::jsonb->'mzkmDetails', '{}'::jsonb)
          || jsonb_build_object(
            'Сладости и кондитерские изделия',
            jsonb_build_object(
              'description',
              'Товарная группа МЗКМ (внешняя маркировка). Справочный перечень сформирован по предоставленному Excel-файлу «ТН ВЭД сладости.xlsx»: 230 уникальных десятизначных кодов ТН ВЭД.',
              'source', ''
            )
          ),
        true
      ) - 'externalGroups'
    ),
    updated_by = 'system-migration',
    updated_at = NOW()
WHERE id = 1;

UPDATE documents
SET title = 'Сладости и кондитерские изделия – МЗКМ (внешняя маркировка) и перечень ТН ВЭД',
    area = 'МЗКМ / внешняя маркировка',
    content = replace(
      replace(content, 'Контур: внешняя маркировка.', 'Контур: МЗКМ (внешняя маркировка).'),
      'в контуре внешней маркировки.', 'в контуре МЗКМ (внешняя маркировка).'
    ),
    description = 'Справочная карточка товарной группы МЗКМ (внешняя маркировка) с 230 уникальными десятизначными кодами ТН ВЭД по предоставленному Excel-файлу.',
    updated_by = 'system-migration',
    updated_at = NOW()
WHERE id = 'ba000000-0000-4000-8000-000000000012'::uuid;

UPDATE document_versions
SET title = 'Сладости и кондитерские изделия – МЗКМ (внешняя маркировка) и перечень ТН ВЭД',
    area = 'МЗКМ / внешняя маркировка',
    content = replace(
      replace(content, 'Контур: внешняя маркировка.', 'Контур: МЗКМ (внешняя маркировка).'),
      'в контуре внешней маркировки.', 'в контуре МЗКМ (внешняя маркировка).'
    ),
    description = 'Справочная карточка товарной группы МЗКМ (внешняя маркировка) с 230 уникальными десятизначными кодами ТН ВЭД по предоставленному Excel-файлу.'
WHERE document_id = 'ba000000-0000-4000-8000-000000000012'::uuid;
