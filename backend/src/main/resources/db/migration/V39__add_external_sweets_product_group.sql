-- Add the external-marking group "Сладости и кондитерские изделия".
-- The 230-code TN VED list comes from the user-provided workbook and is a classification
-- reference only; it does not independently establish mandatory marking.

UPDATE product_group_catalog
SET payload_json = jsonb_set(
    COALESCE(payload_json::jsonb, '{}'::jsonb),
    '{externalGroups}',
    COALESCE(payload_json::jsonb->'externalGroups', '[]'::jsonb)
      || '[{"name":"Сладости и кондитерские изделия","description":"Товарная группа внешней маркировки. Справочный перечень сформирован по предоставленному Excel-файлу «ТН ВЭД сладости.xlsx»: 230 уникальных десятизначных кодов ТН ВЭД. Наличие кода в справочнике само по себе не подтверждает обязательность маркировки; применимость проверяется по правилам страны назначения и действующим нормативным актам.","source":""}]'::jsonb,
    true
),
updated_by = 'system-migration',
updated_at = NOW()
WHERE id = 1
  AND NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements(COALESCE(payload_json::jsonb->'externalGroups', '[]'::jsonb)) item
      WHERE item->>'name' = 'Сладости и кондитерские изделия'
  );

INSERT INTO documents (
 id,title,jurisdiction,kind,area,product_group,keywords,document_number,
 document_date,effective_from,effective_until,source_url,description,content,status,
 official_source_checked_at,source_check_note,created_by,updated_by,created_at,updated_at,version_number
) VALUES (
 'ba000000-0000-4000-8000-000000000012'::uuid,
 'Сладости и кондитерские изделия – внешняя маркировка и перечень ТН ВЭД',
 'KG','Товарная группа','Внешняя маркировка / сладости и кондитерские изделия','Сладости и кондитерские изделия',
 'сладости, кондитерские изделия, ТН ВЭД, внешняя маркировка, шоколад, сахаристые изделия, сладкие продукты',
 'ТН ВЭД сладости.xlsx – перечень, предоставленный пользователем',
 NULL,NULL,NULL,NULL,
 'Справочная карточка внешней товарной группы с 230 уникальными десятизначными кодами ТН ВЭД по предоставленному Excel-файлу.',
 'КАРТОЧКА ТОВАРНОЙ ГРУППЫ: СЛАДОСТИ И КОНДИТЕРСКИЕ ИЗДЕЛИЯ

Контур: внешняя маркировка.

Источник перечня: файл «ТН ВЭД сладости.xlsx», предоставленный пользователем.

В справочник TEKSHER HUB добавлены 230 уникальных десятизначных кодов ТН ВЭД с наименованиями товаров. Перечень включает позиции разделов ТН ВЭД 1704, 1806, 1905, 2006, 2007, 2008 и 2106. Коды доступны для поиска в общем справочнике и отнесены к группе «Сладости и кондитерские изделия» в контуре внешней маркировки.

ОГРАНИЧЕНИЕ ПРИМЕНЕНИЯ

Наличие кода в пользовательском классификационном перечне не является самостоятельным подтверждением обязательности маркировки. Для вывода о применимости необходимо установить страну назначения, точное описание товара, дату и проверить действующие нормативные акты и правила соответствующей системы маркировки.

Статус карточки: справочная запись по пользовательскому Excel-файлу; юридическая применимость требует отдельной проверки.',
 'UNDER_REVIEW',NULL,
 'Сформировано по предоставленному пользователем Excel. Официальный нормативный источник и обязательность маркировки не подтверждены этим файлом.',
 'system-migration','system-migration',NOW(),NOW(),1
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO document_versions (
 document_id,version_number,title,jurisdiction,kind,area,product_group,keywords,
 document_number,document_date,effective_from,effective_until,source_url,description,content,status,
 related_document_ids,change_note,changed_by,created_at
)
SELECT d.id,d.version_number,d.title,d.jurisdiction,d.kind,d.area,d.product_group,d.keywords,
 d.document_number,d.document_date,d.effective_from,d.effective_until,d.source_url,d.description,d.content,d.status,
 '', 'Первичное добавление внешней товарной группы «Сладости и кондитерские изделия» по предоставленному Excel-файлу.',
 'system-migration',NOW()
FROM documents d
WHERE d.id='ba000000-0000-4000-8000-000000000012'::uuid
ON CONFLICT (document_id,version_number) DO NOTHING;
