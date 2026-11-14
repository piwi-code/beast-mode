import { SessionSummary } from '../../domain/engine/sessionSummary';

/** Public address of the app, shown in the footer of shared images. */
export const APP_URL = 'https://piwi-code.github.io/beast-mode/';
const APP_URL_LABEL = 'piwi-code.github.io/beast-mode';

const W = 1080;
const PAD = 72;
const ROW_H = 132;
const FONT =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

const C = {
  bg: '#09090b',
  card: '#18181b',
  line: '#27272a',
  white: '#fafafa',
  muted: '#a1a1aa',
  dim: '#71717a',
  accent: '#34d399',
  accentDeep: '#10b981',
};

function loadIcon(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = `${import.meta.env.BASE_URL}icon.svg`;
  });
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const formatKg = (kg: number) => (kg > 0 ? `${kg} kg` : 'Bodyweight');

/**
 * Draws a minimal, share-ready summary card of a workout (1080px wide PNG):
 * date started, split, one line per exercise (top weight + sets) and a
 * Beast Mode footer with the app address.
 */
export async function renderSessionShareImage(summary: SessionSummary): Promise<Blob> {
  const icon = await loadIcon();
  const rows = summary.rows;

  const headerH = 150;
  const titleH = 250;
  const statsH = 150;
  const listH = Math.max(1, rows.length) * ROW_H + 48;
  const footerH = 150;
  const H = PAD + headerH + titleH + statsH + listH + footerH;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');

  // Background with a soft accent glow in the top corner
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W, 0, 0, W, 0, 760);
  glow.addColorStop(0, 'rgba(16,185,129,0.22)');
  glow.addColorStop(1, 'rgba(16,185,129,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  ctx.textBaseline = 'alphabetic';
  let y = PAD;

  // Header: logo + wordmark
  if (icon) ctx.drawImage(icon, PAD, y, 96, 96);
  ctx.fillStyle = C.white;
  ctx.font = `800 46px ${FONT}`;
  ctx.fillText('BEAST MODE', PAD + (icon ? 124 : 0), y + 50);
  ctx.fillStyle = C.accent;
  ctx.font = `700 28px ${FONT}`;
  ctx.fillText('WORKOUT COMPLETE', PAD + (icon ? 124 : 0), y + 90);
  y += headerH;

  // Date started + split
  const started = new Date(summary.startedAt);
  ctx.fillStyle = C.muted;
  ctx.font = `600 34px ${FONT}`;
  ctx.fillText(
    `${started.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })} · ${started.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`,
    PAD,
    y + 40
  );
  ctx.fillStyle = C.white;
  ctx.font = `800 104px ${FONT}`;
  ctx.fillText(fitText(ctx, `${summary.title} day`, W - PAD * 2), PAD, y + 150);
  ctx.fillStyle = C.accent;
  ctx.font = `700 32px ${FONT}`;
  ctx.fillText(summary.withBuddy ? 'With a training buddy' : 'Solo session', PAD, y + 204);
  y += titleH;

  // Stats strip
  const stats: Array<[string, string]> = [
    [String(rows.length), rows.length === 1 ? 'exercise' : 'exercises'],
    [String(summary.totalSets), 'sets'],
    [summary.totalVolumeKg.toLocaleString(), 'kg lifted'],
  ];
  const gap = 24;
  const statW = (W - PAD * 2 - gap * (stats.length - 1)) / stats.length;
  stats.forEach(([value, label], i) => {
    const x = PAD + i * (statW + gap);
    ctx.fillStyle = C.card;
    roundRect(ctx, x, y, statW, 116, 28);
    ctx.fill();
    ctx.fillStyle = C.white;
    ctx.font = `800 46px ${FONT}`;
    ctx.fillText(value, x + 28, y + 58);
    ctx.fillStyle = C.dim;
    ctx.font = `600 26px ${FONT}`;
    ctx.fillText(label, x + 28, y + 94);
  });
  y += statsH;

  // Exercise list
  y += 24;
  if (!rows.length) {
    ctx.fillStyle = C.muted;
    ctx.font = `600 34px ${FONT}`;
    ctx.fillText('No sets were ticked off in this session.', PAD, y + 60);
  }
  rows.forEach((row, i) => {
    const top = y + i * ROW_H;
    if (i > 0) {
      ctx.fillStyle = C.line;
      ctx.fillRect(PAD, top, W - PAD * 2, 2);
    }
    // right: top weight + sets
    ctx.textAlign = 'right';
    ctx.fillStyle = C.accent;
    ctx.font = `800 46px ${FONT}`;
    const weightText =
      row.topReps !== undefined ? `${formatKg(row.topKg)} × ${row.topReps}` : formatKg(row.topKg);
    ctx.fillText(weightText, W - PAD, top + 62);
    const rightW = ctx.measureText(weightText).width;
    ctx.fillStyle = C.dim;
    ctx.font = `600 28px ${FONT}`;
    ctx.fillText(`${row.sets} ${row.sets === 1 ? row.unit.slice(0, -1) : row.unit}`, W - PAD, top + 102);
    // left: label + name
    ctx.textAlign = 'left';
    ctx.fillStyle = C.dim;
    ctx.font = `700 24px ${FONT}`;
    ctx.fillText(row.label.toUpperCase(), PAD, top + 46);
    ctx.fillStyle = C.white;
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText(fitText(ctx, row.name, W - PAD * 2 - rightW - 40), PAD, top + 96);
  });
  y += listH - 24;

  // Footer
  ctx.fillStyle = C.line;
  ctx.fillRect(PAD, y, W - PAD * 2, 2);
  ctx.fillStyle = C.white;
  ctx.font = `800 32px ${FONT}`;
  ctx.fillText('BEAST MODE', PAD, y + 70);
  ctx.textAlign = 'right';
  ctx.fillStyle = C.accentDeep;
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText(APP_URL_LABEL, W - PAD, y + 70);
  ctx.textAlign = 'left';

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create image'))), 'image/png')
  );
}

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled';

/**
 * Opens the phone's share sheet (WhatsApp, Messenger, ...) with the image.
 * Where sharing files is not supported (most desktop browsers), the image
 * is downloaded instead.
 */
export async function shareSessionImage(summary: SessionSummary): Promise<ShareOutcome> {
  const blob = await renderSessionShareImage(summary);
  const day = summary.startedAt.slice(0, 10);
  const file = new File([blob], `beast-mode-${day}.png`, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'Beast Mode workout',
        text: `${summary.title} day done. ${APP_URL}`,
      });
      return 'shared';
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return 'cancelled';
      // fall through to download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}
