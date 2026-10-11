import type {
  Game,
  InitApi,
  RenderApi,
  UpdateApi,
} from "@clockwyrks/simple-2d";
import type { DeepReadonly } from "ts-essentials";
import * as C from "./constants";

export type Screen =
  "title" | "howto" | "countdown" | "playing" | "paused" | "matchover";
export type Mode = "solo" | "versus";
export type Side = "left" | "right";
export interface PaddleState {
  readonly cy: number;
  readonly vy: number;
  readonly driven: boolean;
  readonly drivenVy: number;
}
export interface AiState {
  readonly tracking: boolean;
  readonly movement: boolean;
}
export interface TrailSample {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}
export interface BallState {
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  readonly spin: number;
  readonly held: boolean;
  readonly holdTimer: number;
  readonly serveSign: 1 | -1;
  readonly trail: readonly TrailSample[];
}
export interface ObstacleState {
  readonly index: number;
  readonly cx: number;
  readonly cy: number;
}
export interface CaromState {
  readonly screen: Screen;
  readonly mode: Mode;
  readonly menuIndex: number;
  readonly titleIndex: number;
  readonly resumeScreen: "countdown" | "playing";
  readonly score: { readonly p1: number; readonly p2: number };
  readonly winner: Side | null;
  readonly paddles: { readonly left: PaddleState; readonly right: PaddleState };
  readonly ai: AiState;
  readonly receiver: Side;
  readonly ball: BallState | null;
  readonly obstacles: readonly ObstacleState[];
  readonly simTime: number;
  readonly muted: boolean;
  /** Pointer down's menu item, needed to match a later release. */
  readonly menuPress: { readonly id: number; readonly index: number } | null;
}
export const BACKGROUND = "#080d1b";
type ReadState = DeepReadonly<CaromState>;
type Rect = { x: number; y: number; w: number; h: number };
type Snapshot = Omit<CaromState, "ball" | "menuPress"> & {
  version: number;
  ball: (BallState & { speed: number }) | null;
};
export interface CaromDebugApi {
  readonly version: number;
  clearWorld(s: ReadState): CaromState;
  spawnBall(s: ReadState): CaromState;
  spawnObstacle(s: ReadState, index: number): CaromState;
  reset(s: ReadState): CaromState;
  reconcile(s: ReadState): CaromState;
  setScreen(s: ReadState, v: Screen): CaromState;
  setMode(s: ReadState, v: Mode): CaromState;
  setMenuIndex(s: ReadState, v: number): CaromState;
  setTitleIndex(s: ReadState, v: number): CaromState;
  setResumeScreen(s: ReadState, v: "countdown" | "playing"): CaromState;
  setScore(s: ReadState, p1: number, p2: number): CaromState;
  setWinner(s: ReadState, v: Side | null): CaromState;
  setReceiver(s: ReadState, v: Side): CaromState;
  setPaddleCy(s: ReadState, side: Side, cy: number): CaromState;
  setPaddleVy(s: ReadState, side: Side, vy: number): CaromState;
  setPaddleDriven(s: ReadState, side: Side, driven: boolean): CaromState;
  setBallPosition(s: ReadState, x: number, y: number): CaromState;
  setBallVelocity(s: ReadState, vx: number, vy: number): CaromState;
  setBallSpin(s: ReadState, spin: number): CaromState;
  setBallHeld(s: ReadState, held: boolean): CaromState;
  setBallHoldTimer(s: ReadState, seconds: number): CaromState;
  setBallServeSign(s: ReadState, sign: 1 | -1): CaromState;
  drawBallServeSign(s: ReadState): CaromState;
  setAiTracking(s: ReadState, enabled: boolean): CaromState;
  setAiMovement(s: ReadState, enabled: boolean): CaromState;
  setMuted(s: ReadState, muted: boolean): CaromState;
  snapshot(s: ReadState): Snapshot;
  menuItemRect(s: ReadState, index: number): Rect | null;
}
const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));
const sign = (): 1 | -1 => (Math.random() < 0.5 ? 1 : -1);
const park = (): BallState => ({
  x: C.FIELD_CX,
  y: C.FIELD_CY,
  vx: 0,
  vy: 0,
  spin: 0,
  held: true,
  holdTimer: C.HOLD_TIME,
  serveSign: sign(),
  trail: [],
});
const obstacle = (index: number): ObstacleState => {
  const p = C.OBSTACLE_CENTERS[index];
  if (!p) throw new Error(`No obstacle ${index}`);
  return { index, cx: p.x, cy: p.y };
};
const paddle = (): PaddleState => ({
  cy: C.FIELD_CY,
  vy: 0,
  driven: false,
  drivenVy: 0,
});
const initial = (muted: boolean, titleIndex = 0, simTime = 0): CaromState => ({
  screen: "title",
  mode: "solo",
  menuIndex: titleIndex,
  titleIndex,
  resumeScreen: "playing",
  score: { p1: 0, p2: 0 },
  winner: null,
  paddles: { left: paddle(), right: paddle() },
  ai: { tracking: true, movement: true },
  receiver: "left",
  ball: park(),
  obstacles: [obstacle(0), obstacle(1)],
  simTime,
  muted,
  menuPress: null,
});
const start = (s: ReadState, mode: Mode): CaromState => ({
  ...s,
  screen: "countdown",
  mode,
  menuIndex: 0,
  resumeScreen: "playing",
  score: { p1: 0, p2: 0 },
  winner: null,
  receiver: "left",
  ball: park(),
  paddles: {
    left: { ...s.paddles.left, cy: C.FIELD_CY, vy: 0 },
    right: { ...s.paddles.right, cy: C.FIELD_CY, vy: 0 },
  },
  menuPress: null,
});
const retitle = (s: ReadState): CaromState =>
  initial(s.muted, s.titleIndex, s.simTime);
const withBall = (
  s: ReadState,
  change: (ball: DeepReadonly<BallState>) => BallState,
): CaromState => {
  if (!s.ball) throw new Error("No ball on the field");
  return { ...s, ball: change(s.ball) };
};
const withPaddle = (
  s: ReadState,
  side: Side,
  change: (p: DeepReadonly<PaddleState>) => PaddleState,
): CaromState => ({
  ...s,
  paddles: { ...s.paddles, [side]: change(s.paddles[side]) },
});
const items = (screen: Screen): readonly string[] =>
  screen === "title"
    ? C.TITLE_ITEMS
    : screen === "paused"
      ? C.PAUSE_ITEMS
      : screen === "matchover"
        ? C.MATCHOVER_ITEMS
        : screen === "howto"
          ? ["BACK TO MENU"]
          : [];
const itemRect = (s: ReadState, index: number): Rect | null => {
  const n = items(s.screen).length;
  if (index < 0 || index >= n || !Number.isInteger(index)) return null;
  const y0 =
    s.screen === "title"
      ? 420
      : s.screen === "howto"
        ? 578
        : s.screen === "paused"
          ? 388
          : 404;
  return { x: C.FIELD_CX - 185, y: y0 + index * 62, w: 370, h: 52 };
};
const hitItem = (s: ReadState, x: number, y: number): number => {
  for (let i = 0; i < items(s.screen).length; i++) {
    const r = itemRect(s, i)!;
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return i;
  }
  return -1;
};
const snapshot = (s: ReadState): Snapshot => ({
  version: C.CAROM_DEBUG_VERSION,
  screen: s.screen,
  mode: s.mode,
  menuIndex: s.menuIndex,
  titleIndex: s.titleIndex,
  resumeScreen: s.resumeScreen,
  score: { ...s.score },
  winner: s.winner,
  paddles: { left: { ...s.paddles.left }, right: { ...s.paddles.right } },
  ai: { ...s.ai },
  receiver: s.receiver,
  ball: s.ball
    ? {
        ...s.ball,
        trail: s.ball.trail.map((p) => ({ ...p })),
        speed: Math.hypot(s.ball.vx, s.ball.vy),
      }
    : null,
  obstacles: s.obstacles.map((o) => ({ ...o })),
  simTime: s.simTime,
  muted: s.muted,
});
const debugApi = (): CaromDebugApi => ({
  version: C.CAROM_DEBUG_VERSION,
  clearWorld: (s) => ({ ...s, ball: null, obstacles: [] }),
  spawnBall: (s) => ({ ...s, ball: park() }),
  spawnObstacle: (s, index) => ({
    ...s,
    obstacles: [
      ...s.obstacles.filter((o) => o.index !== index),
      obstacle(index),
    ].sort((a, b) => a.index - b.index),
  }),
  reset: (s) => initial(s.muted),
  reconcile: (s) => ({ ...s }),
  setScreen: (s, v) => ({ ...s, screen: v }),
  setMode: (s, v) => ({ ...s, mode: v }),
  setMenuIndex: (s, v) => ({ ...s, menuIndex: v }),
  setTitleIndex: (s, v) => ({ ...s, titleIndex: v }),
  setResumeScreen: (s, v) => ({ ...s, resumeScreen: v }),
  setScore: (s, p1, p2) => ({ ...s, score: { p1, p2 } }),
  setWinner: (s, v) => ({ ...s, winner: v }),
  setReceiver: (s, v) => ({ ...s, receiver: v }),
  setPaddleCy: (s, side, cy) => withPaddle(s, side, (p) => ({ ...p, cy })),
  setPaddleVy: (s, side, drivenVy) =>
    withPaddle(s, side, (p) => ({ ...p, drivenVy })),
  setPaddleDriven: (s, side, driven) =>
    withPaddle(s, side, (p) => ({ ...p, driven })),
  setBallPosition: (s, x, y) => withBall(s, (b) => ({ ...b, x, y })),
  setBallVelocity: (s, vx, vy) => withBall(s, (b) => ({ ...b, vx, vy })),
  setBallSpin: (s, spin) => withBall(s, (b) => ({ ...b, spin })),
  setBallHeld: (s, held) => withBall(s, (b) => ({ ...b, held })),
  setBallHoldTimer: (s, holdTimer) => withBall(s, (b) => ({ ...b, holdTimer })),
  setBallServeSign: (s, serveSign) => withBall(s, (b) => ({ ...b, serveSign })),
  drawBallServeSign: (s) => withBall(s, (b) => ({ ...b, serveSign: sign() })),
  setAiTracking: (s, tracking) => ({ ...s, ai: { ...s.ai, tracking } }),
  setAiMovement: (s, movement) => ({ ...s, ai: { ...s.ai, movement } }),
  setMuted: (s, muted) => ({ ...s, muted }),
  snapshot,
  menuItemRect: itemRect,
});

type CueFlags = { paddle: boolean; wall: boolean; obstacle: boolean };
type BallMutable = { -readonly [K in keyof BallState]: BallState[K] };
function collide(
  ball: BallMutable,
  rect: C.Rect,
  paddleSide: Side | null,
  paddleVy: number,
  paddleCy: number,
  cues: CueFlags,
): void {
  const x0 = rect.x0 - C.BALL_R,
    x1 = rect.x1 + C.BALL_R,
    y0 = rect.y0 - C.BALL_R,
    y1 = rect.y1 + C.BALL_R;
  if (!(ball.x > x0 && ball.x < x1 && ball.y > y0 && ball.y < y1)) return;
  const depths = [ball.x - x0, x1 - ball.x, ball.y - y0, y1 - ball.y];
  const face = depths.indexOf(Math.min(...depths));
  if (face === 0) ball.x = x0;
  else if (face === 1) ball.x = x1;
  else if (face === 2) ball.y = y0;
  else ball.y = y1;
  const into =
    face === 0
      ? ball.vx > 0
      : face === 1
        ? ball.vx < 0
        : face === 2
          ? ball.vy > 0
          : ball.vy < 0;
  if (!into) return;
  if (paddleSide && face < 2) {
    const theta =
      clamp((ball.y - paddleCy) / C.PADDLE_HALF, -1, 1) * C.MAX_BOUNCE_ANGLE;
    const speed = Math.min(
      Math.hypot(ball.vx, ball.vy) * C.SPEED_MULT,
      C.SPEED_CAP,
    );
    ball.vx = (paddleSide === "left" ? 1 : -1) * speed * Math.cos(theta);
    ball.vy = speed * Math.sin(theta);
    ball.spin = clamp(
      ball.spin + paddleVy * C.SPIN_FROM_PADDLE,
      -C.SPIN_CLAMP,
      C.SPIN_CLAMP,
    );
    ball.x = paddleSide === "left" ? C.P1_X1 + C.BALL_R : C.P2_X0 - C.BALL_R;
    cues.paddle = true;
  } else {
    if (face < 2) ball.vx = -ball.vx;
    else ball.vy = -ball.vy;
    if (paddleSide) cues.wall = true;
    else cues.obstacle = true;
  }
}
function advanceBall(
  source: DeepReadonly<BallState>,
  s: ReadState,
  dt: number,
  cues: CueFlags,
): BallState {
  const ball: BallMutable = { ...source, trail: source.trail };
  const n = Math.max(
    1,
    Math.ceil((Math.hypot(ball.vx, ball.vy) * dt) / C.MAX_SUBSTEP),
  );
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed > 0) {
      const a = (ball.spin / speed) * h,
        cs = Math.cos(a),
        sn = Math.sin(a);
      const vx = ball.vx * cs - ball.vy * sn;
      ball.vy = ball.vx * sn + ball.vy * cs;
      ball.vx = vx;
    }
    ball.spin *= Math.pow(0.5, h / C.SPIN_HALFLIFE);
    ball.x += ball.vx * h;
    ball.y += ball.vy * h;
    if (ball.y - C.BALL_R < 0 && ball.vy < 0) {
      ball.y = C.BALL_R;
      ball.vy = -ball.vy;
      cues.wall = true;
    } else if (ball.y + C.BALL_R > C.FIELD_H && ball.vy > 0) {
      ball.y = C.FIELD_H - C.BALL_R;
      ball.vy = -ball.vy;
      cues.wall = true;
    }
    collide(
      ball,
      {
        x0: C.P1_X0,
        x1: C.P1_X1,
        y0: s.paddles.left.cy - C.PADDLE_HALF,
        y1: s.paddles.left.cy + C.PADDLE_HALF,
      },
      "left",
      s.paddles.left.vy,
      s.paddles.left.cy,
      cues,
    );
    collide(
      ball,
      {
        x0: C.P2_X0,
        x1: C.P2_X1,
        y0: s.paddles.right.cy - C.PADDLE_HALF,
        y1: s.paddles.right.cy + C.PADDLE_HALF,
      },
      "right",
      s.paddles.right.vy,
      s.paddles.right.cy,
      cues,
    );
    for (const o of s.obstacles)
      collide(ball, C.OBSTACLES[o.index], null, 0, 0, cues);
  }
  return ball;
}
function movePaddle(
  p: DeepReadonly<PaddleState>,
  wantedVy: number,
  dt: number,
): PaddleState {
  const cy = clamp(p.cy + wantedVy * dt, C.PADDLE_MIN_CY, C.PADDLE_MAX_CY);
  return {
    ...p,
    cy,
    vy: dt > 0 && cy !== p.cy + wantedVy * dt ? (cy - p.cy) / dt : wantedVy,
  };
}
function confirm(s: ReadState): CaromState {
  if (s.screen === "title") {
    const chosen = { ...s, titleIndex: s.menuIndex };
    return s.menuIndex === 2
      ? { ...chosen, screen: "howto", menuIndex: 0 }
      : start(chosen, s.menuIndex === 1 ? "versus" : "solo");
  }
  if (s.screen === "howto") return retitle(s);
  if (s.screen === "paused")
    return s.menuIndex === 0
      ? { ...s, screen: s.resumeScreen }
      : s.menuIndex === 1
        ? start(s, s.mode)
        : retitle(s);
  if (s.screen === "matchover")
    return s.menuIndex === 0 ? start(s, s.mode) : retitle(s);
  return { ...s };
}
function menuInput(source: ReadState, api: UpdateApi): CaromState {
  let s: CaromState = { ...source };
  const screen = source.screen;
  const up = api.input.pressed("p1-up") || api.input.pressed("p2-up");
  const down = api.input.pressed("p1-down") || api.input.pressed("p2-down");
  const enter = api.input.pressed("confirm");
  const back = api.input.pressed("back");
  const pause = api.input.pressed("pause");
  if (screen === "countdown" || screen === "playing") {
    if (pause)
      s = {
        ...s,
        screen: "paused",
        resumeScreen: screen,
        menuIndex: 0,
        menuPress: null,
      };
  } else if (screen === "paused" && (pause || back)) {
    s = { ...s, screen: s.resumeScreen, menuPress: null };
  } else if (screen === "howto" && (enter || back)) {
    s = retitle(s);
  } else if (screen === "matchover" && back) {
    s = retitle(s);
  } else if (items(screen).length) {
    if (up || down)
      s = {
        ...s,
        menuIndex:
          (s.menuIndex + (up ? -1 : 1) + items(screen).length) %
          items(screen).length,
      };
    else if (enter) s = confirm(s);
  }
  // Pointer selection follows keyboard movement, while keyboard confirmation wins.
  if (!enter && items(screen).length && s.screen === screen) {
    const pointer = api.input.pointer();
    const hover = hitItem(s, pointer.x, pointer.y);
    if (hover >= 0 && pointer.device !== "touch")
      s = { ...s, menuIndex: hover };
    for (const sample of api.input.pointerSamples()) {
      if (sample.button !== "primary" && sample.type !== "move") continue;
      const index = hitItem(s, sample.x, sample.y);
      if (index >= 0) s = { ...s, menuIndex: index };
      if (sample.type === "down")
        s = { ...s, menuPress: index < 0 ? null : { id: sample.id, index } };
      if (sample.type === "up") {
        const ready =
          s.menuPress?.id === sample.id &&
          s.menuPress.index === index &&
          index >= 0;
        s = { ...s, menuPress: null };
        if (ready) {
          s = confirm({ ...s, menuIndex: index });
          break;
        }
      }
    }
  }
  return s;
}
export const game: Game<CaromState, CaromDebugApi> = {
  initialize(api: InitApi<CaromState>): [CaromState, CaromDebugApi] {
    for (const action of C.ACTIONS)
      api.input.register(action, { keys: [...C.BINDINGS[action]] });
    api.audio.define(C.CUES.paddleHit, {
      wave: "triangle",
      freq: 510,
      freqTo: 260,
      gain: 0.18,
      durationMs: 90,
    });
    api.audio.define(C.CUES.wallBounce, {
      wave: "sine",
      freq: 330,
      freqTo: 220,
      gain: 0.14,
      durationMs: 75,
    });
    api.audio.define(C.CUES.obstacleBounce, {
      wave: "square",
      freq: 210,
      freqTo: 130,
      gain: 0.1,
      durationMs: 95,
    });
    api.audio.define(C.CUES.score, {
      wave: "sine",
      freq: 640,
      freqTo: 920,
      gain: 0.2,
      durationMs: 240,
    });
    api.diagnostics.register("screen", (s) => s.screen);
    api.diagnostics.register("mode", (s) => s.mode);
    api.diagnostics.register("score", (s) => `${s.score.p1} : ${s.score.p2}`);
    api.diagnostics.register("ball pos", (s) =>
      s.ball ? `${s.ball.x.toFixed(1)}, ${s.ball.y.toFixed(1)}` : "none",
    );
    api.diagnostics.register("ball vel", (s) =>
      s.ball ? `${s.ball.vx.toFixed(1)}, ${s.ball.vy.toFixed(1)}` : "none",
    );
    api.diagnostics.register("ball speed", (s) =>
      s.ball ? Math.hypot(s.ball.vx, s.ball.vy).toFixed(1) : "none",
    );
    api.diagnostics.register("ball spin", (s) =>
      s.ball ? s.ball.spin.toFixed(1) : "none",
    );
    api.diagnostics.register(
      "left paddle",
      (s) => `${s.paddles.left.cy.toFixed(1)}, ${s.paddles.left.vy.toFixed(1)}`,
    );
    api.diagnostics.register(
      "right paddle",
      (s) =>
        `${s.paddles.right.cy.toFixed(1)}, ${s.paddles.right.vy.toFixed(1)}`,
    );
    return [initial(false), debugApi()];
  },
  update(source: ReadState, api: UpdateApi, dt: number): CaromState {
    // A debug pose changes the state's copy; synchronize the runtime before input.
    if (api.audio.muted() !== source.muted) api.audio.setMuted(source.muted);
    const muted = api.input.pressed("mute")
      ? !api.audio.muted()
      : api.audio.muted();
    api.audio.setMuted(muted);
    let s = menuInput({ ...source, simTime: source.simTime + dt, muted }, api);
    if (s.screen !== "countdown" && s.screen !== "playing") return s;
    const upLeft =
      api.input.value("p1-up") > 0 ||
      (s.mode === "solo" && api.input.value("p2-up") > 0);
    const downLeft =
      api.input.value("p1-down") > 0 ||
      (s.mode === "solo" && api.input.value("p2-down") > 0);
    const leftVy = s.paddles.left.driven
      ? s.paddles.left.drivenVy
      : (Number(downLeft) - Number(upLeft)) * C.PADDLE_SPEED;
    let rightVy: number;
    if (s.paddles.right.driven) rightVy = s.paddles.right.drivenVy;
    else if (s.mode === "versus")
      rightVy =
        (Number(api.input.value("p2-down") > 0) -
          Number(api.input.value("p2-up") > 0)) *
        C.PADDLE_SPEED;
    else {
      const defending =
        s.ai.tracking && s.screen === "playing" && !!s.ball && s.ball.vx > 0;
      const target =
        defending && s.ball ? s.ball.y - s.ball.vy * C.AI_REACT : C.AI_HOME_Y;
      const deadzone = defending ? C.AI_DEADZONE : C.AI_HOME_DEADZONE;
      const diff = target - s.paddles.right.cy;
      rightVy =
        !s.ai.movement || Math.abs(diff) <= deadzone || dt <= 0
          ? 0
          : Math.sign(diff) * Math.min(C.AI_SPEED, Math.abs(diff) / dt);
    }
    s = {
      ...s,
      paddles: {
        left: movePaddle(s.paddles.left, leftVy, dt),
        right: movePaddle(s.paddles.right, rightVy, dt),
      },
    };
    if (!s.ball) return s;
    let ball: BallState = s.ball;
    if (s.screen === "countdown") {
      const holdTimer = ball.holdTimer - dt;
      ball =
        holdTimer <= 0
          ? {
              ...ball,
              held: false,
              holdTimer: 0,
              trail: [],
              vx:
                (s.receiver === "left" ? -1 : 1) *
                C.SERVE_SPEED *
                Math.cos(C.SERVE_ANGLE),
              vy: ball.serveSign * C.SERVE_SPEED * Math.sin(C.SERVE_ANGLE),
            }
          : { ...ball, holdTimer };
      if (holdTimer <= 0) s = { ...s, screen: "playing" };
    } else if (!ball.held) {
      const cues: CueFlags = { paddle: false, wall: false, obstacle: false };
      ball = advanceBall(ball, s, dt, cues);
      if (cues.paddle) api.audio.play(C.CUES.paddleHit);
      if (cues.wall) api.audio.play(C.CUES.wallBounce);
      if (cues.obstacle) api.audio.play(C.CUES.obstacleBounce);
      const scorer: Side | null =
        ball.x - C.BALL_R > C.FIELD_W
          ? "left"
          : ball.x + C.BALL_R < 0
            ? "right"
            : null;
      if (scorer) {
        api.audio.play(C.CUES.score);
        const score = {
          p1: s.score.p1 + Number(scorer === "left"),
          p2: s.score.p2 + Number(scorer === "right"),
        };
        const won =
          scorer === "left"
            ? score.p1 >= C.WIN_SCORE && score.p1 - score.p2 >= C.WIN_LEAD
            : score.p2 >= C.WIN_SCORE && score.p2 - score.p1 >= C.WIN_LEAD;
        return {
          ...s,
          score,
          winner: won ? scorer : null,
          screen: won ? "matchover" : "countdown",
          menuIndex: won ? 0 : s.menuIndex,
          receiver: scorer === "left" ? "right" : "left",
          ball: won
            ? {
                ...ball,
                trail: [
                  ...ball.trail.filter((p) => s.simTime - p.t <= C.TRAIL_TIME),
                  { x: ball.x, y: ball.y, t: s.simTime },
                ],
              }
            : park(),
        };
      }
    }
    const trail = [
      ...ball.trail.filter((p) => s.simTime - p.t <= C.TRAIL_TIME),
      { x: ball.x, y: ball.y, t: s.simTime },
    ];
    return { ...s, ball: { ...ball, trail } };
  },
  render(s: ReadState, api: RenderApi): void {
    draw(s, api.ctx);
  },
};
function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  weight = 600,
): void {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x, y);
}
function menu(ctx: CanvasRenderingContext2D, s: ReadState): void {
  for (let i = 0; i < items(s.screen).length; i++) {
    const r = itemRect(s, i)!;
    const selected = i === s.menuIndex;
    if (selected) {
      ctx.shadowColor = "#40e7e3";
      ctx.shadowBlur = 22;
    }
    rounded(ctx, r.x, r.y, r.w, r.h, 12, selected ? "#27dad5" : "#1c2941");
    ctx.shadowBlur = 0;
    label(
      ctx,
      items(s.screen)[i],
      C.FIELD_CX,
      r.y + r.h / 2,
      20,
      selected ? "#071323" : "#d7e6f3",
      750,
    );
  }
}
function draw(s: ReadState, ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.fillStyle = BACKGROUND;
  ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
  // Fine court lines and symmetric goal glow establish the whole field even on menus.
  ctx.strokeStyle = "#253750";
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, C.FIELD_W - 48, C.FIELD_H - 48);
  ctx.strokeStyle = "#1a354d";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(C.FIELD_CX, C.FIELD_CY, 118, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([8, 14]);
  ctx.strokeStyle = "#2c4660";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(C.NET_X, 44);
  ctx.lineTo(C.NET_X, C.FIELD_H - 44);
  ctx.stroke();
  ctx.setLineDash([]);
  for (const side of ["left", "right"] as const) {
    const x = side === "left" ? C.P1_X0 : C.P2_X0,
      color = side === "left" ? "#40e7e3" : "#ff669c";
    const p = s.paddles[side];
    ctx.shadowColor = color;
    ctx.shadowBlur = 26;
    rounded(ctx, x, p.cy - C.PADDLE_HALF, C.PADDLE_W, C.PADDLE_H, 8, color);
    ctx.shadowBlur = 0;
  }
  for (const o of s.obstacles) {
    ctx.shadowColor = "#ffc268";
    ctx.shadowBlur = 20;
    rounded(
      ctx,
      o.cx - C.OBSTACLE_HW,
      o.cy - C.OBSTACLE_HH,
      C.OBSTACLE_W,
      C.OBSTACLE_HH * 2,
      10,
      "#f7b85b",
    );
    ctx.shadowBlur = 0;
  }
  if (s.ball) {
    const b = s.ball;
    for (let i = 0; i < b.trail.length; i++) {
      const p = b.trail[i];
      const a = clamp(1 - (s.simTime - p.t) / C.TRAIL_TIME, 0, 1);
      ctx.globalAlpha = a * 0.42;
      ctx.fillStyle = "#e9f8ff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(2, C.BALL_R * a), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.shadowColor = "#d8fbff";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "#f4fcff";
    ctx.beginPath();
    ctx.arc(b.x, b.y, C.BALL_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  if (s.screen !== "title" && s.screen !== "howto") {
    label(ctx, String(s.score.p1), C.FIELD_CX - 100, 68, 52, "#40e7e3", 800);
    label(ctx, String(s.score.p2), C.FIELD_CX + 100, 68, 52, "#ff669c", 800);
    label(
      ctx,
      s.mode === "solo" ? "SOLO / THE CIRCUIT" : "VERSUS / LOCAL DUEL",
      C.FIELD_CX,
      124,
      14,
      "#9ab3cb",
      750,
    );
    label(
      ctx,
      s.muted ? "SOUND OFF · M" : "M · SOUND",
      C.FIELD_W - 120,
      44,
      13,
      "#718aa5",
    );
  }
  if (s.screen === "countdown") {
    rounded(ctx, C.FIELD_CX - 134, 289, 268, 90, 18, "#142238");
    label(ctx, "READY", C.FIELD_CX, 317, 18, "#a3bbcf", 750);
    label(
      ctx,
      String(Math.max(1, Math.ceil(s.ball?.holdTimer ?? 0))),
      C.FIELD_CX,
      356,
      37,
      "#f4fcff",
      800,
    );
  }
  if (s.screen === "title") {
    ctx.fillStyle = "rgba(8,13,27,.70)";
    ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
    label(ctx, "A GAME OF ANGLES", C.FIELD_CX, 185, 17, "#40e7e3", 800);
    label(ctx, C.TITLE_TEXT, C.FIELD_CX, 275, 108, "#f3fbff", 900);
    label(
      ctx,
      "CURVE THE RALLY. OWN THE BANK.",
      C.FIELD_CX,
      352,
      18,
      "#9db3ca",
      650,
    );
    menu(ctx, s);
    label(
      ctx,
      "W / S   •   ↑ / ↓     MOVE        ENTER   SELECT",
      C.FIELD_CX,
      664,
      14,
      "#6f88a3",
    );
  } else if (s.screen === "howto") {
    ctx.fillStyle = "rgba(8,13,27,.88)";
    ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
    label(ctx, "HOW TO PLAY", C.FIELD_CX, 132, 55, "#f3fbff", 850);
    label(
      ctx,
      "W / S moves the left paddle. Arrow keys move the right paddle.",
      C.FIELD_CX,
      245,
      23,
      "#d4e6f3",
    );
    label(
      ctx,
      "In Solo, either set of keys moves your paddle against the AI.",
      C.FIELD_CX,
      290,
      21,
      "#9fb8cd",
    );
    label(
      ctx,
      "Strike while moving to spin the ball and bend its flight.",
      C.FIELD_CX,
      370,
      23,
      "#40e7e3",
    );
    label(
      ctx,
      "Bank off the amber obstacles. First to 11, win by 2.",
      C.FIELD_CX,
      415,
      23,
      "#ffc268",
    );
    label(ctx, "P / ESC pauses       M mutes", C.FIELD_CX, 480, 18, "#91a9bf");
    menu(ctx, s);
  } else if (s.screen === "paused" || s.screen === "matchover") {
    ctx.fillStyle = "rgba(8,13,27,.82)";
    ctx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
    label(
      ctx,
      s.screen === "paused"
        ? "PAUSED"
        : s.winner === "left"
          ? "LEFT SIDE WINS"
          : "RIGHT SIDE WINS",
      C.FIELD_CX,
      228,
      62,
      "#f3fbff",
      850,
    );
    label(
      ctx,
      s.screen === "paused"
        ? "TAKE YOUR LINE"
        : `${s.score.p1}  —  ${s.score.p2}`,
      C.FIELD_CX,
      302,
      25,
      s.screen === "paused" ? "#9fb8cd" : "#ffc268",
      700,
    );
    menu(ctx, s);
  }
  ctx.restore();
}
