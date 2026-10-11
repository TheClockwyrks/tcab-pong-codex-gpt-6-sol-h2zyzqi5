import { createCanvas } from "@napi-rs/canvas";
import { ConstantClock, createEngine } from "@clockwyrks/simple-2d";
import { describe, expect, it } from "vitest";
import {
  BALL_R,
  FIELD_CX,
  FIELD_CY,
  HOLD_TIME,
  P1_X1,
  SERVE_SPEED,
} from "./constants";
import { game } from "./game";

function harness(stepMs = 10) {
  const target = new EventTarget();
  const canvas = createCanvas(1280, 720) as unknown as HTMLCanvasElement;
  const engine = createEngine({
    canvas,
    width: 1280,
    height: 720,
    game,
    clock: new ConstantClock(stepMs),
    surface: {
      cssWidth: () => 1280,
      cssHeight: () => 720,
      dpr: () => 1,
      events: () => target,
    },
  });
  return { engine, target };
}

describe("Carom simulation", () => {
  it("starts, counts down, and serves toward the left without advancing on the serve frame", async () => {
    const { engine } = harness();
    await engine.initialize();
    const d = engine.debug;
    expect(d.snapshot(engine.state).screen).toBe("title");
    engine.apply((s) => d.setScreen(s, "countdown"));
    engine.apply((s) => d.setBallServeSign(s, -1));
    await engine.advance(100);
    const s = d.snapshot(engine.state);
    expect(s.screen).toBe("playing");
    expect(s.ball?.held).toBe(false);
    expect(s.ball?.x).toBe(FIELD_CX);
    expect(s.ball?.y).toBe(FIELD_CY);
    expect(Math.hypot(s.ball!.vx, s.ball!.vy)).toBeCloseTo(SERVE_SPEED);
    expect(s.ball!.vx).toBeLessThan(0);
    expect(s.ball!.vy).toBeLessThan(0);
    expect(s.simTime).toBeCloseTo(HOLD_TIME);
    engine.destroy();
  });

  it("adds paddle motion to spin and caps the ball outside the paddle", async () => {
    const { engine } = harness();
    await engine.initialize();
    const d = engine.debug;
    engine.apply((s) => d.setScreen(s, "playing"));
    engine.apply((s) => d.setPaddleDriven(s, "left", true));
    engine.apply((s) => d.setPaddleVy(s, "left", 200));
    engine.apply((s) => d.setBallHeld(s, false));
    engine.apply((s) => d.setBallPosition(s, P1_X1 + BALL_R + 2, FIELD_CY));
    engine.apply((s) => d.setBallVelocity(s, -520, 0));
    await engine.advance(1);
    const s = d.snapshot(engine.state);
    expect(s.ball!.vx).toBeGreaterThan(0);
    expect(s.ball!.spin).toBeGreaterThan(150);
    expect(s.ball!.x).toBeGreaterThanOrEqual(P1_X1 + BALL_R);
    expect(s.paddles.left.vy).toBe(200);
    engine.destroy();
  });

  it("scores across a goal and parks a fresh ball for the receiver", async () => {
    const { engine } = harness();
    await engine.initialize();
    const d = engine.debug;
    engine.apply((s) => d.setScreen(s, "playing"));
    engine.apply((s) => d.setBallHeld(s, false));
    engine.apply((s) => d.setBallPosition(s, 1280 + BALL_R + 1, 100));
    engine.apply((s) => d.setBallVelocity(s, 100, 0));
    await engine.advance(1);
    const s = d.snapshot(engine.state);
    expect(s.score.p1).toBe(1);
    expect(s.receiver).toBe("right");
    expect(s.screen).toBe("countdown");
    expect(s.ball?.held).toBe(true);
    expect(s.ball?.trail).toHaveLength(0);
    engine.destroy();
  });

  it("keeps a paused ball fixed and exposes independent debug poses", async () => {
    const { engine } = harness();
    await engine.initialize();
    const d = engine.debug;
    engine.apply((s) => d.setScreen(s, "paused"));
    engine.apply((s) => d.setBallPosition(s, 300, 400));
    engine.apply((s) => d.setBallVelocity(s, 200, 100));
    const before = d.snapshot(engine.state);
    await engine.advance(5);
    const after = d.snapshot(engine.state);
    expect(after.ball?.x).toBe(300);
    expect(after.ball?.y).toBe(400);
    expect(after.ball?.speed).toBeCloseTo(Math.hypot(200, 100));
    expect(after.simTime - before.simTime).toBeCloseTo(0.05);
    engine.apply((s) => d.clearWorld(s));
    expect(d.snapshot(engine.state).ball).toBeNull();
    expect(d.snapshot(engine.state).obstacles).toHaveLength(0);
    engine.destroy();
  });
});

describe("court events", () => {
  it("reflects from an obstacle without changing speed or removing spin", async () => {
    const { engine } = harness(2);
    await engine.initialize();
    const d = engine.debug;
    engine.apply((s) => d.setScreen(s, "playing"));
    engine.apply((s) => d.setBallHeld(s, false));
    engine.apply((s) => d.setBallPosition(s, 460, 220));
    engine.apply((s) => d.setBallVelocity(s, 520, 0));
    engine.apply((s) => d.setBallSpin(s, 100));
    await engine.advance(10);
    const b = d.snapshot(engine.state).ball!;
    expect(b.vx).toBeLessThan(0);
    expect(b.speed).toBeCloseTo(520, 4);
    expect(b.spin).toBeGreaterThan(0);
    engine.destroy();
  });

  it("ends only on a two-point lead and leaves the winning ball in place", async () => {
    const { engine } = harness();
    await engine.initialize();
    const d = engine.debug;
    engine.apply((s) => d.setScreen(s, "playing"));
    engine.apply((s) => d.setScore(s, 10, 10));
    engine.apply((s) => d.setBallHeld(s, false));
    engine.apply((s) => d.setBallPosition(s, 1280 + BALL_R + 1, 80));
    engine.apply((s) => d.setBallVelocity(s, 100, 0));
    await engine.advance(1);
    expect(d.snapshot(engine.state).screen).toBe("countdown");
    engine.apply((s) => d.setScreen(s, "playing"));
    engine.apply((s) => d.setBallHeld(s, false));
    engine.apply((s) => d.setBallPosition(s, 1280 + BALL_R + 1, 80));
    engine.apply((s) => d.setBallVelocity(s, 100, 0));
    await engine.advance(1);
    const s = d.snapshot(engine.state);
    expect(s.screen).toBe("matchover");
    expect(s.winner).toBe("left");
    expect(s.score.p1).toBe(12);
    expect(s.score.p2).toBe(10);
    expect(s.ball!.x).toBeGreaterThan(1280);
    expect(s.ball!.trail.length).toBeGreaterThan(0);
    engine.destroy();
  });
});
