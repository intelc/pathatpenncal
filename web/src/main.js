import './styles.css';
import bookmarkletUrl from './generated-bookmarklet.js';

const bookmarklet = document.querySelector('[data-bookmarklet]');
const copyButton = document.querySelector('[data-copy-bookmarklet]');
const dragStatus = document.querySelector('[data-drag-status]');
const currentYear = document.querySelector('[data-current-year]');

bookmarklet.href = bookmarkletUrl;
currentYear.textContent = new Date().getFullYear();

bookmarklet.addEventListener('click', (event) => {
  event.preventDefault();
  dragStatus.textContent = 'Drag this button into the bookmarks bar above—the click is disabled here.';
});

bookmarklet.addEventListener('dragstart', () => {
  dragStatus.textContent = 'Now drop it anywhere in your bookmarks bar.';
});

bookmarklet.addEventListener('dragend', () => {
  dragStatus.textContent = 'Nice. Next, open your Primary Cart in Path@Penn.';
});

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(bookmarkletUrl);
    copyButton.textContent = 'Bookmark URL copied';
    dragStatus.textContent = 'Paste it into a bookmark’s URL field—not the DevTools Console.';
    setTimeout(() => { copyButton.textContent = 'Copy bookmark URL'; }, 2200);
  } catch {
    copyButton.textContent = 'Copy unavailable';
  }
});
