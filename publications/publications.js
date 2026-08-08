export function safeLinkHref(href) {
    const value = href.trim();
    if (!value || /[\u0000-\u001f\u007f]/.test(value) || value.startsWith('//') || value.startsWith('\\')) {
        return null;
    }
    if (/^https:\/\//i.test(value)) return value;
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
            if (/^https:\/\//i.test(href)) {
                link.rel = 'noopener noreferrer';
            }
            element.append(link);
        } else {
            element.append(document.createTextNode(match[1]));
        }
        position = match.index + match[0].length;
    }
    element.append(document.createTextNode(markdown.slice(position)));
}

export function renderMarkdown(markdown, target) {
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
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
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
    target.replaceChildren(fragment);

    const homeParagraph = target.querySelector(':scope > p:first-child');
    const homeLink = homeParagraph?.querySelector(':scope > a[href="../"]');
    if (homeLink) {
        homeLink.className = 'home-link';
        homeParagraph.replaceWith(homeLink);
    }
    const intro = target.querySelector(':scope > h1 + p');
    if (intro) intro.className = 'intro';
}

function showLoadError(target) {
    const error = document.createElement('p');
    error.setAttribute('role', 'alert');
    error.className = 'load-error';
    error.textContent = 'Publication content could not be loaded. Please refresh the page to try again.';
    target.replaceChildren(error);
}

export async function loadPublicationsPage({
    target,
    fetchImpl = globalThis.fetch,
    render = renderMarkdown,
}) {
    target.setAttribute('aria-busy', 'true');
    try {
        const response = await fetchImpl('content.md');
        if (!response.ok) throw new Error(`Unable to load publication content (${response.status})`);
        render(await response.text(), target);
        return true;
    } catch (error) {
        console.error(error);
        showLoadError(target);
        return false;
    } finally {
        target.removeAttribute('aria-busy');
    }
}

if (typeof document !== 'undefined') {
    const content = document.getElementById('content');
    if (content) loadPublicationsPage({ target: content });
}
