// Finish cam and Speed feel (docs/game-spec.md → Finish cam, Speed feel; ticket #83): the camera's orbit after the
// line and the colour split, headless.
import { Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { createChaseCamera, ORBIT } from '../src/camera';
import { createSpeedFeel } from '../src/render/speedFeel';
import { bakeTrack } from '../src/track/bake';
import { overdrive } from '../src/track/tracks/allround';
import { newState } from '../src/bike/physics';

const T = bakeTrack(overdrive);

describe('Finish cam', () => {
  it('eases from where Chase was into an orbit R m out and H m up, then keeps circling', () => {
    const { camera, update, orbit } = createChaseCamera(), st = newState(T);
    update(st, st.quat, 1 / 60, true);
    const chase = camera.position.clone();
    orbit(st, 0, false);
    expect(camera.position.distanceTo(chase)).toBeLessThan(1e-9); // no jump on the first frame
    for (let t = 0; t < ORBIT.BLEND; t += 1 / 60) orbit(st, 1 / 60, false);
    const flat = Math.hypot(camera.position.x - st.pos.x, camera.position.z - st.pos.z);
    expect(flat).toBeCloseTo(ORBIT.R, 1);
    expect(camera.position.y - st.pos.y).toBeCloseTo(ORBIT.H, 1);
    const p = camera.position.clone();
    orbit(st, 1, false);
    expect(camera.position.distanceTo(p)).toBeCloseTo(2 * ORBIT.R * Math.sin(ORBIT.RATE / 2), 1); // ORBIT.RATE rad in 1 s
  });

  it('holds still under reduced motion, and a chase update (Retry) ends it', () => {
    const { camera, update, orbit } = createChaseCamera(), st = newState(T);
    update(st, st.quat, 1 / 60, true);
    const chase = camera.position.clone();
    for (let i = 0; i < 120; i++) orbit(st, 1 / 60, true);
    expect(camera.position.distanceTo(chase)).toBeLessThan(1e-9);
    for (let i = 0; i < 120; i++) orbit(st, 1 / 60, false);
    update(st, st.quat, 1 / 60, true);
    expect(camera.position.distanceTo(chase)).toBeLessThan(1e-9);
  });
});

describe('Speed feel', () => {
  it('splits colours only while Boosting near Boost top speed, and never under reduced motion', () => {
    const scene = new Scene(), { camera } = createChaseCamera(), st = newState(T), feel = createSpeedFeel();
    st.speed = 75;
    expect(feel.update(scene, camera, st, 1 / 60, null, false)).toBe(0); // not Boosting
    st.boostT = 99;
    let split = 0;
    for (let i = 0; i < 120; i++) split = feel.update(scene, camera, st, 1 / 60, null, false);
    expect(split).toBeGreaterThan(0.002);
    expect(feel.update(scene, camera, st, 1 / 60, null, true)).toBe(0);
    st.speed = 55;
    expect(feel.update(scene, camera, st, 1 / 60, null, false)).toBe(0); // under 60 m/s
  });
});
