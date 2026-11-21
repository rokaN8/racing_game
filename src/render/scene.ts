// Plain coloured Track ribbon and lines, wireframe Bike. Bloom, Line2 edges, Light trail and grid floor: M5.
import {
  BoxGeometry, BufferGeometry, ConeGeometry, DoubleSide, EdgesGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, Scene, type Vector3,
} from 'three';
import type { Track } from '../track/bake';

export function createScene(T: Track) {
  const scene = new Scene();

  const verts: number[] = [], idx: number[] = [], edge: Vector3[] = [], rungs: Vector3[] = [];
  const lift = (v: Vector3, i: number) => v.clone().addScaledVector(T.up[i], 0.03);
  const L = (i: number) => T.pos[i].clone().addScaledVector(T.rgt[i], -T.halfWidth);
  const R = (i: number) => T.pos[i].clone().addScaledVector(T.rgt[i], T.halfWidth);
  for (let i = 0; i < T.N; i++) verts.push(...L(i).toArray(), ...R(i).toArray());
  for (let i = 0; i < T.N; i++) {
    const j = (i + 1) % T.N;
    idx.push(2 * i, 2 * j, 2 * i + 1, 2 * i + 1, 2 * j, 2 * j + 1);
    edge.push(lift(L(i), i), lift(L(j), j), lift(R(i), i), lift(R(j), j));
    if (i % 4 === 0) rungs.push(lift(L(i), i), lift(R(i), i));
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(verts, 3)); g.setIndex(idx);
  scene.add(new Mesh(g, new MeshBasicMaterial({ color: 0x0a0830, side: DoubleSide })));
  const lines = (pts: Vector3[], color: number) =>
    scene.add(new LineSegments(new BufferGeometry().setFromPoints(pts), new LineBasicMaterial({ color })));
  lines(edge, 0xff2bd6); lines(rungs, 0x0b5d6b);

  const bike = new Group();
  const body = new LineSegments(new EdgesGeometry(new BoxGeometry(0.7, 0.5, 2.2)), new LineBasicMaterial({ color: 0x00ffff }));
  body.position.y = 0.4;
  const nose = new Mesh(new ConeGeometry(0.3, 0.8, 4), new MeshBasicMaterial({ color: 0x00ffff }));
  nose.rotation.x = Math.PI / 2; nose.position.set(0, 0.4, 1.5);
  bike.add(body, nose); scene.add(bike);

  return { scene, bike };
}
