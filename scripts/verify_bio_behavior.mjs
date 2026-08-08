import assert from 'node:assert/strict';
import test from 'node:test';

import {
    biographyStats,
    copyBiography,
    loadBiographyPage,
    safeLinkHref,
    setBiographyCount,
} from '../bio/bio.js';

test('safeLinkHref accepts web and local links and rejects active-content URLs', () => {
    assert.equal(safeLinkHref('https://example.com/profile'), 'https://example.com/profile');
    assert.equal(safeLinkHref('../'), '../');
    assert.equal(safeLinkHref('/bio/'), '/bio/');
    for (const unsafe of [
        'javascript:alert(1)',
        ' JAVASCRIPT:alert(1)',
        'data:text/html,test',
        '//evil.example/path',
        '\\\\evil.example/path',
        'java\nscript:alert(1)',
    ]) {
        assert.equal(safeLinkHref(unsafe), null, unsafe);
    }
});

test('biographyStats counts Unicode code points and words', () => {
    assert.deepEqual(biographyStats('Bio 😀 text'), { characters: 10, words: 3 });
});

test('setBiographyCount exposes a polite count announcement', () => {
    const attributes = new Map();
    const count = {
        textContent: '',
        setAttribute(name, value) { attributes.set(name, value); },
    };
    setBiographyCount('Short bio', count);
    assert.equal(count.textContent, '9 characters · 2 words');
    assert.equal(attributes.get('aria-live'), 'polite');
});

test('copyBiography copies the displayed text and announces success', async () => {
    let copied = null;
    let reset = null;
    const button = { textContent: 'Copy', dataset: {} };
    const status = { textContent: '' };
    const result = await copyBiography({
        text: 'Displayed biography',
        textElement: {},
        button,
        status,
        clipboard: { async writeText(text) { copied = text; } },
        schedule(callback) { reset = callback; },
    });
    assert.equal(result, true);
    assert.equal(copied, 'Displayed biography');
    assert.equal(button.textContent, 'Copied');
    assert.equal(status.textContent, 'Biography copied.');
    reset();
    assert.equal(button.textContent, 'Copy');
    assert.equal(status.textContent, '');
});

test('copyBiography announces manual-copy instructions when clipboard methods fail', async () => {
    let selected = false;
    let reset = null;
    const button = { textContent: 'Copy', dataset: {} };
    const status = { textContent: '' };
    const selection = {
        removeAllRanges() {},
        addRange() { selected = true; },
    };
    const result = await copyBiography({
        text: 'Displayed biography',
        textElement: {},
        button,
        status,
        clipboard: { async writeText() { throw new Error('denied'); } },
        documentRef: {
            createRange() { return { selectNodeContents() {} }; },
            execCommand() { return false; },
        },
        windowRef: { getSelection() { return selection; } },
        schedule(callback) { reset = callback; },
    });
    assert.equal(result, false);
    assert.equal(selected, true);
    assert.equal(button.textContent, 'Press Ctrl/Cmd+C');
    assert.equal(status.textContent, 'Biography selected. Press Control or Command plus C to copy.');
    reset();
    assert.equal(button.textContent, 'Copy');
    assert.equal(status.textContent, '');
});

test('loadBiographyPage fetches, renders, enhances, and clears busy state', async () => {
    const attributes = new Map();
    const target = {
        setAttribute(name, value) { attributes.set(name, value); },
        removeAttribute(name) { attributes.delete(name); },
    };
    const calls = [];
    const loaded = await loadBiographyPage({
        target,
        fetchImpl: async url => {
            calls.push(['fetch', url]);
            return { ok: true, async text() { return '# Bio'; } };
        },
        render(markdown, receivedTarget) { calls.push(['render', markdown, receivedTarget]); },
        enhance(receivedTarget) { calls.push(['enhance', receivedTarget]); },
    });
    assert.equal(loaded, true);
    assert.deepEqual(calls, [
        ['fetch', 'content.md'],
        ['render', '# Bio', target],
        ['enhance', target],
    ]);
    assert.equal(attributes.has('aria-busy'), false);
});

test('loadBiographyPage exposes failures and clears busy state', async () => {
    const attributes = new Map();
    const target = {
        setAttribute(name, value) { attributes.set(name, value); },
        removeAttribute(name) { attributes.delete(name); },
    };
    let shown = false;
    const originalError = console.error;
    console.error = () => {};
    try {
        const loaded = await loadBiographyPage({
            target,
            fetchImpl: async () => ({ ok: false, status: 500 }),
            showError(receivedTarget) {
                assert.equal(receivedTarget, target);
                shown = true;
            },
        });
        assert.equal(loaded, false);
    } finally {
        console.error = originalError;
    }
    assert.equal(shown, true);
    assert.equal(attributes.has('aria-busy'), false);
});
