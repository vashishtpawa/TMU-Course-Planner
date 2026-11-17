import { getDocument, GlobalWorkerOptions } from './vendor/pdfjs/pdf.min.mjs';

const vendor = new URL('./vendor/pdfjs/', import.meta.url);
GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', vendor).href;

const codeAtStart = /^([A-Z]{2,8})\s*(\d{3}[A-Z]?)\b\s*/;
const termHeading = /^(Fall|Winter|Spring\s*\/\s*Summer|Spring|Summer)\s+(\d{4})$/i;
const gradeColumns = /^(.*?)\s+(\d+(?:\.\d+)?)\s+([A-Z]{1,5}[+−-]?)(?:\s+(-?\d+(?:\.\d+)?))?(?:\s+(.+))?$/;
const regularGrade = /^(?:[ABCD][+−-]?|F)$/;
const annotation = /(?:repeated(?: course)?|repeat(?:ed)? attempt|included in GPA|excluded from GPA|GPA inclusion|GPA exclusion|(?:not )?included in (?:the )?(?:cumulative )?GPA)/i;

function visualRows(items) {
  const sorted = items.filter(item => item.str?.trim()).map(item => ({
    text: item.str.trim(), x: item.transform[4], y: item.transform[5], end: item.transform[4] + item.width
  })).sort((a, b) => b.y - a.y);
  const rows = [];
  for (const item of sorted) {
    const row = rows.at(-1);
    if (row && row.y - item.y <= 2) row.parts.push(item);
    else rows.push({ y: item.y, parts: [item] });
  }
  return rows.map(row => row.parts.sort((a, b) => a.x - b.x));
}

function columnStarts(rows) {
  const positions = [];
  for (const row of rows) {
    for (const [index, part] of row.entries()) {
      const next = row[index + 1];
      const splitCode = /^[A-Z]{2,8}$/.test(part.text) && next && next.x - part.end < 12 &&
        /^\d{3}[A-Z]?$/.test(next.text);
      if (codeAtStart.test(part.text) || splitCode) positions.push(part.x);
    }
  }
  const starts = [];
  for (const x of positions.sort((a, b) => a - b)) {
    if (!starts.length || x - starts.at(-1) >= 140) starts.push(x);
  }
  return starts.slice(1).map(x => x - 10);
}

function rowText(parts) {
  return parts.map(part => part.text).join(' ').replace(/\s+/g, ' ').trim();
}

export function parseTranscript(pages) {
  const entries = [];
  let unparsed = 0;
  let previousTerms = [];
  for (const [pageIndex, items] of pages.entries()) {
    const rows = visualRows(items);
    const boundaries = columnStarts(rows);
    const columns = Array.from({ length: boundaries.length + 1 }, () => []);
    for (const row of rows) {
      for (const [index, column] of columns.entries()) {
        const parts = row.filter(part => part.x >= (boundaries[index - 1] ?? -Infinity) &&
          part.x < (boundaries[index] ?? Infinity));
        if (parts.length) column.push(rowText(parts));
      }
    }

    const terms = [];
    for (const [columnIndex, column] of columns.entries()) {
      let term = previousTerms.length === columns.length ? previousTerms[columnIndex] : null;
      let lastEntry;
      for (const line of column) {
        const heading = termHeading.exec(line);
        if (heading) {
          const season = heading[1].toLowerCase();
          term = { season: season === 'fall' ? 'Fall' : season === 'winter' ? 'Winter' : 'Summer', year: Number(heading[2]) };
          lastEntry = undefined;
          continue;
        }

        const codeMatch = codeAtStart.exec(line);
        if (!codeMatch) {
          if (lastEntry && annotation.test(line)) lastEntry.notes.push(line);
          else if (lastEntry && !/^\(?[ *]+\)?$/.test(line)) lastEntry = undefined;
          continue;
        }

        const code = `${codeMatch[1]} ${codeMatch[2]}`;
        const data = line.slice(codeMatch[0].length);
        const fields = gradeColumns.exec(data);
        const warnings = [];
        if (!term) warnings.push('Choose the term and year.');
        if (!fields) {
          unparsed++;
          warnings.push('Check the course name, credit and grade against the PDF.');
        }
        const [, name = data, credit = '', grade = '', points = '', trailing = ''] = fields ?? [];
        const regular = regularGrade.test(grade);
        const gpa = regular && points !== '' && Number(points) >= 0 && Number(points) <= 4.33 ? points : '';
        if (regular && !gpa) warnings.push('Check the grade points.');
        if (grade === 'F') warnings.push('Failed attempt.');
        else if (['W', 'WD', 'WDR', 'DRP', 'LWD'].includes(grade)) warnings.push('Withdrawn attempt.');
        else if (grade && !regular) warnings.push('Special grade. Review its status.');
        const work = /^WKT\s/i.test(code) || /\bWork Term\b/i.test(name);
        if (work) warnings.push('Possible work term.');
        lastEntry = {
          ...term, code, name, credit, grade, gpa, work, warnings, page: pageIndex + 1,
          status: grade === 'F' ? 'Failed' : regular || (work && grade === 'PSD') ? 'Completed' : 'Planned',
          notes: trailing ? [trailing] : []
        };
        entries.push(lastEntry);
      }
      terms.push(term);
    }
    previousTerms = terms;
  }

  const canonical = row => row.code.replace(/^C(?=[A-Z]{3,}\s)/, '').replace(/\s/g, '');
  const counts = new Map();
  for (const row of entries) counts.set(canonical(row), (counts.get(canonical(row)) ?? 0) + 1);
  for (const row of entries) if (counts.get(canonical(row)) > 1) row.warnings.push('Possible repeated course.');
  return { entries, unparsed };
}

export async function readTranscript(file) {
  if (file.size > 25 * 1024 * 1024) throw new Error('Choose a PDF smaller than 25 MB.');
  const data = new Uint8Array(await file.arrayBuffer());
  const task = getDocument({
    data, verbosity: 0, isEvalSupported: false, useWasm: false,
    cMapUrl: new URL('cmaps/', vendor).href, cMapPacked: true,
    standardFontDataUrl: new URL('standard_fonts/', vendor).href
  });
  try {
    const pdf = await task.promise;
    const pages = [];
    for (let index = 1; index <= pdf.numPages; index++) {
      const page = await pdf.getPage(index);
      pages.push((await page.getTextContent()).items);
      page.cleanup();
    }
    if (!pages.some(page => page.some(item => item.str?.trim()))) {
      throw new Error('This PDF has no readable text. Download a text-based transcript from TMU. Scanned PDFs need OCR.');
    }
    const result = parseTranscript(pages);
    if (!result.entries.length) {
      throw new Error('No recognizable course rows were found. Choose a text-based TMU transcript and check its format.');
    }
    return result;
  } catch (error) {
    if (error.name === 'PasswordException') throw new Error('This PDF is password-protected. Choose an unlocked copy.');
    if (error.name === 'InvalidPDFException') throw new Error('This file is not a readable PDF. Download the transcript again and retry.');
    throw error;
  } finally {
    await task.destroy();
  }
}
