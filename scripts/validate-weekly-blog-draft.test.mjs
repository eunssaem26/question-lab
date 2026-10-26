import assert from 'node:assert/strict';
import test from 'node:test';

import { validateDraft } from './validate-weekly-blog-draft.mjs';

function validDraft(overrides = '') {
  return `---
title: "[개발일지 #3] 검증"
description: "검증용 설명"
pubDate: 2026-07-28
heroImage: "/assets/characters/philo.png"
author: "필로"
category: devlog
series: "생각하는 글밭 개발일지"
seriesNumber: 3
tags: ["검증"]
status: "draft"
${overrides}---

안녕하세요, 필로예요. 검증용 본문이에요.`;
}

test('empty draft is rejected with actionable errors', () => {
  const errors = validateDraft('', { existingSeriesNumbers: [] });

  assert.ok(errors.length > 0);
  assert.ok(errors.some((error) => error.includes('frontmatter')));
});

test('an impossible calendar date is rejected', () => {
  const content = validDraft().replace('pubDate: 2026-07-28', 'pubDate: 2026-02-30');
  const errors = validateDraft(content, { existingSeriesNumbers: [] });

  assert.ok(errors.some((error) => error.includes('실제 날짜')));
});

test('a devlog must use the next series number', () => {
  const content = validDraft().replace('seriesNumber: 3', 'seriesNumber: 5');
  const errors = validateDraft(content, { existingSeriesNumbers: [1, 2, 3] });

  assert.ok(errors.some((error) => error.includes('다음 번호 4')));
});
