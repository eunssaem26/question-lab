import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CATEGORIES = new Set([
  'origin',
  'vibelog',
  'devlog',
  'philosophy',
  'character',
  'insight',
  'support',
  'cardnews',
]);

function unquote(value) {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2
    && ((trimmed.startsWith('"') && trimmed.endsWith('"'))
      || (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;

  const data = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/);
    if (field) data[field[1]] = unquote(field[2]);
  }
  return { data, body: match[2] };
}

function isCalendarDate(value) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

export function validateDraft(content, { existingSeriesNumbers = [] } = {}) {
  const parsed = parseFrontmatter(content);
  if (!parsed) return ['frontmatter가 없거나 --- 경계가 올바르지 않음'];

  const { data, body } = parsed;
  const errors = [];
  for (const field of ['title', 'description', 'pubDate', 'heroImage', 'author', 'category', 'tags', 'status']) {
    if (!data[field]) errors.push(`필수 frontmatter 누락: ${field}`);
  }

  if (data.author && data.author !== '필로') errors.push('author는 "필로"여야 함');
  if (data.status && data.status !== 'draft') errors.push('status는 "draft"여야 함');
  if (data.category && !CATEGORIES.has(data.category)) errors.push(`허용되지 않은 category: ${data.category}`);
  if (data.pubDate && !/^\d{4}-\d{2}-\d{2}$/.test(data.pubDate)) {
    errors.push('pubDate는 YYYY-MM-DD 형식이어야 함');
  } else if (data.pubDate && !isCalendarDate(data.pubDate)) {
    errors.push('pubDate가 실제 날짜가 아님');
  }
  if (data.tags && !/^\[.*\]$/.test(data.tags)) errors.push('tags는 YAML 배열 형식이어야 함');
  if (!body.trim()) errors.push('본문이 비어 있음');

  if (data.category === 'devlog') {
    if (data.series !== '생각하는 글밭 개발일지') errors.push('개발일지 series가 올바르지 않음');
    const seriesNumber = Number(data.seriesNumber);
    if (!Number.isInteger(seriesNumber) || seriesNumber < 1) {
      errors.push('개발일지 seriesNumber는 1 이상의 정수여야 함');
    } else if (existingSeriesNumbers.includes(seriesNumber)) {
      errors.push(`seriesNumber 중복: ${seriesNumber}`);
    } else if (existingSeriesNumbers.length > 0) {
      const nextNumber = Math.max(...existingSeriesNumbers) + 1;
      if (seriesNumber !== nextNumber) errors.push(`개발일지 다음 번호 ${nextNumber}을 사용해야 함`);
    }
  } else if (data.series && !Number.isInteger(Number(data.seriesNumber))) {
    errors.push('series가 있으면 seriesNumber가 필요함');
  }

  const bodyLines = body.split(/\r?\n/);
  const invalidDash = bodyLines.find((line) => line.includes('—') && !/^\s*—\s+\S/.test(line));
  if (invalidDash) errors.push('본문 em dash(—) 금지');
  if (/[가-힣]\s*\([A-Za-z][^)]*\)/.test(body)) errors.push('한글+(English) 병기 금지');
  if (/—\s*필로|필로.*생각하는 글밭 코디네이터/.test(body)) errors.push('말미 시그니처 금지');
  if (/이것이 .*인 이유입니다|정리하면 이렇습니다|결론적으로/.test(body)) errors.push('금지된 결말·정리 표현 사용');
  const boldCount = body.match(/\*\*[^*\n]+\*\*/g)?.length ?? 0;
  if (boldCount > 2) errors.push(`bold 강조 과다: ${boldCount}회`);

  return errors;
}

function existingDevlogNumbers(blogDir, draftPath) {
  const numbers = [];
  for (const name of readdirSync(blogDir)) {
    if (!/\.mdx?$/.test(name)) continue;
    const path = resolve(blogDir, name);
    if (path === draftPath) continue;
    const content = readFileSync(path, 'utf8');
    if (!/^category:\s*["']?devlog["']?\s*$/m.test(content)) continue;
    const match = content.match(/^seriesNumber:\s*(\d+)\s*$/m);
    if (match) numbers.push(Number(match[1]));
  }
  return numbers;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  const draftPath = process.argv[2] ? resolve(process.argv[2]) : '';
  const blogDir = process.argv[3] ? resolve(process.argv[3]) : '';
  if (!draftPath || !blogDir) {
    console.error('사용법: node validate-weekly-blog-draft.mjs <draft-path> <blog-dir>');
    process.exit(2);
  }

  const errors = validateDraft(readFileSync(draftPath, 'utf8'), {
    existingSeriesNumbers: existingDevlogNumbers(blogDir, draftPath),
  });
  if (errors.length) {
    for (const error of errors) console.error(`- ${error}`);
    process.exit(2);
  }
  console.log('초안 검증 통과');
}
