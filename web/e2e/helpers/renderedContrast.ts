import { expect, type Page } from '@playwright/test';
import { PNG } from 'pngjs';

function luminance(rgb: number[]) {
  const linear = rgb.map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

// Axe cannot resolve gradient backgrounds. Sample the rendered background
// beneath visible text with glyph fill temporarily removed, not the gradients.
// This supplements axe; it does not measure images, placeholders or offscreen text.
async function visibleTextSamples(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d')!;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const samples: { text: string; color: number[]; alpha: number; minimum: number; x: number; y: number; right: number; bottom: number }[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const element = node.parentElement;
      if (!element || !/[\p{L}\p{N}]/u.test(node.textContent || '') || element.closest('script, style, [aria-hidden="true"], [inert]')) continue;
      const style = getComputedStyle(element);
      if (style.visibility !== 'visible') continue;
      let alpha = 1;
      for (let parent: Element | null = element; parent; parent = parent.parentElement) alpha *= Number(getComputedStyle(parent).opacity);
      if (!alpha) continue;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = style.color;
      context.fillRect(0, 0, 1, 1);
      const color = Array.from(context.getImageData(0, 0, 1, 1).data);
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        const bounds = element.getBoundingClientRect();
        const x = Math.max(rect.left, bounds.left, 0);
        const y = Math.max(rect.top, bounds.top, 0);
        const right = Math.min(rect.right, bounds.right, innerWidth);
        const bottom = Math.min(rect.bottom, bounds.bottom, innerHeight);
        if (right - x < 3 || bottom - y < 3) continue;
        const hit = document.elementFromPoint((x + right) / 2, (y + bottom) / 2);
        if (!hit || !(element === hit || element.contains(hit))) continue;
        const size = parseFloat(style.fontSize);
        samples.push({
          text: node.textContent!.trim().slice(0, 80),
          color,
          alpha: (alpha * color[3]) / 255,
          minimum: size >= 24 || (size >= 18.66 && Number(style.fontWeight) >= 700) ? 3 : 4.5,
          x,
          y,
          right,
          bottom
        });
      }
    }
    return samples;
  });
}

async function sampleStableFrame(page: Page, unstable: (reason: string) => void) {
  const samples = await visibleTextSamples(page);
  const hiddenGlyphs = await page.addStyleTag({
    content: '* { -webkit-text-fill-color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; }'
  });
  let pixels: PNG;
  try {
    pixels = PNG.sync.read(await page.screenshot({ scale: 'css', animations: 'disabled' }));
  } finally {
    await hiddenGlyphs.evaluate(element => element.remove());
  }
  // Live room discovery can move controls between the DOM read and screenshot.
  // Resample geometry changes, never retry simply because contrast is too low.
  const after = await visibleTextSamples(page);
  if (JSON.stringify(samples) !== JSON.stringify(after)) {
    const index = samples.findIndex((sample, i) => JSON.stringify(sample) !== JSON.stringify(after[i]));
    unstable(JSON.stringify({ before: samples[index], after: after[index], counts: [samples.length, after.length] }));
    return null;
  }
  return samples.map(sample => {
    let ratio = Infinity;
    for (let y = Math.ceil(sample.y); y < Math.floor(sample.bottom); y += 2) {
      for (let x = Math.ceil(sample.x); x < Math.floor(sample.right); x += 2) {
        const offset = (y * pixels.width + x) * 4;
        const background = Array.from(pixels.data.subarray(offset, offset + 3));
        const foreground = sample.color.slice(0, 3).map((value, i) => value * sample.alpha + background[i] * (1 - sample.alpha));
        const a = luminance(foreground);
        const b = luminance(background);
        ratio = Math.min(ratio, (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05));
      }
    }
    return { text: sample.text, ratio, minimum: sample.minimum };
  });
}

export async function renderedTextContrast(page: Page) {
  const still = await page.addStyleTag({ content: '*, *::before, *::after { animation: none !important; transition: none !important; }' });
  try {
    let change = '';
    const measured: { result: Awaited<ReturnType<typeof sampleStableFrame>> } = { result: null };
    try {
      await expect
        .poll(
          async () => {
            measured.result = await sampleStableFrame(page, reason => {
              change = reason;
            });
            return measured.result !== null;
          },
          { timeout: 6000, message: 'Contrast screenshot and text geometry must agree' }
        )
        .toBe(true);
    } catch (cause) {
      throw new Error(`Text geometry did not stabilize during contrast capture: ${change}`, { cause });
    }
    return measured.result!;
  } finally {
    await still.evaluate(element => element.remove());
  }
}
