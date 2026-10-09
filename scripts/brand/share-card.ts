// The 1200 × 630 share card (Open Graph and Twitter) as a standalone HTML document that
// pnpm brand:assets screenshots: the lockup, the headline and one line on the left, three dark
// phone screens on the right running off the bottom edge.
import { markSvg } from "./mark";

export type ShareCardShots = { today: string; scan: string; workouts: string };

/** shots are image URLs (data URIs in practice). */
export function shareCardHtml(shots: ShareCardShots): string {
  const phone = (src: string, style: string) => `<div class="ph" style="${style}"><img src="${src}" alt=""></div>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;600;700&display=block" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1200px; height: 630px; overflow: hidden; position: relative; font-family: "Geist", system-ui, sans-serif;
    color: #EDF1E6; background: linear-gradient(180deg, #1B2312 0, #11140F 70%); -webkit-font-smoothing: antialiased; }
  .lock { position: absolute; left: 72px; top: 64px; display: flex; align-items: center; gap: 14px; font-size: 40px; font-weight: 700; letter-spacing: -0.045em; line-height: 1; }
  .lock svg { width: 52px; height: 52px; display: block; }
  .copy { position: absolute; left: 72px; top: 176px; display: flex; flex-direction: column; gap: 30px; }
  h1 { font-size: 84px; line-height: 1; letter-spacing: -0.048em; font-weight: 650; }
  h1 em { font-style: normal; color: #A6D84A; }
  p { font-size: 28px; line-height: 1.35; color: #9AA290; white-space: nowrap; letter-spacing: -0.006em; }
  .ph { position: absolute; border-radius: 46px; border: 9px solid #262C20; overflow: hidden; background: #11140F; box-shadow: 0 30px 70px rgb(0 0 0 / .55); }
  .ph img { width: 100%; display: block; }
</style>
</head>
<body>
  <div class="lock">${markSvg({ rounded: true }).replace("<rect ", `<rect stroke="rgba(255,255,255,.16)" `)}santul</div>
  <div class="copy">
    <h1>Eat well.<br>Train well.<br><em>Stay in balance.</em></h1>
    <p>Meals, workouts and weight in one place.</p>
  </div>
  ${phone(shots.scan, "width:232px;height:480px;left:694px;top:150px;transform:rotate(-7deg)")}
  ${phone(shots.workouts, "width:232px;height:480px;left:960px;top:150px;transform:rotate(7deg)")}
  ${phone(shots.today, "width:292px;height:604px;left:796px;top:70px")}
</body>
</html>`;
}
