// Generated from the user-provided "Список ТН ВЭД.xlsx".
// The compressed payload is split into source text chunks to keep edits/reviews manageable.
// Presence in this list is not a legal determination of mandatory marking.
import part01a from './tnved-parts/01a.txt?raw'
import part01b from './tnved-parts/01b.txt?raw'
import part02 from './tnved-parts/02.txt?raw'
import part03 from './tnved-parts/03.txt?raw'
import part04 from './tnved-parts/04.txt?raw'
import part05 from './tnved-parts/05.txt?raw'
import part06 from './tnved-parts/06.txt?raw'
import part07 from './tnved-parts/07.txt?raw'
import part08 from './tnved-parts/08.txt?raw'
import part09 from './tnved-parts/09.txt?raw'
import bakaleiaPart from './tnved-parts/bakaleia.txt?raw'

export const TNVED_CATALOG_GZIP_BASE64 = [
  part01a,
  part01b,
  part02,
  part03,
  part04,
  part05,
  part06,
  part07,
  part08,
  part09
].map(part => part.trim()).join('');

export async function loadTnvedCatalog() {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('Этот браузер не поддерживает распаковку справочника. Обновите браузер.');
  }
  const binary = atob(TNVED_CATALOG_GZIP_BASE64);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const rows = JSON.parse(await new Response(stream).text());
  const extraBinary = atob(bakaleiaPart.trim());
  const extraBytes = Uint8Array.from(extraBinary, character => character.charCodeAt(0));
  const extraStream = new Blob([extraBytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const bakaleiaRows = JSON.parse(await new Response(extraStream).text());
  return [...rows, ...bakaleiaRows];
}
