import assert from 'node:assert/strict';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import test from 'node:test';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(scriptsDir, 'weekly-blog.sh');

function runAutomation(fakeClaudeBody, extraEnv = {}, setup = () => {}) {
  const root = mkdtempSync(join(tmpdir(), '주간 블로그 test '));
  const project = join(root, '생각하는 글밭 project');
  const blogDir = join(project, 'site/src/content/blog');
  const parApp = join(root, '독서후플레이 app');
  const fakeClaude = join(root, 'fake-claude.zsh');
  const log = join(root, 'weekly-blog.log');
  const status = join(root, 'weekly-blog.status');

  mkdirSync(join(project, '.git'), { recursive: true });
  mkdirSync(blogDir, { recursive: true });
  mkdirSync(join(parApp, '.git'), { recursive: true });
  writeFileSync(fakeClaude, `#!/bin/zsh\n${fakeClaudeBody}\n`);
  chmodSync(fakeClaude, 0o755);
  setup({ root, project, blogDir, parApp, log, status });

  const result = spawnSync('/bin/zsh', [scriptPath], {
    encoding: 'utf8',
    env: {
      ...process.env,
      WEEKLY_BLOG_PROJECT: project,
      WEEKLY_BLOG_PAR_APP: parApp,
      WEEKLY_BLOG_CLAUDE: fakeClaude,
      WEEKLY_BLOG_LOG: log,
      WEEKLY_BLOG_STATUS: status,
      WEEKLY_BLOG_NOTIFY: '0',
      WEEKLY_BLOG_TEST_BLOGDIR: blogDir,
      WEEKLY_BLOG_VALIDATOR: join(scriptsDir, 'validate-weekly-blog-draft.mjs'),
      ...extraEnv,
    },
    timeout: 10_000,
  });

  const output = {
    ...result,
    statusText: readFileSync(status, 'utf8').trim(),
    logText: readFileSync(log, 'utf8'),
    blogFiles: readdirSync(blogDir),
    rejectedFiles: existsSync(join(project, 'archive/blog-drafts/rejected'))
      ? readdirSync(join(project, 'archive/blog-drafts/rejected'))
      : [],
  };
  rmSync(root, { recursive: true, force: true });
  return output;
}

test('automation paths can be isolated with environment overrides', () => {
  const source = readFileSync(scriptPath, 'utf8');

  for (const name of [
    'WEEKLY_BLOG_PROJECT',
    'WEEKLY_BLOG_PAR_APP',
    'WEEKLY_BLOG_CLAUDE',
    'WEEKLY_BLOG_LOG',
    'WEEKLY_BLOG_STATUS',
  ]) {
    assert.match(source, new RegExp(`\\$\\{${name}:-`), `${name} override is required`);
  }
});

test('desktop notifications can be disabled for non-interactive verification', () => {
  const source = readFileSync(scriptPath, 'utf8');

  assert.match(source, /WEEKLY_BLOG_NOTIFY/, 'notification toggle is required');
});

test('Claude failure propagates a non-zero scheduler exit', () => {
  const result = runAutomation('print -r -- "transport failed"\nexit 7');

  assert.notEqual(result.status, 0);
  assert.match(result.statusText, /실패.*claude 종료코드 7/);
});

test('an ambiguous mention of no material is not accepted as a normal skip', () => {
  const result = runAutomation('print -r -- "글감 없음 판단은 하지 못했습니다"\nexit 0');

  assert.notEqual(result.status, 0);
  assert.match(result.statusText, /확인필요/);
});

test('a newly created malformed draft is rejected', () => {
  const result = runAutomation(
    ': > "$WEEKLY_BLOG_TEST_BLOGDIR/empty.md"\nprint -r -- "초안 생성"\nexit 0',
  );

  assert.notEqual(result.status, 0);
  assert.match(result.statusText, /초안 검증 실패/);
  assert.deepEqual(result.blogFiles, []);
  assert.equal(result.rejectedFiles.length, 1);
});

test('the exact no-material sentinel exits normally', () => {
  const result = runAutomation('print -r -- "이번 주 글감 없음"\nexit 0');

  assert.equal(result.status, 0);
  assert.match(result.statusText, /정상.*이번 주 글감 없음/);
});

test('one valid draft is accepted and recorded', () => {
  const draft = `---
title: "[개발일지 #17] 자동화 검증"
description: "자동화 테스트용 설명"
pubDate: 2026-07-28
heroImage: "/assets/characters/philo.png"
author: "필로"
category: devlog
series: "생각하는 글밭 개발일지"
seriesNumber: 17
tags: ["자동화", "개발일지"]
status: "draft"
---

안녕하세요, 필로예요. 자동화가 초안을 안전하게 확인해요.`;
  const encodedDraft = Buffer.from(draft).toString('base64');
  const body = `print -r -- ${encodedDraft} | /usr/bin/base64 -D > "$WEEKLY_BLOG_TEST_BLOGDIR/valid.md"\nprint -r -- "초안 생성"\nexit 0`;
  const result = runAutomation(body);

  assert.equal(result.status, 0);
  assert.match(result.statusText, /성공.*초안 생성·검증: valid\.md/);
});

test('a hung Claude process is terminated at the configured deadline', () => {
  const result = runAutomation('sleep 3\nexit 0', { WEEKLY_BLOG_TIMEOUT_SECONDS: '1' });

  assert.notEqual(result.status, 0);
  assert.match(result.statusText, /시간 초과/);
});

test('a concurrent run is rejected before Claude starts', () => {
  const result = runAutomation(
    'print -r -- "실행되면 안 됨"\nexit 0',
    {},
    ({ status }) => {
      mkdirSync(`${status}.lock`);
      writeFileSync(`${status}.lock/pid`, String(process.pid));
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(result.statusText, /중복 실행/);
});

test('creating more than one draft in a run is rejected', () => {
  const result = runAutomation(
    ': > "$WEEKLY_BLOG_TEST_BLOGDIR/one.md"\n: > "$WEEKLY_BLOG_TEST_BLOGDIR/two.md"\nexit 0',
  );

  assert.notEqual(result.status, 0);
  assert.match(result.statusText, /새 초안은 정확히 1개여야 함.*2개/);
});

test('modifying an existing blog post is rejected', () => {
  const result = runAutomation(
    'print -r -- "바뀐 내용" > "$WEEKLY_BLOG_TEST_BLOGDIR/existing.md"\nprint -r -- "이번 주 글감 없음"\nexit 0',
    {},
    ({ blogDir }) => writeFileSync(join(blogDir, 'existing.md'), '원래 내용\n'),
  );

  assert.notEqual(result.status, 0);
  assert.match(result.statusText, /기존 블로그 파일 변경 감지/);
});
