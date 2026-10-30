-- Add Bakaleia to the persistent product-group catalogue and create its knowledge card.
-- The TN VED list is sourced from the user-provided workbook; inclusion is informational
-- and does not itself determine mandatory marking.

INSERT INTO product_group_catalog (id, payload_json, updated_by, updated_at)
VALUES (
  1,
  '{"mzkmGroups":["Обувные товары","Белье постельное, столовое, туалетное и кухонное","Предметы одежды","Духи и туалетная вода","Фотокамеры (кроме кинокамер), фотовспышки и лампы-вспышки","Молочная продукция","Продукты, используемые для кормления животных","Косметика, бытовая химия и товары личной гигиены","Моторные масла, смазочные материалы, тормозные жидкости и антифризы","Игры и игрушки для детей","Бакалея"],"internalGroups":[{"name":"Алкоголь","description":"Национальная внутренняя маркировка Кыргызской Республики. Применимость и способ маркировки проверять по действующим актам КР и официальным методическим правилам.","source":"https://main.teksher.kg/internal-marking.html"},{"name":"Табак","description":"Национальная внутренняя маркировка Кыргызской Республики. Для конкретного вида продукции проверять действующие требования и методические правила.","source":"https://main.teksher.kg/internal-marking.html"}],"mzkmDetails":{"Бакалея":{"description":"Товарная группа МЗКМ «Бакалея». Справочный перечень ТН ВЭД сформирован по предоставленному пользователем файлу «ТН ВЭД баккалея.xlsx»: 118 уникальных десятизначных кодов. В исходном файле отдельно выделена подгруппа «Бакалея – Растворимые завариваемые напитки». Наличие кода в справочнике не является самостоятельным подтверждением обязательности маркировки; применимость проверяется по действующим нормативным актам и правилам оператора.","source":""}}}',
  'system-migration',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  payload_json = (
    SELECT jsonb_set(
      jsonb_set(
        COALESCE(product_group_catalog.payload_json::jsonb, '{}'::jsonb),
        '{mzkmGroups}',
        (
          SELECT to_jsonb(ARRAY(
            SELECT DISTINCT value
            FROM (
              SELECT jsonb_array_elements_text(COALESCE(product_group_catalog.payload_json::jsonb->'mzkmGroups','[]'::jsonb)) AS value
              UNION ALL SELECT 'Бакалея'
            ) groups_list
            ORDER BY value
          ))
        ),
        true
      ),
      '{mzkmDetails}',
      COALESCE(product_group_catalog.payload_json::jsonb->'mzkmDetails','{}'::jsonb)
        || '{"Бакалея":{"description":"Товарная группа МЗКМ «Бакалея». Справочный перечень ТН ВЭД сформирован по предоставленному пользователем файлу «ТН ВЭД баккалея.xlsx»: 118 уникальных десятизначных кодов. В исходном файле отдельно выделена подгруппа «Бакалея – Растворимые завариваемые напитки». Наличие кода в справочнике не является самостоятельным подтверждением обязательности маркировки; применимость проверяется по действующим нормативным актам и правилам оператора.","source":""}}'::jsonb,
      true
    )::text
  ),
  updated_by = 'system-migration',
  updated_at = NOW();

INSERT INTO documents (
 id,title,jurisdiction,kind,area,product_group,keywords,document_number,
 document_date,effective_from,effective_until,source_url,description,content,status,
 official_source_checked_at,source_check_note,created_by,updated_by,created_at,updated_at,version_number
) VALUES (
 'ba000000-0000-4000-8000-000000000011'::uuid,
 'Бакалея – товарная группа МЗКМ и перечень ТН ВЭД',
 'KG','Товарная группа','МЗКМ / бакалея','Бакалея',
 'бакалея, ТН ВЭД, растворимые завариваемые напитки, коды товаров, МЗКМ',
 'ТН ВЭД баккалея.xlsx – перечень, предоставленный пользователем',
 NULL,NULL,NULL,NULL,
 'Карточка товарной группы «Бакалея» с перечнем из 118 уникальных кодов ТН ВЭД по предоставленному Excel-файлу. В исходном файле выделена подгруппа «Бакалея – Растворимые завариваемые напитки».',
 'КАРТОЧКА ТОВАРНОЙ ГРУППЫ: БАКАЛЕЯ

Источник перечня: файл «ТН ВЭД баккалея.xlsx», предоставленный пользователем.

В справочник ТН ВЭД TEKSHER HUB добавлены 118 уникальных десятизначных кодов из двух листов Excel. Второй лист содержит подгруппу «Бакалея – Растворимые завариваемые напитки». Коды и наименования товаров доступны для поиска в общем справочнике ТН ВЭД; группа «Бакалея» отображается в каталоге товарных групп МЗКМ.

Важно: включение кода в справочник является информационной классификацией по предоставленному файлу и не подтверждает само по себе обязательность маркировки конкретного товара. Перед применением необходимо сверять точный код, описание товара, действующие нормативные акты и правила оператора.

Состав карточки: товарная группа – «Бакалея»; источник кодового перечня – пользовательский Excel; количество записей – 118; исходная подгруппа – «Бакалея – Растворимые завариваемые напитки».',
 'UNDER_REVIEW',NULL,
 'Карточка создана по предоставленному пользователем Excel. Юридическая применимость перечня и обязательность маркировки требуют отдельной проверки.',
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
 '', 'Первичное добавление карточки товарной группы «Бакалея» по предоставленному Excel-файлу.',
 'system-migration',NOW()
FROM documents d
WHERE d.id='ba000000-0000-4000-8000-000000000011'::uuid
ON CONFLICT (document_id,version_number) DO NOTHING;
