// Checks that every relative Markdown link in the repository resolves to a file, and that every `#anchor` matches a heading.
//
// (c) Copyright 2026 Liminal HQ, Scott Morris
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';

const EXCLUDED = ['design/', 'scratch/', 'node_modules/', '/node_modules/'];

/** GitHub's heading slug: lower case, punctuation dropped, spaces to hyphens. */
export function slug(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
}

export function anchorsOf(markdown: string): Set<string> {
  const seen = new Map<string, number>();
  const anchors = new Set<string>();
  let fenced = false;
  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) fenced = !fenced;
    if (fenced) continue;
    const m = /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const base = slug(m[1]);
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    anchors.add(n === 0 ? base : `${base}-${n}`);
  }
  return anchors;
}

export function relativeLinks(markdown: string): string[] {
  const links: string[] = [];
  let fenced = false;
  for (const line of markdown.split('\n')) {
    if (line.startsWith('```')) fenced = !fenced;
    if (fenced) continue;
    for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) links.push(m[1]);
  }
  return links.filter((l) => !/^[a-z][a-z0-9+.-]*:/i.test(l));
}

function trackedMarkdown(): string[] {
  const out = Bun.spawnSync(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '*.md']);
  return out.stdout
    .toString()
    .split('\n')
    .filter((f) => f && !EXCLUDED.some((x) => f.startsWith(x) || f.includes(x)) && existsSync(f));
}

export function check(files: string[]): string[] {
  const problems: string[] = [];
  const anchorCache = new Map<string, Set<string>>();
  const anchors = (file: string) => {
    let a = anchorCache.get(file);
    if (!a) anchorCache.set(file, (a = anchorsOf(readFileSync(file, 'utf8'))));
    return a;
  };
  for (const file of files) {
    for (const link of relativeLinks(readFileSync(file, 'utf8'))) {
      const [target, fragment] = link.split('#');
      const path = target === '' ? file : normalize(join(dirname(file), decodeURI(target)));
      if (!existsSync(path)) {
        problems.push(`${file}: ${link} does not exist`);
        continue;
      }
      if (fragment && path.endsWith('.md') && !anchors(path).has(fragment.toLowerCase())) {
        problems.push(`${file}: ${link} has no matching heading`);
      }
    }
  }
  return problems;
}

if (import.meta.main) {
  const files = trackedMarkdown();
  const problems = check(files);
  for (const p of problems) console.error(p);
  console.log(`${files.length} Markdown files checked, ${problems.length} broken links`);
  process.exit(problems.length === 0 ? 0 : 1);
}
