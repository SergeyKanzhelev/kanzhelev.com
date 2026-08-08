const STORAGE_KEY = 'sergey.navigation.visible';
const DOUBLE_TAP_DELAY_MS = 500;
const TAP_MOVEMENT_LIMIT_PX = 12;

function setVisible(navigation, visible) {
    navigation.classList.toggle('visible', visible);
    navigation.setAttribute('aria-hidden', String(!visible));
}

export function createNavigationController({ navigation, storage }) {
    return {
        restore() {
            let visible = false;
            try {
                visible = storage?.getItem(STORAGE_KEY) === 'true';
            } catch {
                // Storage can be unavailable in private or restricted contexts.
            }
            setVisible(navigation, visible);
        },
        toggle() {
            const visible = !navigation.classList.contains('visible');
            setVisible(navigation, visible);
            try {
                storage?.setItem(STORAGE_KEY, String(visible));
            } catch {
                // Keep the in-memory toggle usable when persistence is blocked.
            }
        },
    };
}

function isEditable(target) {
    if (!target) return false;
    const tagName = target.tagName?.toUpperCase();
    return target.isContentEditable
        || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tagName)
        || Boolean(target.closest?.('[contenteditable="true"]'));
}

export function bindNavigationReveal({
    avatar,
    documentRef,
    toggle,
    now = () => Date.now(),
}) {
    let activeTouch = null;
    let previousTap = null;
    let lastTouchToggle = null;

    const isPrimaryTouch = (event) => event.pointerType === 'touch' && event.isPrimary !== false;
    const movedTooFar = (event) => activeTouch
        && Math.hypot(event.clientX - activeTouch.x, event.clientY - activeTouch.y) > TAP_MOVEMENT_LIMIT_PX;

    avatar.addEventListener('pointerdown', (event) => {
        if (!isPrimaryTouch(event)) return;
        activeTouch = {
            pointerId: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            moved: false,
        };
    });

    avatar.addEventListener('pointermove', (event) => {
        if (activeTouch?.pointerId === event.pointerId && movedTooFar(event)) {
            activeTouch.moved = true;
        }
    });

    avatar.addEventListener('pointercancel', (event) => {
        if (activeTouch?.pointerId !== event.pointerId) return;
        activeTouch = null;
        previousTap = null;
    });

    avatar.addEventListener('pointerup', (event) => {
        if (!isPrimaryTouch(event) || activeTouch?.pointerId !== event.pointerId) return;

        const validTap = !activeTouch.moved && !movedTooFar(event);
        activeTouch = null;
        if (!validTap) {
            previousTap = null;
            return;
        }

        const timestamp = now();
        if (previousTap !== null && timestamp - previousTap <= DOUBLE_TAP_DELAY_MS) {
            previousTap = null;
            lastTouchToggle = timestamp;
            toggle();
            return;
        }
        previousTap = timestamp;
    });

    avatar.addEventListener('dblclick', (event) => {
        const timestamp = now();
        const followsTouchToggle = lastTouchToggle !== null
            && timestamp - lastTouchToggle <= DOUBLE_TAP_DELAY_MS;
        if (event.pointerType === 'touch' || followsTouchToggle) return;
        toggle();
    });

    documentRef.addEventListener('keydown', (event) => {
        if (event.key === 'i' && !isEditable(event.target)) toggle();
    });
}

function initializeNavigation() {
    const navigation = document.getElementById('hiddenNav');
    const avatar = document.getElementById('profileAvatar');
    if (!navigation || !avatar) return;

    let storage = null;
    try {
        storage = window.localStorage;
    } catch {
        // Accessing localStorage itself can throw in restricted contexts.
    }

    const controller = createNavigationController({ navigation, storage });
    controller.restore();
    bindNavigationReveal({
        avatar,
        documentRef: document,
        toggle: () => controller.toggle(),
    });
}

if (typeof document !== 'undefined') initializeNavigation();
