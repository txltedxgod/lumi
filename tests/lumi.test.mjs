import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appCode = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

function createHarness() {
  const store = new Map();
  const elements = new Map();
  const docAttrs = new Map();

  function makeEl(id = '') {
    const classes = new Set();
    const attrs = new Map();
    return {
      id,
      value: '',
      innerHTML: '',
      textContent: '',
      width: 0,
      height: 0,
      href: '',
      download: '',
      dataset: {},
      classList: {
        add: (...c) => c.forEach(x => classes.add(x)),
        remove: (...c) => c.forEach(x => classes.delete(x)),
        toggle: (c, force) => (force === undefined ? (classes.has(c) ? classes.delete(c) : classes.add(c)) : (force ? classes.add(c) : classes.delete(c))),
        contains: c => classes.has(c),
      },
      focus() {},
      click() {},
      addEventListener() {},
      querySelectorAll() { return []; },
      getContext() {
        return {
          clearRect() {},
          save() {},
          restore() {},
          translate() {},
          rotate() {},
          fillRect() {},
          globalAlpha: 1,
          fillStyle: '',
        };
      },
      setAttribute: (k, v) => attrs.set(k, String(v)),
      getAttribute: k => attrs.get(k) ?? null,
    };
  }

  for (const id of [
    'viewRoot', 'greet', 'subgreet', 'themeBtn', 'addBtn', 'overlay',
    'modal', 'toast', 'toastMsg', 'confetti', 'hName', 'nameErr',
  ]) {
    elements.set(id, makeEl(id));
  }

  const documentElement = {
    _attrs: docAttrs,
    setAttribute: (k, v) => docAttrs.set(k, String(v)),
    getAttribute: k => docAttrs.get(k) ?? null,
  };

  const sandbox = {
    window: {},
    document: {
      documentElement,
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, makeEl(id));
        return elements.get(id);
      },
      querySelectorAll: () => [],
      addEventListener() {},
      createElement: tag => makeEl(tag),
    },
    localStorage: {
      getItem: k => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: k => store.delete(k),
    },
    Blob: class MockBlob {
      constructor(parts, opts) {
        this.parts = parts;
        this.opts = opts;
      }
    },
    URL: {
      createObjectURL: () => 'blob:lumi-test',
      revokeObjectURL() {},
    },
    Math,
    Date,
    JSON,
    Object,
    Array,
    Number,
    String,
    Set,
    setTimeout: () => 0,
    clearTimeout() {},
    requestAnimationFrame() {},
    addEventListener() {},
    innerWidth: 1280,
    innerHeight: 720,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  return { sandbox, store, elements, docAttrs };
}

test('index.html declares required DOM IDs and loads app.js', () => {
  assert.match(html, /<script\s+src="app\.js"><\/script>/);
  for (const id of ['viewRoot', 'greet', 'subgreet', 'themeBtn', 'addBtn', 'overlay', 'modal', 'toast', 'toastMsg', 'confetti']) {
    assert.ok(html.includes(`id="${id}"`), `missing #${id} in index.html`);
  }
});

test('Lumi seeds defaults, escapes HTML, sanitizes colors, and persists state', () => {
  const { sandbox, store, elements, docAttrs } = createHarness();
  vm.runInNewContext(appCode, sandbox);

  const initialHtml = elements.get('viewRoot').innerHTML;
  assert.match(initialHtml, /Пить воду/);

  // Adding blank name fails validation cleanly
  elements.get('hName').value = '   ';
  sandbox.Lumi.saveHabit();
  assert.equal(elements.get('hName').classList.contains('err'), true);
  assert.equal(elements.get('nameErr').classList.contains('show'), true);

  // Adding a habit with HTML payload escapes output in dashboard HTML
  elements.get('hName').value = '<img src=x onerror=alert(1)>Read';
  sandbox.Lumi.saveHabit();
  const saved = JSON.parse(store.get('lumi.habits.v1'));
  const added = saved[saved.length - 1];
  assert.equal(added.name, '<img src=x onerror=alert(1)>Read');

  const renderedAfterAdd = elements.get('viewRoot').innerHTML;
  assert.ok(!renderedAfterAdd.includes('<img src=x'), 'raw HTML should be escaped');
  assert.ok(renderedAfterAdd.includes('&lt;img src=x onerror=alert(1)&gt;Read'));

  // Toggle completion increments completion count & persistence
  sandbox.Lumi.toggle(added.id);
  const afterToggle = JSON.parse(store.get('lumi.habits.v1')).find(h => h.id === added.id);
  assert.equal(Object.values(afterToggle.log).filter(Boolean).length, 1);

  // Theme switch persists
  sandbox.Lumi.setTheme('light');
  assert.equal(docAttrs.get('data-theme'), 'light');
  assert.equal(store.get('lumi.theme'), 'light');
});

test('Lumi sanitizes invalid CSS color strings loaded from corrupted localStorage', () => {
  const { sandbox, store, elements } = createHarness();
  store.set(
    'lumi.habits.v1',
    JSON.stringify([{ id: 'bad1', name: 'Test', emoji: '🔥', color: 'red;background:url(x)', goal: 'daily', created: 1, log: {} }]),
  );
  vm.runInNewContext(appCode, sandbox);

  const rendered = elements.get('viewRoot').innerHTML;
  assert.ok(!rendered.includes('background:url(x)'), 'unsafe color injection leaked into style');
  assert.ok(rendered.includes('--hc:#7c5cff'), 'invalid color should fall back to default accent');
});
