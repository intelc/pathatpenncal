import './styles.css';
import bookmarkletUrl from './generated-bookmarklet.js';

const bookmarklet = document.querySelector('[data-bookmarklet]');
const demoButton = document.querySelector('[data-demo]');
const demo = document.querySelector('[data-demo-shell]');
const steps = [...document.querySelectorAll('[data-step]')];
const caption = document.querySelector('[data-caption]');
const copyButton = document.querySelector('[data-copy-bookmarklet]');
const currentYear = document.querySelector('[data-current-year]');

bookmarklet.href = bookmarkletUrl;
currentYear.textContent = new Date().getFullYear();

const captions = {
  1: 'Drag the navy button into your bookmarks bar once.',
  2: 'Open your Primary Cart calendar in Path@Penn.',
  3: 'Click the bookmark. Pathcal detects the term and prepares your calendar.'
};

function setStep(step) {
  document.body.dataset.demoStep = String(step);
  steps.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.step === String(step))));
  caption.textContent = captions[step];
  if (step === 3) demo.classList.add('is-exporting');
  else demo.classList.remove('is-exporting');
}

steps.forEach((button) => button.addEventListener('click', () => setStep(Number(button.dataset.step))));
demoButton.addEventListener('click', () => {
  setStep(3);
  demo.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

bookmarklet.addEventListener('click', (event) => {
  event.preventDefault();
  setStep(1);
  caption.textContent = 'Drag this button to the bookmarks bar—the click is disabled on this page.';
});

copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(bookmarkletUrl);
    copyButton.textContent = 'Bookmark URL copied';
    caption.textContent = 'Paste it into a bookmark’s URL field—not the DevTools Console.';
    setTimeout(() => { copyButton.textContent = 'Copy bookmark URL'; }, 2200);
  } catch {
    copyButton.textContent = 'Copy unavailable';
  }
});

setStep(1);
