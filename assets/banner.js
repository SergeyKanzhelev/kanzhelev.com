function logoKey(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function createBannerController({
    image,
    text,
    items,
    reducedMotion = false,
    schedule = setTimeout,
}) {
    let current = 0;

    function setItem(item) {
        image.src = item.avatar;
        image.alt = item.name;
        image.dataset.logo = logoKey(item.name);
    }

    function typeText(value, callback) {
        let index = 0;
        text.textContent = '';
        function typeNextCharacter() {
            if (index < value.length) {
                text.textContent += value[index];
                index += 1;
                schedule(typeNextCharacter, 60);
            } else {
                schedule(callback, 2000);
            }
        }
        typeNextCharacter();
    }

    function showNext() {
        const item = items[current];
        setItem(item);
        image.classList.remove('visible');
        schedule(() => {
            image.classList.add('visible');
            typeText(item.text, () => {
                image.classList.remove('visible');
                text.textContent = '';
                current = (current + 1) % items.length;
                schedule(showNext, 500);
            });
        }, 300);
    }

    function start() {
        if (!items.length) {
            return;
        }
        if (reducedMotion) {
            const item = items[0];
            setItem(item);
            text.textContent = item.text;
            image.classList.add('visible');
            return;
        }
        showNext();
    }

    return { start };
}

export async function bootstrapBanner() {
    const image = document.getElementById('bannerImg');
    const text = document.getElementById('bannerText');
    if (!image || !text) {
        return;
    }
    const response = await fetch('banner.json');
    if (!response.ok) {
        throw new Error(`Unable to load banner data: ${response.status}`);
    }
    const items = await response.json();
    createBannerController({
        image,
        text,
        items,
        reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    }).start();
}

if (typeof document !== 'undefined') {
    bootstrapBanner().catch(() => {
        // The profile remains usable when the optional rotating banner cannot load.
    });
}
