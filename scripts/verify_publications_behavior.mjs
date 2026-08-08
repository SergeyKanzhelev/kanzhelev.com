import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseHTML } from 'linkedom';

import {
    loadPublicationsPage,
    renderMarkdown,
    safeLinkHref,
} from '../publications/publications.js';

test('safeLinkHref accepts grounded web and local links and rejects active content', () => {
    assert.equal(safeLinkHref('https://www.w3.org/TR/trace-context/'), 'https://www.w3.org/TR/trace-context/');
    assert.equal(safeLinkHref('../til/'), '../til/');
    for (const unsafe of [
        'http://example.com',
        'javascript:alert(1)',
        'data:text/html,test',
        '//evil.example/path',
        '\\\\evil.example/path',
        'java\nscript:alert(1)',
    ]) {
        assert.equal(safeLinkHref(unsafe), null, unsafe);
    }
});

test('renderMarkdown creates semantic headings, lists, and safe links in a DOM', () => {
    const originalDocument = globalThis.document;
    const { document } = parseHTML('<main id="content"></main>');
    globalThis.document = document;
    try {
        const target = document.getElementById('content');
        renderMarkdown([
            '[Home](../)',
            '',
            '# Publications',
            '',
            'Introductory text.',
            '',
            '## Patents',
            '',
            '- 2021 — [Grounded record](https://example.com/record) — inventor',
        ].join('\n'), target);
        assert.equal(target.querySelectorAll('h1').length, 1);
        assert.equal(target.querySelectorAll('h2').length, 1);
        assert.equal(target.querySelectorAll('ul > li').length, 1);
        const link = target.querySelector('li a');
        assert.equal(link.textContent, 'Grounded record');
        assert.equal(link.getAttribute('href'), 'https://example.com/record');
        assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
        assert.equal(target.firstElementChild.tagName, 'A');
        assert.equal(target.firstElementChild.className, 'home-link');
        assert.equal(target.querySelector('h1 + p').className, 'intro');
        assert.match(target.textContent, /2021 — Grounded record — inventor/);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('the production Markdown renders end to end in a DOM', async () => {
    const originalDocument = globalThis.document;
    const { document } = parseHTML('<main id="content"></main>');
    globalThis.document = document;
    try {
        const markdown = await readFile(new URL('../publications/content.md', import.meta.url), 'utf8');
        const target = document.getElementById('content');
        const loaded = await loadPublicationsPage({
            target,
            fetchImpl: async url => ({
                ok: url === 'content.md',
                status: url === 'content.md' ? 200 : 404,
                async text() { return markdown; },
            }),
        });
        assert.equal(loaded, true);
        assert.equal(target.hasAttribute('aria-busy'), false);
        assert.equal(target.querySelectorAll('h1').length, 1);
        assert.equal(target.querySelectorAll('h2').length, 7);
        assert.equal(target.querySelectorAll('a').length, 40);
        assert.equal(target.querySelectorAll('li').length, 37);
        assert.equal(target.querySelector('h2').textContent, 'Selected authored articles');
        assert.equal(target.querySelector('a.home-link').getAttribute('href'), '../');
        assert.equal(target.querySelector('a[href="javascript:alert(1)"]'), null);
    } finally {
        globalThis.document = originalDocument;
    }
});

test('loadPublicationsPage fetches the Markdown source and clears busy state', async () => {
    const attributes = new Map();
    const target = {
        setAttribute(name, value) { attributes.set(name, value); },
        removeAttribute(name) { attributes.delete(name); },
    };
    const calls = [];
    const loaded = await loadPublicationsPage({
        target,
        fetchImpl: async url => {
            calls.push(['fetch', url]);
            return { ok: true, async text() { return '# Publications'; } };
        },
        render(markdown, receivedTarget) { calls.push(['render', markdown, receivedTarget]); },
    });
    assert.equal(loaded, true);
    assert.deepEqual(calls, [
        ['fetch', 'content.md'],
        ['render', '# Publications', target],
    ]);
    assert.equal(attributes.has('aria-busy'), false);
});

test('loadPublicationsPage renders an accessible error and clears busy state', async () => {
    const attributes = new Map();
    let renderedError = null;
    const target = {
        setAttribute(name, value) { attributes.set(name, value); },
        removeAttribute(name) { attributes.delete(name); },
        replaceChildren(child) { renderedError = child; },
    };
    const originalDocument = globalThis.document;
    const originalError = console.error;
    globalThis.document = {
        createElement() {
            return {
                attributes: new Map(),
                setAttribute(name, value) { this.attributes.set(name, value); },
                className: '',
                textContent: '',
            };
        },
    };
    console.error = () => {};
    try {
        const loaded = await loadPublicationsPage({
            target,
            fetchImpl: async () => ({ ok: false, status: 404 }),
        });
        assert.equal(loaded, false);
    } finally {
        globalThis.document = originalDocument;
        console.error = originalError;
    }
    assert.equal(renderedError.attributes.get('role'), 'alert');
    assert.match(renderedError.textContent, /could not be loaded/);
    assert.equal(attributes.has('aria-busy'), false);
});
