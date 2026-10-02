import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const pages = ['index.html', 'multi-agent-ai-operations-hub.html'];
const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

// A deliberately small parser for the two static, script-free portfolio pages.
// It checks nesting rather than assuming that nearby text belongs to a section.
function parse(html) {
  const nodes = [], stack = [];
  for (const match of html.matchAll(/<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][^>]*>/gi)) {
    const token = match[0];
    if (token.startsWith('<!')) continue;
    const name = token.match(/^<\/?([a-z][\w-]*)/i)[1].toLowerCase();
    if (token.startsWith('</')) {
      assert.equal(stack.pop()?.name, name, `Unbalanced closing tag: ${token}`);
      continue;
    }
    const attrs = Object.fromEntries([...token.matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map(m => [m[1], m[2]]));
    const node = { name, attrs, parent: stack.at(-1) };
    nodes.push(node);
    if (!voidTags.has(name) && !token.endsWith('/>')) stack.push(node);
  }
  assert.equal(stack.length, 0, 'Unclosed HTML elements');
  return nodes;
}

const htmlByPage = new Map(await Promise.all(pages.map(async page => [page, await readFile(new URL(page, root), 'utf8')])));
const nodesByPage = new Map([...htmlByPage].map(([page, html]) => [page, parse(html)]));

function localTarget(page, value) {
  const url = new URL(value.replaceAll('&amp;', '&'), new URL(page, 'https://portfolio.test/'));
  if (url.origin !== 'https://portfolio.test') return null;
  const path = decodeURIComponent(url.pathname.slice(1)) || 'index.html';
  return { path, fragment: decodeURIComponent(url.hash.slice(1)) };
}

for (const page of pages) {
  const nodes = nodesByPage.get(page), html = htmlByPage.get(page);
  test(`${page}: document language, metadata and heading hierarchy`, () => {
    assert.equal(nodes.find(n => n.name === 'html').attrs.lang, 'de');
    assert.ok(nodes.some(n => n.name === 'meta' && n.attrs.name === 'viewport'));
    assert.ok(nodes.some(n => n.name === 'meta' && n.attrs.name === 'description' && n.attrs.content.length > 20));
    const headings = nodes.filter(n => /^h[1-6]$/.test(n.name)).map(n => Number(n.name[1]));
    assert.equal(headings.filter(level => level === 1).length, 1);
    assert.equal(headings[0], 1);
    for (let i = 1; i < headings.length; i++) assert.ok(headings[i] <= headings[i - 1] + 1, `Heading level jumps to h${headings[i]}`);
    assert.ok(!html.includes('Stand September 2026'));
  });
  test(`${page}: unique IDs and valid accessible labels`, () => {
    const ids = nodes.map(n => n.attrs.id).filter(Boolean);
    assert.equal(ids.length, new Set(ids).size);
    for (const node of nodes) {
      for (const id of (node.attrs['aria-labelledby'] ?? '').split(/\s+/).filter(Boolean)) assert.ok(ids.includes(id), `Missing label: ${id}`);
      if (node.name === 'img') assert.ok(node.attrs.alt?.trim(), 'Image without descriptive alternative');
      if (node.name === 'nav') assert.ok(node.attrs['aria-label']?.trim(), 'Navigation without a label');
    }
    assert.ok(nodes.some(n => n.name === 'a' && n.attrs.class === 'skip-link' && n.attrs.href === '#top'));
    assert.ok(nodes.some(n => n.name === 'main' && n.attrs.id === 'top'));
  });
  test(`${page}: every local link and media file exists; anchors resolve`, async () => {
    for (const node of nodes) {
      const value = node.attrs.href ?? node.attrs.src;
      if (!value) continue;
      const target = localTarget(page, value);
      if (!target) continue;
      await stat(new URL(target.path, root));
      if (target.fragment) {
        const linked = nodesByPage.get(target.path);
        assert.ok(linked, `Unparsed anchor document: ${target.path}`);
        assert.ok(linked.some(n => n.attrs.id === target.fragment), `Missing anchor: ${value}`);
      }
    }
  });
}

test('all five case studies are inside the project overview and directly linked', () => {
  const nodes = nodesByPage.get('index.html');
  const cases = nodes.filter(n => n.name === 'article' && (n.attrs.class ?? '').split(/\s+/).includes('case'));
  assert.equal(cases.length, 5);
  for (const node of cases) {
    let ancestor = node.parent;
    while (ancestor && ancestor.attrs.id !== 'projekte') ancestor = ancestor.parent;
    assert.ok(ancestor, `Case outside the overview: ${node.attrs.id}`);
    assert.ok(nodes.some(n => n.name === 'a' && n.parent?.attrs.class === 'project-navigation' && n.attrs.href === `#${node.attrs.id}`));
  }
});

test('demo video remains downloadable and its execution limits are explicit', async () => {
  const html = htmlByPage.get('index.html');
  assert.match(html, /Node\.js-Adapter, keinen Live-n8n-Durchlauf/);
  assert.match(html, /429-Fehler ist simuliert/);
  assert.ok((await stat(new URL('projects/release-support-triage/demo.mp4', root))).size > 10000);
});

test('the detail page includes the fresh-stack integration evidence and its limits', () => {
  const html = htmlByPage.get('multi-agent-ai-operations-hub.html');
  assert.match(html, /CLEAN_E2E\.md/);
  assert.match(html, /vier ausgeführte Webhook-Routen/);
  assert.match(html, /Kein Live-LLM-Aufruf/);
});

test('README local file and directory links resolve', async () => {
  const readme = await readFile(new URL('README.md', root), 'utf8');
  for (const match of readme.matchAll(/\]\(([^\s)]+)\)/g)) {
    const target = localTarget('README.md', match[1]);
    if (target) await stat(new URL(target.path, root));
  }
});

test('directly offered n8n exports are inactive, credential-free and structurally valid', async () => {
  const targets = new Set([...nodesByPage].flatMap(([page, nodes]) => nodes.filter(n => n.name === 'a').map(n => localTarget(page, n.attrs.href ?? '')?.path).filter(path => path?.endsWith('.json'))));
  assert.equal(targets.size, 8);
  for (const path of targets) {
    const exported = JSON.parse(await readFile(new URL(path, root), 'utf8'));
    const workflows = Array.isArray(exported) ? exported : [exported];
    assert.ok(workflows.length > 0, `${path}: empty workflow export`);
    for (const workflow of workflows) {
    assert.equal(workflow.active, false, path);
    const names = workflow.nodes.map(n => n.name);
    assert.equal(names.length, new Set(names).size, `${path}: duplicate node names`);
    for (const node of workflow.nodes) {
      assert.equal(node.credentials, undefined, `${path}: credential object`);
      if (node.parameters?.jsCode) new vm.Script(`(function(){\n${node.parameters.jsCode}\n})`);
    }
    for (const [source, outputs] of Object.entries(workflow.connections)) {
      assert.ok(names.includes(source), `${path}: unknown source ${source}`);
      for (const branches of Object.values(outputs)) for (const branch of branches) for (const edge of branch) assert.ok(names.includes(edge.node), `${path}: unknown destination ${edge.node}`);
    }
    }
  }
});

test('public website assets respond successfully (optional live audit)', { skip: !process.env.PORTFOLIO_BASE_URL }, async () => {
  const base = new URL(process.env.PORTFOLIO_BASE_URL);
  const targets = new Set(pages);
  for (const [page, nodes] of nodesByPage) for (const node of nodes) {
    const value = node.attrs.href ?? node.attrs.src;
    if (value) { const target = localTarget(page, value); if (target) targets.add(target.path); }
  }
  await Promise.all([...targets].map(async path => {
    const response = await fetch(new URL(path, base), { method: 'HEAD', signal: AbortSignal.timeout(20000) });
    assert.equal(response.status, 200, path);
  }));
});
