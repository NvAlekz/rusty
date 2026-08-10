import assert from 'node:assert/strict';
import test from 'node:test';
import { RAID_METHOD_BY_ID, RAID_METHODS, RAID_TARGET_BY_ID } from '../data/raidData.js';
import {
  calculateCustomRaidPlan,
  calculateFastestCombo,
  calculateFinishRecommendation,
  calculateSingleMethodCost,
  getMethodDamagePerUse,
  getSupportedMethods,
  targetSupportsSoftSide,
} from './raidCalculator.js';

function plan(targetId, methodId, options = {}) {
  return calculateSingleMethodCost(
    RAID_TARGET_BY_ID[targetId],
    RAID_METHOD_BY_ID[methodId],
    options
  );
}

test('known garage door raid counts match current vanilla references', () => {
  assert.equal(plan('garage-door', 'c4').items[0].amount, 2);
  assert.equal(plan('garage-door', 'rocket').items[0].amount, 3);
  assert.equal(plan('garage-door', 'satchel').items[0].amount, 9);
  assert.equal(plan('garage-door', 'explosive-556').items[0].amount, 150);
});

test('known wall and sheet door counts match reference examples', () => {
  assert.equal(plan('stone-wall', 'c4').items[0].amount, 2);
  assert.equal(plan('stone-wall', 'rocket').items[0].amount, 4);
  assert.equal(plan('sheet-metal-door', 'c4').items[0].amount, 1);
  assert.equal(plan('sheet-metal-door', 'satchel').items[0].amount, 4);
});

test('material totals multiply by target quantity', () => {
  const result = plan('garage-door', 'c4', { quantity: 2 });

  assert.equal(result.items[0].amount, 4);
  assert.equal(result.materials.sulfur, 8800);
  assert.equal(result.materials.techTrash, 8);
});

test('ammo recipe yield rounds crafting batches upward', () => {
  const oddAmmo = plan('sheet-metal-door', 'explosive-556');
  assert.equal(oddAmmo.items[0].amount, 63);
  assert.equal(oddAmmo.items[0].craftedAmount, 64);
  assert.equal(oddAmmo.items[0].craftBatches, 32);
  assert.equal(oddAmmo.materials.sulfur, 1600);

  const evenAmmo = plan('garage-door', 'explosive-556');
  assert.equal(evenAmmo.items[0].amount, 150);
  assert.equal(evenAmmo.items[0].craftedAmount, 150);
  assert.equal(evenAmmo.items[0].craftBatches, 75);
  assert.equal(evenAmmo.materials.sulfur, 3750);
});

test('fastest combo ranking is no slower than the fastest single method', () => {
  const target = RAID_TARGET_BY_ID['garage-door'];
  const combo = calculateFastestCombo(target, RAID_METHODS);
  const singles = getSupportedMethods(target, RAID_METHODS).map((method) =>
    calculateSingleMethodCost(target, method)
  );
  const fastestSingle = singles.sort((a, b) => a.timeSeconds - b.timeSeconds)[0];

  assert.ok(combo.timeSeconds <= fastestSingle.timeSeconds);
});

test('soft side support is exposed only for compatible targets', () => {
  assert.equal(targetSupportsSoftSide(RAID_TARGET_BY_ID['stone-wall']), true);
  assert.equal(targetSupportsSoftSide(RAID_TARGET_BY_ID['garage-door']), false);
});

test('finish recommendation drops a unit of the selected method when a finisher is cheaper', () => {
  const target = RAID_TARGET_BY_ID['garage-door'];
  const bullets = RAID_METHOD_BY_ID['explosive-556'];
  const fullPlan = calculateSingleMethodCost(target, bullets);
  const recommendation = calculateFinishRecommendation(target, bullets, RAID_METHODS);

  assert.ok(recommendation, 'no recommendation found for garage door bullets');
  assert.ok(recommendation.plan.isMixed);
  assert.ok(recommendation.plan.items.some((item) => item.method.id === 'explosive-556'));
  assert.ok(recommendation.plan.items.some((item) => item.method.id === 'c4'));
  assert.ok(recommendation.plan.items[0].amount < fullPlan.items[0].amount);
  assert.ok(recommendation.plan.sulfur < fullPlan.sulfur);
});

test('finish recommendation is never worse than the finisher alone', () => {
  const target = RAID_TARGET_BY_ID['sheet-metal-wall'];
  const satchel = RAID_METHOD_BY_ID['satchel'];
  const c4 = RAID_METHOD_BY_ID['c4'];
  const rocket = RAID_METHOD_BY_ID['rocket'];

  assert.equal(calculateFinishRecommendation(target, satchel, RAID_METHODS), null);
  assert.equal(calculateFinishRecommendation(target, c4, RAID_METHODS), null);
  assert.equal(calculateFinishRecommendation(target, rocket, RAID_METHODS), null);
  assert.equal(calculateFinishRecommendation(RAID_TARGET_BY_ID['garage-door'], rocket, RAID_METHODS), null);

  const garage = RAID_TARGET_BY_ID['garage-door'];
  const garageRec = calculateFinishRecommendation(garage, satchel, RAID_METHODS);
  assert.ok(garageRec, 'valid satchel mix must still be recommended');
  const fullSatchel = calculateSingleMethodCost(garage, satchel);
  assert.ok(garageRec.plan.sulfur < fullSatchel.sulfur);
  assert.ok(garageRec.plan.items.some((item) => item.method.id === 'c4'));
});

test('finish recommendation never uses eco melee finishers', () => {
  const target = RAID_TARGET_BY_ID['garage-door'];
  const bullets = RAID_METHOD_BY_ID['explosive-556'];
  const recommendation = calculateFinishRecommendation(target, bullets, RAID_METHODS);

  assert.ok(recommendation, 'no recommendation found for garage door bullets');
  assert.ok(recommendation.plan.items.every((item) => item.method.category !== 'Eco'));

  const turret = RAID_TARGET_BY_ID['auto-turret'];
  const rocket = RAID_METHOD_BY_ID['rocket'];
  assert.equal(calculateFinishRecommendation(turret, rocket, RAID_METHODS), null);
});

test('custom plan sums damage and reports waste above target hp', () => {
  const target = RAID_TARGET_BY_ID['garage-door'];
  const c4 = RAID_METHOD_BY_ID['c4'];
  const satchel = RAID_METHOD_BY_ID['satchel'];

  assert.equal(getMethodDamagePerUse(target, c4), 384);

  const single = calculateCustomRaidPlan(target, [{ method: c4, amount: 1 }]);
  assert.equal(single.totalDamage, 384);
  assert.equal(single.wasteDamage, 0);

  const overkill = calculateCustomRaidPlan(target, [
    { method: c4, amount: 2 },
    { method: satchel, amount: 1 },
  ]);
  assert.equal(overkill.totalDamage, 384 * 2 + 67);
  assert.equal(overkill.wasteDamage, 384 * 2 + 67 - target.hp);
  assert.equal(overkill.items.length, 2);
});

