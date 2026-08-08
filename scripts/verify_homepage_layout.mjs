import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

function ruleIn(source, selector) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'm'));
    assert.ok(match, `Expected a CSS rule for ${selector}`);
    return match[1];
}

function rule(selector) {
    return ruleIn(html, selector);
}

function parseDeclarations(block) {
    return Object.fromEntries(
        [...block.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)].map(([, property, value]) => [property, value.trim()]),
    );
}

function declarations(selector) {
    return parseDeclarations(rule(selector));
}

function mediaBlock(condition) {
    const marker = `@media (${condition})`;
    const markerIndex = html.indexOf(marker);
    assert.notEqual(markerIndex, -1, `Expected ${marker}`);
    const openIndex = html.indexOf('{', markerIndex + marker.length);
    assert.notEqual(openIndex, -1, `Expected an opening brace for ${marker}`);
    let depth = 1;
    for (let index = openIndex + 1; index < html.length; index += 1) {
        if (html[index] === '{') depth += 1;
        if (html[index] === '}') depth -= 1;
        if (depth === 0) return html.slice(openIndex + 1, index);
    }
    assert.fail(`Expected a closing brace for ${marker}`);
}

function mediaDeclarations(condition, selector) {
    const block = mediaBlock(condition);
    for (const match of block.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        const selectors = match[1].split(',').map(value => value.trim());
        if (selectors.includes(selector)) return parseDeclarations(match[2]);
    }
    assert.fail(`Expected ${selector} inside @media (${condition})`);
}

function cssPixels(value) {
    const match = value?.match(/^([\d.]+)(px|rem)$/);
    assert.ok(match, `Expected a simple CSS length, got ${value}`);
    return Number(match[1]) * (match[2] === 'rem' ? 16 : 1);
}

test('contact icon-label pairs have visible icons and centered touch targets', () => {
    const contact = declarations('.contacts a');
    assert.equal(contact.display, 'inline-flex');
    assert.equal(contact['align-items'], 'center');
    assert.ok(cssPixels(contact['min-height']) >= 44);
    assert.ok(cssPixels(contact.gap) >= 6);

    const icon = declarations('.contacts a .icon');
    assert.equal(icon.display, 'block');
    assert.equal(icon.flex, '0 0 auto');
    assert.ok(cssPixels(icon.width) >= 16 && cssPixels(icon.width) <= 24);
    assert.ok(cssPixels(icon.height) >= 16 && cssPixels(icon.height) <= 24);
    assert.doesNotMatch(rule('.contacts a .icon'), /vertical-align\s*:|margin-right\s*:/);

    const decorativeIcons = html.match(/<img class="icon"[^>]+alt=""[^>]+aria-hidden="true"/g) || [];
    assert.equal(decorativeIcons.length, 2);
});

test('animated organization logo and role occupy visible balanced stable columns', () => {
    const banner = declarations('.banner');
    assert.equal(banner.display, 'grid');
    assert.equal(banner['align-items'], 'center');
    assert.match(banner.width, /min\(/);
    assert.ok(cssPixels(banner['min-height']) >= 72);
    assert.ok(cssPixels(banner.gap) >= 12);

    const logo = declarations('.banner-avatar');
    const logoWidth = cssPixels(logo.width);
    assert.ok(logoWidth >= 40 && logoWidth <= 56);
    assert.equal(logoWidth, cssPixels(logo.height));
    assert.equal(logo.display, 'block');
    assert.equal(logo['object-fit'], 'contain');
    assert.match(banner['grid-template-columns'], new RegExp(`^(?:${logo.width.replace('.', '\\.')})\\s+minmax\\(0,\\s*1fr\\)$`));

    const text = declarations('.banner-text');
    assert.equal(text['min-width'], '0');
    assert.equal(text['text-align'], 'left');
    assert.ok(Number(text['line-height']) >= 1.2);
});

test('logo normalization uses presentation data rather than accessible alt text', () => {
    const logo = declarations('.banner-avatar');
    assert.match(logo.transform, /var\(--logo-scale\)/);
    assert.ok(Number(logo['--logo-scale']) > 0);

    const google = declarations('.banner-avatar[data-logo="google"]');
    const containerd = declarations('.banner-avatar[data-logo="containerd"]');
    assert.ok(Number(google['--logo-scale']) > Number(logo['--logo-scale']));
    assert.ok(Number(containerd['--logo-scale']) > Number(google['--logo-scale']));
    assert.doesNotMatch(html, /\.banner-avatar\[alt=/);
});

test('homepage adapts on small screens with nonzero aligned logo geometry', () => {
    assert.match(html, /\.contacts\s*\{[^}]*flex-wrap\s*:\s*wrap/s);
    const banner = mediaDeclarations('max-width: 520px', '.banner');
    const logo = mediaDeclarations('max-width: 520px', '.banner-avatar');
    const logoWidth = cssPixels(logo.width);
    assert.ok(logoWidth >= 40 && logoWidth <= 56);
    assert.equal(logoWidth, cssPixels(logo.height));
    const firstColumn = banner['grid-template-columns'].split(/\s+/)[0];
    assert.equal(cssPixels(firstColumn), logoWidth);
});

test('reduced-motion media rule disables transitions on every animated selector', () => {
    for (const selector of ['.contacts a', '.banner-avatar', '.hidden-nav a']) {
        const reduced = mediaDeclarations('prefers-reduced-motion: reduce', selector);
        assert.equal(reduced.transition, 'none');
    }
});
