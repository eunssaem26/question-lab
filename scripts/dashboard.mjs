#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const PROJECT_ROOT = '/Users/eunssaem/Desktop/open claw 준비'
const VAULT_PATH = '/Users/eunssaem/Documents/Obsidian Vault'
const DASHBOARD_DIR = path.join(VAULT_PATH, '70. Outputs', 'Dashboards')
const DASHBOARD_PATH = path.join(DASHBOARD_DIR, '생각하는 글밭 운영 현황판.md')

const STATIC_START = '<!-- DASHBOARD:STATIC:START -->'
const STATIC_END = '<!-- DASHBOARD:STATIC:END -->'

const DEFAULT_STATIC = `${STATIC_START}
## 메모 / 진행 중
- (자유 기재 — 이 영역은 스크립트가 덮어쓰지 않음)

## 외부 자산 (스크립트로 안 잡힘)
- 수노 곡: 테마곡 1 + 캐릭터 30초 소개곡 6편
- 캐릭터: 7명 (필로, 은쌤, 별쌤, 글쌤, 호기, 깐쌤, 책쌤)
${STATIC_END}`

const sh = (cmd) => execSync(cmd, { cwd: PROJECT_ROOT, encoding: 'utf-8' }).trim()

function safeJsonCount(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(raw)
    if (Array.isArray(data)) return data.length
    if (Array.isArray(data.items)) return data.items.length
    if (Array.isArray(data.passages)) return data.passages.length
    return 0
  } catch {
    return 0
  }
}

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---/)
  if (!m) return {}
  const fm = {}
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([\w-]+):\s*(.*)$/)
    if (!kv) continue
    let v = kv[2].trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    fm[kv[1]] = v
  }
  return fm
}

function collectItemBank() {
  const reading = []
  for (let i = 1; i <= 7; i++) {
    const p = path.join(PROJECT_ROOT, 'item-bank', `level-${i}`, 'items.json')
    reading.push({ level: i, count: safeJsonCount(p) })
  }
  const writing = []
  for (let i = 1; i <= 7; i++) {
    const p = path.join(PROJECT_ROOT, 'item-bank', 'writing', `level-${i}`, 'items.json')
    writing.push({ level: i, count: safeJsonCount(p) })
  }
  let passages = safeJsonCount(path.join(PROJECT_ROOT, 'item-bank', 'passages.json'))
  for (let i = 1; i <= 7; i++) {
    passages += safeJsonCount(path.join(PROJECT_ROOT, 'item-bank', `level-${i}`, 'passages.json'))
  }
  return {
    reading,
    writing,
    passages,
    readingTotal: reading.reduce((s, r) => s + r.count, 0),
    writingTotal: writing.reduce((s, r) => s + r.count, 0),
  }
}

function collectBlog() {
  const dir = path.join(PROJECT_ROOT, 'site', 'src', 'content', 'blog')
  if (!fs.existsSync(dir)) return { total: 0, byCategory: {}, byStatus: {}, recent: [] }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.md') || f.endsWith('.mdx'))
  const posts = files.map((f) => {
    const fm = parseFrontmatter(fs.readFileSync(path.join(dir, f), 'utf-8'))
    return {
      file: f,
      title: fm.title || f,
      date: fm.pubDate || '',
      category: fm.category || 'uncategorized',
      status: fm.status || 'published',
    }
  })
  const byCategory = {}
  const byStatus = {}
  for (const p of posts) {
    byCategory[p.category] = (byCategory[p.category] || 0) + 1
    byStatus[p.status] = (byStatus[p.status] || 0) + 1
  }
  const recent = [...posts]
    .filter((p) => p.date)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)
  return { total: posts.length, byCategory, byStatus, recent }
}

function collectCardnews() {
  const dir = path.join(PROJECT_ROOT, 'site', 'dist', 'cardnews')
  if (!fs.existsSync(dir)) return { episodes: 0, files: [] }
  const files = fs.readdirSync(dir).filter((f) => /^\d{2}\.html$/.test(f))
  return { episodes: files.length, files: files.sort() }
}

function collectCharacters() {
  const dir = path.join(PROJECT_ROOT, 'site', 'src', 'assets', 'characters')
  if (!fs.existsSync(dir)) return { total: 0, clay: 0, profile: 0, scene: 0, names: [] }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.png'))
  const clay = files.filter((f) => f.endsWith('_clay.png'))
  const profile = files.filter((f) => f.endsWith('_profile_slack.png'))
  const scene = files.length - clay.length - profile.length
  const names = [...new Set(clay.map((f) => f.replace('_clay.png', '')))].sort()
  return { total: files.length, clay: clay.length, profile: profile.length, scene, names }
}

function collectVideos() {
  const dir = path.join(PROJECT_ROOT, 'video', 'out')
  if (!fs.existsSync(dir)) return { videos: [], totalMB: 0 }
  const files = fs.readdirSync(dir).filter((f) => /\.(mp4|mov|webm)$/i.test(f))
  const videos = files
    .map((f) => {
      const sizeMB = +(fs.statSync(path.join(dir, f)).size / 1024 / 1024).toFixed(1)
      return { name: f, sizeMB }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  const totalMB = +videos.reduce((s, v) => s + v.sizeMB, 0).toFixed(1)
  return { videos, totalMB }
}

function collectVault() {
  const dir = path.join(PROJECT_ROOT, '생각하는 글밭')
  if (!fs.existsSync(dir)) return { total: 0, recentWeek: 0 }
  let total = 0
  let recentWeek = 0
  const weekAgoMs = Date.now() - 7 * 24 * 60 * 60 * 1000
  const walk = (d) => {
    let entries
    try {
      entries = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue
      const full = path.join(d, e.name)
      if (e.isDirectory()) walk(full)
      else if (e.isFile() && e.name.endsWith('.md')) {
        total++
        try {
          if (fs.statSync(full).mtimeMs > weekAgoMs) recentWeek++
        } catch {}
      }
    }
  }
  walk(dir)
  return { total, recentWeek }
}

function collectGit() {
  const last7 = +sh('git log --since="7 days ago" --oneline | wc -l').trim()
  const last30 = +sh('git log --since="30 days ago" --oneline | wc -l').trim()
  const lastCommitRel = sh('git log -1 --pretty=format:"%cr"')
  const lastCommitAbs = sh('git log -1 --pretty=format:"%cd" --date=format:"%Y-%m-%d %H:%M"')
  const recent = sh('git log -5 --pretty=format:"%cd|%s" --date=format:"%Y-%m-%d"')
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const [date, ...rest] = l.split('|')
      return { date, subject: rest.join('|') }
    })
  return { last7, last30, lastCommitRel, lastCommitAbs, recent }
}

function nowStamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function renderMarkdown(data) {
  const { itemBank, blog, cardnews, characters, videos, vault, git } = data
  const readingRow = itemBank.reading.map((r) => `L${r.level}: ${r.count}`).join(' · ')
  const writingRow = itemBank.writing.map((r) => `L${r.level}: ${r.count}`).join(' · ')
  const totalItems = itemBank.readingTotal + itemBank.writingTotal
  const blogCats = Object.entries(blog.byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${v}`)
    .join(' · ')
  const blogStatus = Object.entries(blog.byStatus)
    .map(([k, v]) => `${k} ${v}`)
    .join(' · ')
  const recentBlog =
    blog.recent.map((p) => `- ${p.date} · ${p.title} _(${p.category})_`).join('\n') || '- (없음)'
  const videoList =
    videos.videos.map((v) => `- ${v.name} (${v.sizeMB}MB)`).join('\n') || '- (없음)'
  const recentCommits = git.recent.map((c) => `- ${c.date} · ${c.subject}`).join('\n')

  return `# 생각하는 글밭 운영 현황판
> 마지막 갱신: ${nowStamp()} · \`node scripts/dashboard.mjs\`

## 한눈에
- 📚 문제은행 **${totalItems}문항** (읽기 ${itemBank.readingTotal} / 글쓰기 ${itemBank.writingTotal}) + 지문 ${itemBank.passages}
- ✍️ 블로그 **${blog.total}편** · 카드뉴스 **${cardnews.episodes}회차** · 영상 **${videos.videos.length}편**
- 🎨 캐릭터 자산 **${characters.total}장** · 등장 인물 ${characters.names.length}명
- 🗂 옵시디언 노트 **${vault.total}개** (최근 7일 수정 ${vault.recentWeek})
- 🔨 Git 최근 7일 **${git.last7}커밋** / 30일 ${git.last30}커밋 · 마지막 커밋 ${git.lastCommitRel}

## 문제은행
**읽기** · ${readingRow} · 합계 **${itemBank.readingTotal}**
**글쓰기** · ${writingRow} · 합계 **${itemBank.writingTotal}**
**지문** · ${itemBank.passages}

| 영역 | L1 | L2 | L3 | L4 | L5 | L6 | L7 | 합계 |
| --- | --: | --: | --: | --: | --: | --: | --: | --: |
| 읽기 | ${itemBank.reading.map((r) => r.count).join(' | ')} | **${itemBank.readingTotal}** |
| 글쓰기 | ${itemBank.writing.map((r) => r.count).join(' | ')} | **${itemBank.writingTotal}** |

## 블로그
총 **${blog.total}편** · 카테고리: ${blogCats} · 상태: ${blogStatus}

**최근 발행 5건**
${recentBlog}

## 카드뉴스 & 영상
- 카드뉴스 회차: **${cardnews.episodes}** (${cardnews.files.join(', ')})
- 영상 출력: **${videos.videos.length}편** · 총 ${videos.totalMB}MB
${videoList}

## 캐릭터 & 미디어
- 캐릭터 PNG 총 **${characters.total}장**
  - 클레이 ${characters.clay} · 프로필(슬랙) ${characters.profile} · 씬/배경 ${characters.scene}
- 등장 인물 (${characters.names.length}): ${characters.names.join(', ')}

## Git 활동
- 최근 7일: **${git.last7}커밋** · 30일: ${git.last30}커밋
- 마지막 커밋: ${git.lastCommitAbs} (${git.lastCommitRel})

**최근 5개 커밋**
${recentCommits}

`
}

function extractStaticBlock(existing) {
  const startIdx = existing.indexOf(STATIC_START)
  const endIdx = existing.indexOf(STATIC_END)
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) return null
  return existing.slice(startIdx, endIdx + STATIC_END.length)
}

function writeDashboard(dynamicMd) {
  fs.mkdirSync(DASHBOARD_DIR, { recursive: true })
  let staticBlock = DEFAULT_STATIC
  if (fs.existsSync(DASHBOARD_PATH)) {
    const existing = fs.readFileSync(DASHBOARD_PATH, 'utf-8')
    const preserved = extractStaticBlock(existing)
    if (preserved) staticBlock = preserved
  }
  fs.writeFileSync(DASHBOARD_PATH, dynamicMd + staticBlock + '\n')
}

function main() {
  const data = {
    itemBank: collectItemBank(),
    blog: collectBlog(),
    cardnews: collectCardnews(),
    characters: collectCharacters(),
    videos: collectVideos(),
    vault: collectVault(),
    git: collectGit(),
  }
  const md = renderMarkdown(data)
  writeDashboard(md)
  console.log(`✓ 대쉬보드 갱신: ${DASHBOARD_PATH}`)
  console.log(
    `  문제 ${data.itemBank.readingTotal + data.itemBank.writingTotal} · 블로그 ${data.blog.total} · 카드뉴스 ${data.cardnews.episodes} · 영상 ${data.videos.videos.length} · 노트 ${data.vault.total}`
  )
}

main()
