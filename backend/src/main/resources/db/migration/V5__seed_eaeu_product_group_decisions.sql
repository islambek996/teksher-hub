-- Additional EAEU decisions by product group. Current validity remains pending legal review.
INSERT INTO documents (
 id,title,jurisdiction,kind,area,product_group,keywords,document_number,document_date,source_url,
 description,status,created_by,updated_by,created_at,updated_at,version_number
) VALUES
('a1000000-0000-4000-8000-000000000014','Решение Совета ЕЭК от 18 ноября 2019 года № 127 «О введении маркировки товаров легкой промышленности средствами идентификации»','EAEU','Нормативный акт','Маркировка лёгкой промышленности','Одежда и лёгкая промышленность','одежда; лёгкая промышленность; средства идентификации','№ 127','2019-11-18','https://eec.eaeunion.org/upload/medialibrary/66c/43.-TSifrovaya-markirovka-tovarov.pdf','Наднациональное решение о маркировке отдельных товаров лёгкой промышленности. Сверить перечень кодов и актуальную редакцию перед применением.','UNDER_REVIEW','catalog-import','catalog-import',NOW(),NOW(),1),
('a1000000-0000-4000-8000-000000000015','Решение Совета ЕЭК от 18 ноября 2019 года № 129 «О введении маркировки шин и покрышек пневматических резиновых новых средствами идентификации»','EAEU','Нормативный акт','Маркировка шин','Шины и покрышки','шины; покрышки; пневматические; маркировка','№ 129','2019-11-18','https://eec.eaeunion.org/upload/medialibrary/66c/43.-TSifrovaya-markirovka-tovarov.pdf','Решение ЕЭК для шин и новых пневматических резиновых покрышек. Национальные процедуры и сроки уточняются по законодательству соответствующего государства.','UNDER_REVIEW','catalog-import','catalog-import',NOW(),NOW(),1),
('a1000000-0000-4000-8000-000000000016','Решение Совета ЕЭК от 18 ноября 2019 года № 130 «О введении маркировки фотокамер, фотовспышек и ламп-вспышек средствами идентификации»','EAEU','Нормативный акт','Маркировка фотооборудования','Фотоаппараты и вспышки','фотокамеры; фотовспышки; лампы-вспышки','№ 130','2019-11-18','https://eec.eaeunion.org/upload/medialibrary/66c/43.-TSifrovaya-markirovka-tovarov.pdf','Решение ЕЭК по отдельным категориям фотооборудования. Сверить исключения, товарные коды и актуальную редакцию.','UNDER_REVIEW','catalog-import','catalog-import',NOW(),NOW(),1),
('a1000000-0000-4000-8000-000000000017','Решение Совета ЕЭК от 29 октября 2021 года № 113 «О введении маркировки упакованной воды средствами идентификации»','EAEU','Нормативный акт','Маркировка упакованной воды','Упакованная вода','вода; упакованная вода; средства идентификации','№ 113','2021-10-29','https://eec.eaeunion.org/upload/medialibrary/66c/43.-TSifrovaya-markirovka-tovarov.pdf','Наднациональное решение по упакованной воде. Для Кыргызской Республики отдельно проверить национальный порядок и учетно-контрольные марки, если они применимы к конкретному товару.','UNDER_REVIEW','catalog-import','catalog-import',NOW(),NOW(),1),
('a1000000-0000-4000-8000-000000000018','Решение Совета ЕЭК от 23 декабря 2020 года № 129 «О введении маркировки отдельных видов молочной продукции средствами идентификации»','EAEU','Нормативный акт','Маркировка молочной продукции','Молочная продукция','молочная продукция; маркировка; идентификация','№ 129 от 23.12.2020','2020-12-23','https://eec.eaeunion.org/upload/medialibrary/66c/43.-TSifrovaya-markirovka-tovarov.pdf','Решение ЕЭК по отдельным видам молочной продукции. Необходимо проверять точный перечень товаров и национальные сроки применения.','UNDER_REVIEW','catalog-import','catalog-import',NOW(),NOW(),1),
('a1000000-0000-4000-8000-000000000019','Решение Совета ЕЭК от 23 апреля 2021 года № 44 «О маркировке табачной продукции средствами идентификации»','EAEU','Нормативный акт','Маркировка табачной продукции','Табачная продукция','табак; сигареты; средства идентификации; национальные правила','№ 44','2021-04-23','https://eec.eaeunion.org/upload/medialibrary/66c/43.-TSifrovaya-markirovka-tovarov.pdf','Решение ЕЭК по маркировке табачной продукции с учетом национального законодательства государств-членов. Проверить актуальные требования для конкретной продукции.','UNDER_REVIEW','catalog-import','catalog-import',NOW(),NOW(),1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO document_versions (
 document_id,version_number,title,jurisdiction,kind,area,product_group,keywords,document_number,
 document_date,source_url,description,status,related_document_ids,change_note,changed_by,created_at
)
SELECT id,version_number,title,jurisdiction,kind,area,product_group,keywords,document_number,
       document_date,source_url,description,status,'',
       'Первичное добавление решения ЕЭК по товарной группе; требуется юридическая проверка',
       'catalog-import',NOW()
FROM documents
WHERE id IN (
 'a1000000-0000-4000-8000-000000000014',
 'a1000000-0000-4000-8000-000000000015',
 'a1000000-0000-4000-8000-000000000016',
 'a1000000-0000-4000-8000-000000000017',
 'a1000000-0000-4000-8000-000000000018',
 'a1000000-0000-4000-8000-000000000019'
)
ON CONFLICT (document_id,version_number) DO NOTHING;
