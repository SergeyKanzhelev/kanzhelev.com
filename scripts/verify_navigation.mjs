import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
    bindNavigationReveal,
    createNavigationController,
} from '../assets/navigation.js';

class FakeClassList {
    constructor() { this.values = new Set(); }
    contains(name) { return this.values.has(name); }
    toggle(name, force) {
        const enabled = force === undefined ? !this.contains(name) : force;
        if (enabled) this.values.add(name);
        else this.values.delete(name);
        return enabled;
    }
}

class FakeNavigation {
    constructor() {
        this.classList = new FakeClassList();
        this.attributes = new Map();
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name); }
}

class FakeStorage {
    constructor(value = null) {
        this.value = value;
        this.writes = [];
    }
    getItem() { return this.value; }
    setItem(key, value) {
        this.value = value;
        this.writes.push([key, value]);
    }
}

function event(type, properties = {}) {
    const value = new Event(type);
    for (const [name, property] of Object.entries(properties)) {
        Object.defineProperty(value, name, { value: property });
    }
    return value;
}

test('controller restores visible navigation from local storage', () => {
    const navigation = new FakeNavigation();
    const storage = new FakeStorage('true');
    const controller = createNavigationController({ navigation, storage });

    controller.restore();

    assert.equal(navigation.classList.contains('visible'), true);
    assert.equal(navigation.getAttribute('aria-hidden'), 'false');
});

test('controller defaults to hidden and persists each toggle', () => {
    const navigation = new FakeNavigation();
    const storage = new FakeStorage();
    const controller = createNavigationController({ navigation, storage });

    controller.restore();
    assert.equal(navigation.classList.contains('visible'), false);
    assert.equal(navigation.getAttribute('aria-hidden'), 'true');

    controller.toggle();
    assert.equal(navigation.classList.contains('visible'), true);
    assert.deepEqual(storage.writes.at(-1), ['sergey.navigation.visible', 'true']);

    controller.toggle();
    assert.equal(navigation.classList.contains('visible'), false);
    assert.deepEqual(storage.writes.at(-1), ['sergey.navigation.visible', 'false']);
});

test('controller remains usable when local storage is unavailable', () => {
    const navigation = new FakeNavigation();
    const storage = {
        getItem() { throw new Error('blocked'); },
        setItem() { throw new Error('blocked'); },
    };
    const controller = createNavigationController({ navigation, storage });

    controller.restore();
    controller.toggle();

    assert.equal(navigation.classList.contains('visible'), true);
});

test('double click on the profile picture toggles navigation once', () => {
    const avatar = new EventTarget();
    const documentRef = new EventTarget();
    let toggles = 0;
    bindNavigationReveal({ avatar, documentRef, toggle: () => { toggles += 1; } });

    avatar.dispatchEvent(event('dblclick', { pointerType: 'mouse' }));

    assert.equal(toggles, 1);
});

test('double tap on the profile picture toggles navigation once', () => {
    const avatar = new EventTarget();
    const documentRef = new EventTarget();
    let toggles = 0;
    let time = 1000;
    bindNavigationReveal({
        avatar,
        documentRef,
        toggle: () => { toggles += 1; },
        now: () => time,
    });

    const tap = () => {
        avatar.dispatchEvent(event('pointerdown', {
            pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: 10, clientY: 10,
        }));
        avatar.dispatchEvent(event('pointerup', {
            pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: 10, clientY: 10,
        }));
    };
    tap();
    time = 1300;
    tap();
    avatar.dispatchEvent(event('dblclick', { pointerType: 'touch' }));

    assert.equal(toggles, 1);
});

test('touch scrolling, cancellation, and secondary pointers do not count as taps', () => {
    const avatar = new EventTarget();
    const documentRef = new EventTarget();
    let toggles = 0;
    bindNavigationReveal({ avatar, documentRef, toggle: () => { toggles += 1; } });

    avatar.dispatchEvent(event('pointerdown', {
        pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: 0, clientY: 0,
    }));
    avatar.dispatchEvent(event('pointerup', {
        pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: 30, clientY: 0,
    }));

    avatar.dispatchEvent(event('pointerdown', {
        pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: 0, clientY: 0,
    }));
    avatar.dispatchEvent(event('pointercancel', {
        pointerType: 'touch', pointerId: 1, isPrimary: true,
    }));
    avatar.dispatchEvent(event('pointerup', {
        pointerType: 'touch', pointerId: 1, isPrimary: true, clientX: 0, clientY: 0,
    }));

    for (let count = 0; count < 2; count += 1) {
        avatar.dispatchEvent(event('pointerdown', {
            pointerType: 'touch', pointerId: 2, isPrimary: false, clientX: 0, clientY: 0,
        }));
        avatar.dispatchEvent(event('pointerup', {
            pointerType: 'touch', pointerId: 2, isPrimary: false, clientX: 0, clientY: 0,
        }));
    }

    assert.equal(toggles, 0);
});

test('i keyboard shortcut remains available outside editable controls', () => {
    const avatar = new EventTarget();
    const documentRef = new EventTarget();
    let toggles = 0;
    bindNavigationReveal({ avatar, documentRef, toggle: () => { toggles += 1; } });

    documentRef.dispatchEvent(event('keydown', { key: 'i', target: { tagName: 'BODY' } }));
    for (const target of [
        { tagName: 'INPUT' },
        { tagName: 'TEXTAREA' },
        { tagName: 'SELECT' },
        { tagName: 'DIV', isContentEditable: true },
    ]) {
        documentRef.dispatchEvent(event('keydown', { key: 'i', target }));
    }

    assert.equal(toggles, 1);
});

test('homepage loads navigation behavior while keeping navigation hidden by default', async () => {
    const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');

    assert.match(html, /<img[^>]+class="avatar"[^>]+id="profileAvatar"/);
    assert.match(html, /<nav[^>]+class="hidden-nav"[^>]+id="hiddenNav"[^>]+aria-hidden="true"/);
    assert.match(html, /<script type="module" src="assets\/navigation\.js"><\/script>/);
});
