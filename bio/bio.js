const content = document.getElementById('content');
const normalize = element => element.textContent.trim().replace(/\s+/g, ' ');

function safeLinkHref(href) {
    const value = href.trim();
    if (!value || /[\u0000-\u001f\u007f]/.test(value) || value.startsWith('//') || value.startsWith('\\')) {
        return null;
    }
    if (/^https?:\/\//i.test(value)) return value;
    return /^[a-z][a-z\d+.-]*:/i.test(value) ? null : value;
}

function appendInlineMarkdown(element, markdown) {
    const linkPattern = /\[([^\]]+)\]\(([^)\s]+)\)/g;
    let position = 0;
    for (const match of markdown.matchAll(linkPattern)) {
        element.append(document.createTextNode(markdown.slice(position, match.index)));
        const href = safeLinkHref(match[2]);
        if (href) {
            const link = document.createElement('a');
            link.href = href;
            link.textContent = match[1];
            element.append(link);
        } else {
            element.append(document.createTextNode(match[1]));
        }
        position = match.index + match[0].length;
    }
    element.append(document.createTextNode(markdown.slice(position)));
}

function renderMarkdown(markdown) {
    const fragment = document.createDocumentFragment();
    let paragraphLines = [];
    let list = null;

    const flushParagraph = () => {
        if (!paragraphLines.length) return;
        const paragraph = document.createElement('p');
        appendInlineMarkdown(paragraph, paragraphLines.join(' '));
        fragment.append(paragraph);
        paragraphLines = [];
    };
    const closeList = () => { list = null; };

    markdown.replace(/\r\n?/g, '\n').split('\n').forEach(line => {
        const heading = line.match(/^(#{1,2})\s+(.+)$/);
        const listItem = line.match(/^-\s+(.+)$/);
        if (heading) {
            flushParagraph();
            closeList();
            const element = document.createElement(`h${heading[1].length}`);
            element.textContent = heading[2];
            fragment.append(element);
        } else if (listItem) {
            flushParagraph();
            if (!list) {
                list = document.createElement('ul');
                fragment.append(list);
            }
            const item = document.createElement('li');
            appendInlineMarkdown(item, listItem[1]);
            list.append(item);
        } else if (!line.trim()) {
            flushParagraph();
            closeList();
        } else {
            closeList();
            paragraphLines.push(line.trim());
        }
    });
    flushParagraph();
    content.replaceChildren(fragment);
}

function showLoadError() {
    const error = document.createElement('p');
    error.setAttribute('role', 'alert');
    error.className = 'load-error';
    error.textContent = 'Biography content could not be loaded. Please refresh the page to try again.';
    content.replaceChildren(error);
}

function enhanceBiographySections() {
    const headings = Array.from(content.querySelectorAll('h2'));
    const bioHeadings = headings.filter(heading =>
        /^Up to [\d,]+ characters$/.test(heading.textContent.trim()) ||
        heading.textContent.trim() === 'KubeCon profile — original wording'
    );

    if (bioHeadings.length) {
        const list = document.createElement('section');
        list.className = 'bio-list';
        list.setAttribute('aria-label', 'Biography versions');
        bioHeadings[0].before(list);

        bioHeadings.forEach(heading => {
            const siblings = [];
            let sibling = heading.nextElementSibling;
            while (sibling && sibling.tagName !== 'H2') {
                siblings.push(sibling);
                sibling = sibling.nextElementSibling;
            }

            const article = document.createElement('article');
            article.className = 'bio-card';
            const limit = heading.textContent.match(/^Up to ([\d,]+) characters$/);
            article.dataset.source = limit ? 'generated' : 'kubecon';
            if (limit) article.dataset.maxChars = limit[1].replace(',', '');

            const header = document.createElement('div');
            header.className = 'card-header';
            const headingGroup = document.createElement('div');
            const count = document.createElement('span');
            count.className = 'count';
            count.setAttribute('aria-live', 'polite');
            headingGroup.append(heading, count);
            header.append(headingGroup);

            const copyLink = siblings.find(element =>
                element.tagName === 'P' && element.querySelector(':scope > a[href="#copy"]')
            );
            if (copyLink) {
                const link = copyLink.querySelector('a');
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'copy-button';
                button.textContent = link.textContent;
                button.setAttribute('aria-label', `Copy ${heading.textContent.trim()} biography`);
                header.append(button);
                copyLink.remove();
            }
            article.append(header);

            const paragraphs = siblings.filter(element => element.isConnected && element.tagName === 'P');
            if (paragraphs[0]) paragraphs[0].className = 'bio-text';
            paragraphs.slice(1).forEach(element => { element.className = 'source-note'; });
            paragraphs.forEach(element => article.append(element));
            list.append(article);
        });
    }

    const sourcesHeading = headings.find(heading => heading.textContent.trim() === 'Profile sources');
    if (sourcesHeading?.isConnected) {
        const aside = document.createElement('aside');
        aside.className = 'sources';
        sourcesHeading.before(aside);
        let node = sourcesHeading;
        while (node) {
            const next = node.nextElementSibling;
            aside.append(node);
            node = next;
        }
    }

    const homeParagraph = content.querySelector(':scope > p:first-child');
    const homeLink = homeParagraph?.querySelector(':scope > a[href="../"]');
    if (homeLink) {
        homeLink.className = 'home-link';
        homeParagraph.replaceWith(homeLink);
    }
    const intro = content.querySelector(':scope > h1 + p');
    if (intro) intro.className = 'intro';

    document.querySelectorAll('.bio-card').forEach(card => {
        const textElement = card.querySelector('.bio-text');
        const countElement = card.querySelector('.count');
        const button = card.querySelector('.copy-button');
        const text = normalize(textElement);
        const characters = Array.from(text).length;
        const words = text.split(/\s+/).filter(Boolean).length;
        countElement.textContent = `${characters} characters · ${words} words`;

        button.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(text);
                button.textContent = 'Copied';
                setTimeout(() => { button.textContent = 'Copy'; }, 1500);
            } catch {
                let copied = false;
                try {
                    const selection = window.getSelection();
                    if (selection && typeof document.execCommand === 'function') {
                        const range = document.createRange();
                        range.selectNodeContents(textElement);
                        selection.removeAllRanges();
                        selection.addRange(range);
                        copied = document.execCommand('copy');
                    }
                } catch {
                    copied = false;
                }
                button.textContent = copied ? 'Copied' : 'Select the biography and press Ctrl/Cmd+C';
                setTimeout(() => { button.textContent = 'Copy'; }, copied ? 1500 : 4000);
            }
        });
    });
}

fetch('content.md')
    .then(response => {
        if (!response.ok) throw new Error(`Unable to load biography content (${response.status})`);
        return response.text();
    })
    .then(markdown => {
        renderMarkdown(markdown);
        enhanceBiographySections();
    })
    .catch(error => {
        console.error(error);
        showLoadError();
    });
