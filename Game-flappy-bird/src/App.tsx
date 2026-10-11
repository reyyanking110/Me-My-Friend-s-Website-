import { useEffect, useRef, useState } from 'react';
import './index.css';

type Phase = 'ready' | 'playing' | 'paused' | 'over';
type Pipe = { x: number; gap: number; passed: boolean };
type Particle = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string };
type ScoreEntry = { score: number; date: string; id: number };
const W = 480, H = 640, FLOOR = 574, BIRD_X = 132, STORAGE = 'flappy-club-scores-v1';

function loadScores(): ScoreEntry[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE) || '[]');
    return Array.isArray(value) ? value.filter((item) => typeof item.score === 'number' && typeof item.date === 'string').slice(0, 5) : [];
  } catch { return []; }
}

function Icon({ name, size = 20 }: { name: 'sound' | 'mute' | 'pause' | 'play' | 'arrow' | 'refresh'; size?: number }) {
  const paths = {
    sound: <><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="M15 9a5 5 0 0 1 0 6M18 6a9 9 0 0 1 0 12" /></>,
    mute: <><path d="M11 5 6 9H3v6h3l5 4V5Z" /><path d="m16 9 5 6m0-6-5 6" /></>,
    pause: <><path d="M8 5v14M16 5v14" /></>, play: <path d="m8 5 11 7-11 7V5Z" />,
    arrow: <><path d="M4 12h15m-6-6 6 6-6 6" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4.8 16a8 8 0 0 0 14-3M19.2 8a8 8 0 0 0-14 3M4 17v-5h5" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
}
function cloud(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, alpha: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha = alpha; ctx.fillStyle = '#fff9df';
  ctx.beginPath(); ctx.ellipse(-27, 8, 29, 11, 0, 0, 7); ctx.ellipse(-6, -1, 25, 19, 0, 0, 7); ctx.ellipse(21, 7, 31, 13, 0, 0, 7); ctx.fill(); ctx.restore();
}
function background(ctx: CanvasRenderingContext2D, t: number, scroll: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, FLOOR);
  sky.addColorStop(0, '#83d8cd'); sky.addColorStop(.54, '#bce8cf'); sky.addColorStop(1, '#f9df9c');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff0b9'; ctx.beginPath(); ctx.arc(363, 172, 65, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffe5a2'; ctx.beginPath(); ctx.arc(363, 172, 51, 0, 7); ctx.fill();
  const c = t * 10 % 620;
  cloud(ctx, 75 - c, 109, 1.16, .72); cloud(ctx, 695 - c, 109, 1.16, .72);
  cloud(ctx, 305 - c * .68, 64, .65, .62); cloud(ctx, 700 - c * .68, 64, .65, .62);
  cloud(ctx, 470 - c * 1.2, 280, .87, .48); cloud(ctx, 624 - c * 1.2, 280, .87, .48);
  // Hills scroll slower than the pipes for a soft parallax effect.
  ctx.fillStyle = '#91cdb3'; ctx.beginPath(); ctx.moveTo(0, 438);
  for (let x = 0; x <= W + 10; x += 8) ctx.lineTo(x, 424 + Math.sin((x + scroll * .16) / 72) * 23 + Math.sin((x + scroll * .16) / 31) * 7);
  ctx.lineTo(W, FLOOR); ctx.lineTo(0, FLOOR); ctx.fill();
  ctx.fillStyle = '#5eac9b'; ctx.beginPath(); ctx.moveTo(0, 492);
  for (let x = 0; x <= W + 10; x += 8) ctx.lineTo(x, 488 + Math.sin((x + scroll * .34) / 55) * 20 + Math.sin((x + scroll * .34) / 23) * 5);
  ctx.lineTo(W, FLOOR); ctx.lineTo(0, FLOOR); ctx.fill();
  ctx.fillStyle = '#4b9487';
  for (let i = 0; i < 11; i++) {
    const x = ((i * 77 - scroll * .48) % 760 + 760) % 760 - 100, y = 516 + Math.sin(i * 4) * 12;
    ctx.beginPath(); ctx.arc(x, y, 18 + i % 3 * 7, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 18, y + 5, 15, 0, 7); ctx.fill();
  }
}
function drawPipe(ctx: CanvasRenderingContext2D, x: number, gap: number, gapSize: number) {
  const top = gap - gapSize / 2, bottom = gap + gapSize / 2;
  const body = (y: number, height: number) => {
    ctx.fillStyle = '#1c625c'; ctx.fillRect(x + 4, y, 76, height);
    ctx.fillStyle = '#327f72'; ctx.fillRect(x + 4, y, 69, height);
    ctx.fillStyle = '#60b097'; ctx.fillRect(x + 12, y, 9, height);
    ctx.fillStyle = '#276f65'; ctx.fillRect(x + 56, y, 7, height);
  };
  body(0, top); body(bottom, FLOOR - bottom);
  const rim = (y: number) => {
    rect(ctx, x - 4, y + 5, 88, 28, 5, '#1c625c'); rect(ctx, x - 4, y, 84, 27, 5, '#327f72');
    rect(ctx, x + 5, y + 4, 9, 19, 3, '#60b097');
    ctx.fillStyle = '#286b62'; ctx.fillRect(x + 69, y + 4, 4, 19);
    ctx.fillStyle = '#83c3a3'; ctx.fillRect(x + 18, y + 4, 36, 2);
  };
  rim(top - 27); rim(bottom);
}
function ground(ctx: CanvasRenderingContext2D, scroll: number) {
  ctx.fillStyle = '#266c5f'; ctx.fillRect(0, FLOOR, W, 7);
  ctx.fillStyle = '#a4cf83'; ctx.fillRect(0, FLOOR + 7, W, 9);
  ctx.fillStyle = '#eac17a'; ctx.fillRect(0, FLOOR + 16, W, H - FLOOR - 16);
  ctx.fillStyle = '#d8a965'; ctx.fillRect(0, FLOOR + 29, W, 4);
  for (let x = -42 - scroll % 42; x < W + 42; x += 42) {
    rect(ctx, x + 12, FLOOR + 25, 18, 4, 2, '#c98f58'); rect(ctx, x + 33, FLOOR + 48, 12, 4, 2, '#c98f58');
    ctx.fillStyle = '#f7d498'; ctx.fillRect(x + 3, FLOOR + 18, 2, 4);
  }
}
function bird(ctx: CanvasRenderingContext2D, y: number, velocity: number, t: number, idle: boolean) {
  ctx.save(); ctx.translate(BIRD_X, y);
  ctx.rotate(idle ? Math.sin(t * 2.8) * .07 : Math.max(-.4, Math.min(1.05, velocity / 580)));
  ctx.shadowColor = 'rgba(59, 77, 63, .24)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#d78b38'; ctx.beginPath(); ctx.ellipse(0, 1, 21, 18, 0, 0, 7); ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = '#ffce63'; ctx.beginPath(); ctx.ellipse(-1, -2, 20, 17, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffe49b'; ctx.beginPath(); ctx.ellipse(-7, -8, 9, 6, -.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#ef9d44'; ctx.beginPath(); ctx.ellipse(-9, 6 + Math.sin(t * (idle ? 10 : 24)) * 5, 11, 7, -.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff9e8'; ctx.beginPath(); ctx.arc(9, -7, 6.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#253b45'; ctx.beginPath(); ctx.arc(11, -7, 2.7, 0, 7); ctx.fill();
  ctx.fillStyle = '#e87849'; ctx.beginPath(); ctx.moveTo(16, 1); ctx.lineTo(31, 5); ctx.lineTo(16, 9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#f8a457'; ctx.beginPath(); ctx.moveTo(17, 1); ctx.lineTo(29, 5); ctx.lineTo(17, 5); ctx.closePath(); ctx.fill(); ctx.restore();
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const actionRef = useRef<(action: 'flap' | 'pause' | 'restart') => void>(() => {});
  const soundRef = useRef(true);
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [scores, setScores] = useState<ScoreEntry[]>(loadScores);
  const [soundOn, setSoundOn] = useState(true);
  const best = scores[0]?.score ?? 0;

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = W * dpr; canvas.height = H * dpr; ctx.scale(dpr, dpr);
    let current: Phase = 'ready', birdY = 310, velocity = 0, points = 0;
    let pipes: Pipe[] = [{ x: 530, gap: 305, passed: false }, { x: 805, gap: 340, passed: false }];
    let particles: Particle[] = [], scroll = 0, time = 0, shake = 0, flash = 0, lastFrame = 0, frame = 0;
    let audio: AudioContext | null = null;

    function sound(kind: 'flap' | 'score' | 'hit') {
      if (!soundRef.current) return;
      try {
        audio ??= new AudioContext();
        if (audio.state === 'suspended') void audio.resume();
        const now = audio.currentTime, osc = audio.createOscillator(), gain = audio.createGain();
        osc.type = kind === 'hit' ? 'triangle' : 'sine';
        const start = kind === 'flap' ? 530 : kind === 'score' ? 670 : 210;
        osc.frequency.setValueAtTime(start, now);
        osc.frequency.exponentialRampToValueAtTime(kind === 'hit' ? 75 : start * 1.5, now + (kind === 'hit' ? .22 : .12));
        gain.gain.setValueAtTime(.0001, now);
        gain.gain.exponentialRampToValueAtTime(kind === 'hit' ? .11 : .075, now + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, now + (kind === 'hit' ? .25 : .17));
        osc.connect(gain); gain.connect(audio.destination); osc.start(now); osc.stop(now + .27);
      } catch { /* Sound is optional when browser audio is unavailable. */ }
    }
    function burst(x: number, y: number, count: number, colors: string[], power: number) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2, speed = (.35 + Math.random() * .65) * power, life = .35 + Math.random() * .45;
        particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life, max: life, size: 2 + Math.random() * 4, color: colors[i % colors.length] });
      }
    }
    function flap() { velocity = -330; burst(BIRD_X - 13, birdY + 10, 7, ['#fff5c8', '#ffcb66', '#f7a052'], 90); sound('flap'); }
    function start() {
      birdY = 310; velocity = 0; points = 0; pipes = [{ x: 530, gap: 305, passed: false }, { x: 805, gap: 340, passed: false }];
      particles = []; scroll = 0; shake = 0; flash = 0; current = 'playing'; setScore(0); setPhase('playing'); flap();
    }
    function end() {
      if (current !== 'playing') return;
      current = 'over'; shake = 11; flash = .34;
      burst(BIRD_X, birdY, 23, ['#ffdc75', '#ffffff', '#f08a52', '#295c5b'], 190); sound('hit'); setPhase('over');
      const entry = { score: points, date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), id: Date.now() };
      setScores((previous) => {
        const next = [...previous, entry].sort((a, b) => b.score - a.score || b.id - a.id).slice(0, 5);
        try { localStorage.setItem(STORAGE, JSON.stringify(next)); } catch { /* Storage can be disabled in private browsing. */ }
        return next;
      });
    }
    actionRef.current = (action) => {
      if (action === 'restart') { start(); return; }
      if (action === 'pause') {
        if (current === 'playing') { current = 'paused'; setPhase('paused'); }
        else if (current === 'paused') { current = 'playing'; setPhase('playing'); }
        return;
      }
      if (current === 'ready' || current === 'over') start();
      else if (current === 'paused') { current = 'playing'; setPhase('playing'); }
      else flap();
    };
    function keydown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if ([' ', 'arrowup', 'w', 'enter'].includes(key)) { event.preventDefault(); if (!event.repeat) actionRef.current('flap'); }
      else if (key === 'escape' || key === 'p') { event.preventDefault(); if (!event.repeat) actionRef.current('pause'); }
      else if (key === 'r') { event.preventDefault(); if (!event.repeat) actionRef.current('restart'); }
    }
    function visibility() { if (document.hidden && current === 'playing') actionRef.current('pause'); }
    window.addEventListener('keydown', keydown); document.addEventListener('visibilitychange', visibility);

    function tick(timestamp: number) {
      const dt = Math.min((timestamp - (lastFrame || timestamp)) / 1000, .033);
      lastFrame = timestamp;
      if (current !== 'paused') {
        time += dt;
        if (current !== 'over') scroll += dt * (current === 'playing' ? 175 + Math.min(points * 3, 65) : 25);
        if (current === 'playing') {
          velocity = Math.min(velocity + 950 * dt, 580); birdY += velocity * dt;
          const speed = 175 + Math.min(points * 3, 65);
          for (const pipe of pipes) {
            pipe.x -= speed * dt;
            const gapSize = Math.max(155, 185 - points * 1.5);
            if (!pipe.passed && pipe.x + 76 < BIRD_X - 13) {
              pipe.passed = true; points++; setScore(points);
              burst(BIRD_X, birdY, 16, ['#fff9db', '#ffd96d', '#f1a74b'], 155); shake = 2.5; sound('score');
            }
            if (BIRD_X + 14 > pipe.x + 4 && BIRD_X - 14 < pipe.x + 76 && (birdY - 13 < pipe.gap - gapSize / 2 || birdY + 13 > pipe.gap + gapSize / 2)) end();
          }
          if (birdY - 15 < 0 || birdY + 15 >= FLOOR) end();
          if (pipes[0].x < -100) pipes.shift();
          if (pipes[pipes.length - 1].x < 270) {
            const previous = pipes[pipes.length - 1].gap;
            pipes.push({ x: pipes[pipes.length - 1].x + 265, gap: Math.max(172, Math.min(400, previous + (Math.random() - .5) * 150)), passed: false });
          }
        }
        particles = particles.filter((p) => p.life > 0);
        for (const p of particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 280 * dt; p.life -= dt; }
        shake = Math.max(0, shake - dt * 30); flash = Math.max(0, flash - dt * 1.5);
      }
      ctx!.clearRect(0, 0, W, H); ctx!.save();
      if (shake > 0) ctx!.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
      background(ctx!, time, scroll);
      for (const pipe of pipes) drawPipe(ctx!, pipe.x, pipe.gap, Math.max(155, 185 - points * 1.5));
      ground(ctx!, scroll);
      bird(ctx!, current === 'ready' ? birdY + Math.sin(time * 3) * 8 : birdY, velocity, time, current === 'ready');
      for (const p of particles) { ctx!.globalAlpha = Math.max(0, p.life / p.max); rect(ctx!, p.x, p.y, p.size, p.size, 1, p.color); }
      ctx!.globalAlpha = 1; ctx!.restore();
      if (flash > 0) { ctx!.fillStyle = `rgba(255, 247, 210, ${flash})`; ctx!.fillRect(0, 0, W, H); }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('keydown', keydown); document.removeEventListener('visibilitychange', visibility); if (audio) void audio.close(); };
  }, []);

  return <div className="app-shell">
    <header className="site-header"><div className="header-inner">
      <div className="brand-lockup"><span className="brand-symbol" aria-hidden="true"><span className="brand-eye" /></span><span>FLAPPY<span className="brand-dot">.</span>CLUB</span></div>
      <span className="header-center">A LITTLE GAME ABOUT GOING UP</span>
      <button className="sound-button" onClick={() => setSoundOn((value) => { soundRef.current = !value; return !value; })} aria-label={soundOn ? 'Mute sound' : 'Enable sound'} title={soundOn ? 'Mute sound' : 'Enable sound'}><Icon name={soundOn ? 'sound' : 'mute'} size={19} /><span>SOUND {soundOn ? 'ON' : 'OFF'}</span></button>
    </div></header>
    <main className="main-layout">
      <section className="intro-panel" aria-label="Game introduction">
        <div className="intro-top"><span className="eyebrow"><span className="eyebrow-line" /> THE ORIGINAL ONE-MORE-TRY GAME</span><h1>FLAPPY<br /><span>BIRD.</span></h1><p>Little wings. Big dreams. How far can you fly?</p></div>
        <div className="desktop-instructions"><span className="section-kicker">HOW TO PLAY</span><div className="instruction-row"><span className="keycap">SPACE</span><span>or tap anywhere to flap</span></div><div className="instruction-row"><span className="keycap">P</span><span>to take a breather</span></div><div className="instruction-row"><span className="keycap">R</span><span>for a fresh start</span></div></div>
        <span className="intro-footer">MADE FOR THE JUST-ONE-MORE CROWD <span aria-hidden="true">*</span></span>
      </section>
      <section className="game-column" aria-label="Flappy Bird game">
        <div className="game-topline"><span><span className="live-dot" /> THE PLAYGROUND</span><span>NO. 001 / ENDLESS</span></div>
        <div className="game-frame"><div className="game-stage" onPointerDown={(event) => { if (event.target === event.currentTarget || event.target === canvasRef.current) actionRef.current('flap'); }}>
          <canvas ref={canvasRef} className="game-canvas" aria-label="Flappy Bird play area. Tap or press space to flap." />
          {phase === 'playing' && <div className="playing-hud"><div className="score-display"><span>SCORE</span><strong key={score}>{score}</strong></div><button className="pause-button" onPointerDown={(event) => event.stopPropagation()} onClick={() => actionRef.current('pause')} aria-label="Pause game"><Icon name="pause" size={19} /></button></div>}
          {phase === 'ready' && <div className="state-layer ready-layer"><div className="ready-copy"><span className="game-eyebrow">YOUR ADVENTURE STARTS HERE</span><h2>Ready to<br />take flight?</h2><p>Find your rhythm. Dodge the pipes.</p></div><div className="ready-bottom"><button className="primary-button" onPointerDown={(event) => event.stopPropagation()} onClick={() => actionRef.current('flap')}>LET'S FLY <Icon name="arrow" size={20} /></button><span>TAP OR PRESS SPACE TO START</span></div></div>}
          {phase === 'paused' && <div className="state-layer dim-layer" onPointerDown={() => actionRef.current('pause')}><div className="center-state"><span className="game-eyebrow">TAKE YOUR TIME</span><h2>Paused<span className="accent-period">.</span></h2><p>Even little birds need a break.</p><button className="primary-button" onPointerDown={(event) => event.stopPropagation()} onClick={() => actionRef.current('pause')}>KEEP FLYING <Icon name="play" size={18} /></button><span className="state-hint">PRESS SPACE OR P TO RESUME</span></div></div>}
          {phase === 'over' && <div className="state-layer dim-layer" onPointerDown={() => actionRef.current('restart')}><div className="center-state over-state"><span className="game-eyebrow">NICE FLIGHT!</span><h2>Oopsie<span className="accent-period">.</span></h2><p>Every great flight starts with a little fall.</p><div className="result-line"><div><span>YOUR SCORE</span><strong>{score}</strong></div><span className="result-divider" /><div><span>BEST SCORE</span><strong>{Math.max(score, best)}</strong></div></div><button className="primary-button" onPointerDown={(event) => event.stopPropagation()} onClick={() => actionRef.current('restart')}>TRY AGAIN <Icon name="refresh" size={19} /></button><span className="state-hint">TAP OR PRESS SPACE TO RESTART</span></div></div>}
        </div></div>
        <div className="game-bottomline"><span>FLAP. FLY. REPEAT.</span><span>GOOD LUCK OUT THERE <span className="tiny-spark">*</span></span></div>
      </section>
      <aside className="scores-panel" aria-label="Local high scores"><div className="scores-heading"><span className="section-kicker">THE LEADERBOARD</span><span className="score-star" aria-hidden="true">*</span></div><h2>Little<br />legends<span>.</span></h2><p>Your best flights live right here, on this device.</p><div className="best-score"><span>PERSONAL BEST</span><strong>{String(best).padStart(3, '0')}</strong></div><div className="score-list-heading"><span>RANK / SCORE</span><span>DATE</span></div><ol className="score-list">{Array.from({ length: 5 }, (_, index) => { const entry = scores[index]; return <li key={entry?.id ?? `empty-${index}`} className={!entry ? 'empty-score' : ''}><span className="rank">{String(index + 1).padStart(2, '0')}</span><strong>{entry ? String(entry.score).padStart(3, '0') : '---'}</strong><span className="score-date">{entry?.date ?? '--'}</span></li>; })}</ol><div className="scores-footnote">NO PRESSURE. JUST ONE MORE TRY. <span>^</span></div></aside>
    </main>
    <footer className="site-footer"><span>(C) FLAPPY CLUB</span><span>BUILT FOR BIG DREAMS &amp; TINY WINGS</span><span>EST. 2026</span></footer>
  </div>;
}