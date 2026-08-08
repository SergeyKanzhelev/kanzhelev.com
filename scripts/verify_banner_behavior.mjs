import assert from 'node:assert/strict';
import test from 'node:test';

import { createBannerController } from '../assets/banner.js';

function element() {
    return {
        alt: '',
        dataset: {},
        src: '',
        textContent: '',
        classList: {
            values: new Set(),
            add(value) { this.values.add(value); },
            remove(value) { this.values.delete(value); },
            contains(value) { return this.values.has(value); },
        },
    };
}

const items = [
    { avatar: 'first.png', name: 'First Org', text: 'first role' },
    { avatar: 'second.png', name: 'Second Org', text: 'second role' },
];

test('reduced-motion mode renders one complete stable item without timers', () => {
    const image = element();
    const text = element();
    const scheduled = [];
    const controller = createBannerController({
        image,
        text,
        items,
        reducedMotion: true,
        schedule(callback, delay) { scheduled.push({ callback, delay }); },
    });

    controller.start();

    assert.equal(image.src, 'first.png');
    assert.equal(image.alt, 'First Org');
    assert.equal(image.dataset.logo, 'first-org');
    assert.equal(text.textContent, 'first role');
    assert.equal(image.classList.contains('visible'), true);
    assert.deepEqual(scheduled, []);
});

test('standard mode starts the existing timed typewriter sequence', () => {
    const image = element();
    const text = element();
    const scheduled = [];
    const controller = createBannerController({
        image,
        text,
        items,
        reducedMotion: false,
        schedule(callback, delay) { scheduled.push({ callback, delay }); },
    });

    controller.start();

    assert.equal(image.src, 'first.png');
    assert.equal(image.alt, 'First Org');
    assert.equal(image.dataset.logo, 'first-org');
    assert.equal(image.classList.contains('visible'), false);
    assert.equal(text.textContent, '');
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].delay, 300);
});

test('standard mode completes one item and advances to the next', () => {
    const image = element();
    const text = element();
    const scheduled = [];
    const controller = createBannerController({
        image,
        text,
        items,
        reducedMotion: false,
        schedule(callback, delay) { scheduled.push({ callback, delay }); },
    });
    const runNext = expectedDelay => {
        const task = scheduled.shift();
        assert.ok(task, `Expected a ${expectedDelay}ms scheduled task`);
        assert.equal(task.delay, expectedDelay);
        task.callback();
    };

    controller.start();
    runNext(300);
    while (scheduled[0]?.delay === 60) runNext(60);
    assert.equal(text.textContent, 'first role');
    runNext(2000);
    assert.equal(image.classList.contains('visible'), false);
    assert.equal(text.textContent, '');
    runNext(500);
    assert.equal(image.src, 'second.png');
    assert.equal(image.alt, 'Second Org');
    assert.equal(image.dataset.logo, 'second-org');
});
