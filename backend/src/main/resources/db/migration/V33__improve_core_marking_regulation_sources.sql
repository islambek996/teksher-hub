-- Improve official source links in the seeded catalogue and add the core Russian marking rules for specialist review.
-- New/legal reference records remain UNDER_REVIEW until a specialist verifies the current consolidated text and applicability.
UPDATE documents
SET source_url = 'https://cbd.minjust.gov.kg/7-42968/edition/34256/ru',
    description = 'Официальная карточка постановления в Централизованном банке данных правовой информации Минюста КР. Перед использованием проверьте редакцию, последующие изменения, приложения и действующую сферу применения учётно-контрольных марок.',
    source_check_note = 'Ссылка заменена на карточку нормативного акта в официальной правовой базе. Текущая редакция и применимость должны быть подтверждены специалистом.',
    status = 'UNDER_REVIEW',
    updated_by = 'system-migration',
    updated_at = NOW()
WHERE id = 'a1000000-0000-4000-8000-000000000004';

UPDATE documents
SET source_url = 'https://docs.eaeunion.org/',
    description = 'Базовое соглашение ЕАЭС, формирующее правовую основу маркировки товаров средствами идентификации. Ссылка ведёт на официальный правовой портал ЕАЭС; найдите документ по полному названию и дате 02.02.2018, затем проверьте действующую редакцию и связанные решения Совета ЕЭК.',
    source_check_note = 'Ссылка на годовой отчёт заменена на официальный правовой портал ЕАЭС. До подтверждения точного текста и актуальной редакции материал остаётся на проверке.',
    status = 'UNDER_REVIEW',
    updated_by = 'system-migration',
    updated_at = NOW()
WHERE id = 'a1000000-0000-4000-8000-000000000007';

INSERT INTO documents (
  id, title, jurisdiction, kind, area, product_group, keywords, document_number,
  document_date, source_url, description, status, source_check_note,
  created_by, updated_by, created_at, updated_at, version_number
)
SELECT
  'a1000000-0000-4000-8000-000000000032',
  'Постановление Правительства Российской Федерации от 26 апреля 2019 года № 515 «О системе маркировки товаров средствами идентификации»',
  'RU',
  'Нормативный акт',
  'Общие правила маркировки РФ',
  'Внешняя маркировка',
  'маркировка товаров; средства идентификации; оператор; участники оборота; постановление 515; РФ',
  '№ 515',
  DATE '2019-04-26',
  'https://publication.pravo.gov.ru/search',
  'Базовый акт о системе маркировки товаров средствами идентификации в Российской Федерации. Ссылка ведёт на официальный портал опубликования: найдите акт по номеру и дате, проверьте последующие изменения и актуальный консолидированный текст. До завершения проверки не используйте карточку как подтверждение конкретных сроков или обязанностей товарной группы.',
  'UNDER_REVIEW',
  'Добавлена ссылка на официальный портал опубликования. Требуется найти точную публикацию, сверить редакцию и связанные специальные правила до перевода в статус «Действует».',
  'catalog-import',
  'system-migration',
  NOW(),
  NOW(),
  1
WHERE NOT EXISTS (
  SELECT 1 FROM documents
  WHERE jurisdiction = 'RU'
    AND document_number = '№ 515'
    AND title ILIKE '%Постановление Правительства Российской Федерации%'
);
