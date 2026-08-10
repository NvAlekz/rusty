const DEFAULT_OPTIONS = {
  quantity: 1,
  healthPercent: 100,
  side: 'hard',
  raiderCount: 1,
};

const MATERIAL_WEIGHTS = {
  sulfur: 1,
  charcoal: 0.2,
  metalFragments: 0.2,
  highQualityMetal: 15,
  scrap: 2,
  techTrash: 40,
  lowGradeFuel: 1,
  cloth: 0.5,
  rope: 20,
  animalFat: 0.5,
  wood: 0.05,
  stones: 0.05,
  boneFragment: 0.05,
  metalPipe: 10,
  metalBlade: 10,
  gears: 50,
  roadSigns: 10,
};

export function calculateSingleMethodCost(target, method, options = {}) {
  if (!target || !method) return null;

  const normalized = normalizeOptions(options);
  const countEntry = getCountEntry(target, method.id, normalized.side);
  if (!countEntry) return null;

  const usesPerTarget = calculateUsesPerTarget(target, countEntry, normalized);
  if (!Number.isFinite(usesPerTarget) || usesPerTarget <= 0) return null;

  const amount = usesPerTarget * normalized.quantity;
  return buildPlan({
    id: `${target.id}-${method.id}`,
    label: method.name,
    target,
    entries: [{ method, amount }],
    options: normalized,
    source: 'single',
  });
}

export function calculateMaterialTotals(planOrItems) {
  const items = Array.isArray(planOrItems) ? planOrItems : planOrItems?.items || [];

  return items.reduce((totals, item) => {
    const materials = item.materials || calculateMaterialsForAmount(item.method, item.amount);
    Object.entries(materials).forEach(([key, value]) => {
      totals[key] = (totals[key] || 0) + value;
    });
    return totals;
  }, {});
}

export function calculateFastestCombo(target, methods, options = {}) {
  if (!target || !Array.isArray(methods)) return null;

  const normalized = normalizeOptions(options);
  const supportedMethods = methods.filter((method) => getCountEntry(target, method.id, normalized.side));
  const candidates = supportedMethods
    .map((method) => calculateSingleMethodCost(target, method, normalized))
    .filter(Boolean);

  candidates.push(...calculateMixedRaidPlans(target, methods, normalized));

  return candidates
    .filter(Boolean)
    .sort(compareByTimeThenSulfur)[0] || null;
}

export function calculateMixedRaidPlans(target, methods, options = {}) {
  if (!target || !Array.isArray(methods)) return [];

  const normalized = normalizeOptions(options);

  return [
    ...buildHintCombos(target, methods, normalized),
    ...buildGeneratedCombos(target, methods, normalized),
  ]
    .filter((plan) => plan?.isMixed)
    .sort(compareByTimeThenSulfur);
}

export function rankRaidPlans(target, methods, options = {}) {
  const normalized = normalizeOptions(options);
  const plans = methods
    .map((method) => calculateSingleMethodCost(target, method, normalized))
    .filter(Boolean);

  const selected = normalized.methodId
    ? plans.find((plan) => plan.items.some((item) => item.method.id === normalized.methodId)) || null
    : plans[0] || null;

  const fastestSingle = [...plans].sort(compareByTimeThenSulfur)[0] || null;
  const fastestCombo = calculateFastestCombo(target, methods, normalized);
  const mixedCandidates = calculateMixedRaidPlans(target, methods, normalized);
  const fastestMixed = mixedCandidates[0] && fastestSingle && mixedCandidates[0].timeSeconds < fastestSingle.timeSeconds
    ? mixedCandidates[0]
    : null;
  const alternatives = [...plans].sort(compareBySulfurThenTime);

  return {
    selected,
    fastest: fastestSingle,
    cheapestSulfur: [...plans].sort(compareBySulfurThenTime)[0] || null,
    cheapestMaterials: [...plans].sort(compareByMaterialScoreThenTime)[0] || null,
    fastestCombo,
    fastestMixed,
    alternatives,
  };
}

export function getSupportedMethods(target, methods, side = 'hard') {
  return methods.filter((method) => getCountEntry(target, method.id, side));
}

export function targetSupportsSoftSide(target) {
  return Boolean(target?.sides?.soft);
}

export function formatRaidTime(seconds) {
  if (!Number.isFinite(seconds)) return '-';
  const rounded = Math.max(1, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const secs = rounded % 60;

  if (minutes <= 0) return `${secs}s`;
  if (minutes < 60) return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0 ? `${hours}h ${restMinutes}m` : `${hours}h`;
}

export function formatRaidAmount(value) {
  if (!Number.isFinite(value)) return '-';
  const rounded = Math.round(value);
  return rounded.toLocaleString('en-US');
}

function normalizeOptions(options) {
  const merged = { ...DEFAULT_OPTIONS, ...options };
  const quantity = clampInteger(merged.quantity, 1, 999);
  const healthPercent = Math.min(100, Math.max(1, Number(merged.healthPercent) || 100));
  const raiderCount = clampInteger(merged.raiderCount, 1, 12);
  const side = merged.side === 'soft' ? 'soft' : 'hard';

  return {
    ...merged,
    quantity,
    healthPercent,
    raiderCount,
    side,
  };
}

function clampInteger(value, min, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}

function getCountEntry(target, methodId, side) {
  const entry = target?.methodCounts?.[methodId];
  if (!entry) return null;

  if (side === 'soft') {
    if (entry.soft) return { ...entry, resolvedCount: entry.soft, resolvedSide: 'soft' };
    if (target.sides?.soft && entry.hard) {
      const multiplier = target.sides.softMultiplier || 1;
      return {
        ...entry,
        resolvedCount: Math.max(1, Math.ceil(entry.hard * multiplier)),
        resolvedSide: 'soft',
      };
    }
    return null;
  }

  if (!entry.hard) return null;
  return { ...entry, resolvedCount: entry.hard, resolvedSide: 'hard' };
}

function calculateUsesPerTarget(target, countEntry, options) {
  const healthFraction = options.healthPercent / 100;
  if (countEntry.damage && countEntry.resolvedSide !== 'soft') {
    return Math.max(1, Math.ceil((target.hp * healthFraction) / countEntry.damage));
  }
  return Math.max(1, Math.ceil(countEntry.resolvedCount * healthFraction));
}

function buildHintCombos(target, methods, options) {
  if (!Array.isArray(target.comboHints) || target.comboHints.length === 0) return [];
  if (options.healthPercent !== 100 || options.side !== 'hard') return [];

  const methodById = Object.fromEntries(methods.map((method) => [method.id, method]));

  return target.comboHints
    .map((hint) => {
      const entries = hint.entries
        .map((entry) => {
          const method = methodById[entry.methodId];
          return method ? { method, amount: entry.amount * options.quantity } : null;
    })
        .filter(Boolean);

      if (entries.length !== hint.entries.length) return null;

      const plan = buildPlan({
        id: `${target.id}-${hint.id}`,
        label: hint.label,
        target,
        entries,
        options,
        source: 'hint',
      });

      return {
        ...plan,
        timeSeconds: hint.timeSeconds
          ? Math.max(plan.timeSeconds, (hint.timeSeconds * options.quantity) / options.raiderCount)
          : plan.timeSeconds,
        isMixed: entries.length > 1,
      };
    })
    .filter(Boolean);
}

function buildGeneratedCombos(target, methods, options) {
  const highImpact = methods.filter((method) => ['c4', 'rocket', 'satchel'].includes(method.id));
  const finishers = methods.filter((method) => ['explosive-556', 'hv-rocket', 'beancan', 'f1'].includes(method.id));
  const effectiveHp = target.hp * (options.healthPercent / 100);
  const candidates = [];

  highImpact.forEach((primary) => {
    const primaryEntry = getCountEntry(target, primary.id, options.side);
    if (!primaryEntry) return;

    const primaryDamage = estimateDamage(target, primaryEntry);
    const maxPrimary = Math.max(0, calculateUsesPerTarget(target, primaryEntry, options) - 1);

    for (let primaryAmount = 1; primaryAmount <= Math.min(maxPrimary, 6); primaryAmount += 1) {
      const remainingHp = effectiveHp - primaryDamage * primaryAmount;
      if (remainingHp <= 0) continue;

      finishers.forEach((finisher) => {
        if (finisher.id === primary.id) return;
        const finisherEntry = getCountEntry(target, finisher.id, options.side);
        if (!finisherEntry) return;

        const finisherDamage = estimateDamage(target, finisherEntry);
        const finisherAmount = Math.max(1, Math.ceil(remainingHp / finisherDamage));

        const entries = [
          { method: primary, amount: primaryAmount * options.quantity },
          { method: finisher, amount: finisherAmount * options.quantity },
        ];

        candidates.push(buildPlan({
          id: `${target.id}-${primary.id}-${finisher.id}-${primaryAmount}`,
          label: `${primaryAmount}x ${primary.name} + ${finisher.name}`,
          target,
          entries,
          options,
          source: 'generated',
        }));
      });
    }
  });

  return candidates.filter(Boolean);
}

function buildPlan({ id, label, target, entries, options, source }) {
  const items = entries.map(({ method, amount }) => {
    const materials = calculateMaterialsForAmount(method, amount);
    const craftBatches = getCraftBatches(method, amount);
    return {
      method,
      amount,
      craftedAmount: craftBatches * (method.yield || 1),
      craftBatches,
      waste: Math.max(0, craftBatches * (method.yield || 1) - amount),
      materials,
      timeSeconds: calculateMethodTime(method, amount, options.raiderCount),
    };
  });

  const materials = calculateMaterialTotals(items);
  const timeSeconds = items.length > 1
    ? calculateParallelRaidTime(items, options.raiderCount)
    : items.reduce((total, item) => total + item.timeSeconds, 0);
  const amountLabel = items.map((item) => `${formatRaidAmount(item.amount)}x ${item.method.name}`).join(' + ');

  return {
    id,
    label,
    targetId: target.id,
    targetName: target.name,
    quantity: options.quantity,
    healthPercent: options.healthPercent,
    side: options.side,
    raiderCount: options.raiderCount,
    source,
    isMixed: items.length > 1,
    amountLabel,
    items,
    materials,
    sulfur: materials.sulfur || 0,
    charcoal: materials.charcoal || 0,
    metalFragments: materials.metalFragments || 0,
    timeSeconds,
    materialScore: calculateMaterialScore(materials),
  };
}

function calculateMaterialsForAmount(method, amount) {
  const batches = getCraftBatches(method, amount);
  const cost = method.expandedCost || {};

  return Object.entries(cost).reduce((materials, [key, value]) => {
    materials[key] = value * batches;
    return materials;
  }, {});
}

function getCraftBatches(method, amount) {
  const yieldAmount = method.yield || 1;
  return Math.ceil(amount / yieldAmount);
}

function calculateMethodTime(method, amount, raiderCount) {
  const time = method.time || { mode: 'perUse', seconds: 1 };
  const raiders = Math.max(1, raiderCount || 1);
  const usesPerRaider = Math.ceil(amount / raiders);

  if (time.mode === 'ammo') {
    const secondsPerUse = time.secondsPerUse || 0.3;
    const magazine = time.magazine || amount;
    const reloadSeconds = time.reloadSeconds || 0;
    const reloads = Math.max(0, Math.ceil(usesPerRaider / magazine) - 1);
    return usesPerRaider * secondsPerUse + reloads * reloadSeconds;
  }

  return usesPerRaider * (time.seconds || 1);
}

function calculateParallelRaidTime(items, raiderCount) {
  if (!Array.isArray(items) || items.length === 0) return 0;

  return items.reduce((total, item) => {
    const taskTime = item.timeSeconds || 0;
    return Math.max(total, taskTime);
  }, 0);
}

function estimateDamage(target, countEntry) {
  if (countEntry.damage && countEntry.resolvedSide !== 'soft') return countEntry.damage;
  return target.hp / countEntry.resolvedCount;
}

export function calculateMaterialScore(materials) {
  return Object.entries(materials).reduce((score, [key, value]) => {
    return score + value * (MATERIAL_WEIGHTS[key] || 1);
  }, 0);
}

function methodPerUseScore(method) {
  return calculateMaterialScore(method.expandedCost || method.recipe || {}) / (method.yield || 1);
}

function methodPerUseSulfur(method) {
  return Number((method.expandedCost || method.recipe || {}).sulfur || 0) / (method.yield || 1);
}

export function getMethodDamagePerUse(target, method, side = 'hard') {
  if (!target || !method) return null;
  const entry = getCountEntry(target, method.id, side) || getCountEntry(target, method.id, 'soft');
  if (!entry) return null;
  return estimateDamage(target, entry);
}

export function calculateFinishRecommendation(target, selectedMethod, methods, options = {}) {
  if (!target || !selectedMethod || !Array.isArray(methods)) return null;

  const normalized = normalizeOptions(options);
  const countEntry = getCountEntry(target, selectedMethod.id, normalized.side);
  if (!countEntry) return null;

  const effectiveHp = target.hp * (normalized.healthPercent / 100);
  const selectedDamage = estimateDamage(target, countEntry);
  if (selectedDamage <= 0) return null;

  const fullUses = calculateUsesPerTarget(target, countEntry, normalized);
  if (fullUses < 2) return null;

  const selectedCost = methodPerUseScore(selectedMethod);
  const selectedSulfur = methodPerUseSulfur(selectedMethod);
  const fullScore = fullUses * selectedCost;
  const fullSulfur = fullUses * selectedSulfur;

  const finishers = methods
    .filter((method) => method.id !== selectedMethod.id && method.category !== 'Eco')
    .map((method) => {
      const entry = getCountEntry(target, method.id, normalized.side);
      if (!entry) return null;
      const damage = estimateDamage(target, entry);
      if (damage <= 0) return null;
      return {
        method,
        damage,
        perUse: methodPerUseScore(method),
        sulfurPerUse: methodPerUseSulfur(method),
        pureUses: Math.max(1, Math.ceil(effectiveHp / damage)),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.perUse / a.damage - b.perUse / b.damage);

  let best = null;

  for (let amountA = 1; amountA < fullUses; amountA += 1) {
    const remaining = effectiveHp - selectedDamage * amountA;
    if (remaining <= 0) continue;

    for (const finisher of finishers) {
      const amountF = Math.max(1, Math.ceil(remaining / finisher.damage));
      const total = amountA * selectedCost + amountF * finisher.perUse;
      const sulfur = amountA * selectedSulfur + amountF * finisher.sulfurPerUse;
      if (total >= fullScore || sulfur >= fullSulfur) continue;

      const pureFinisherScore = finisher.pureUses * finisher.perUse;
      const pureFinisherSulfur = finisher.pureUses * finisher.sulfurPerUse;
      if (total >= pureFinisherScore || sulfur >= pureFinisherSulfur) continue;

      if (!best || total < best.total) {
        best = { amountA, finisher, amountF, total };
      }
    }
  }

  if (!best) return null;

  const plan = buildPlan({
    id: `${target.id}-${selectedMethod.id}-finish`,
    label: 'finish',
    target,
    entries: [
      { method: selectedMethod, amount: best.amountA * normalized.quantity },
      { method: best.finisher.method, amount: best.amountF * normalized.quantity },
    ],
    options: normalized,
    source: 'finish',
  });

  return { plan, scoreSavings: fullScore - best.total };
}

export function calculateCustomRaidPlan(target, entries, options = {}) {
  if (!target || !Array.isArray(entries) || entries.length === 0) return null;

  const normalized = normalizeOptions(options);
  const effectiveHp = target.hp * (normalized.healthPercent / 100);

  const items = entries
    .map(({ method, amount }) => {
      const damagePerUse = getMethodDamagePerUse(target, method, normalized.side);
      if (!damagePerUse || damagePerUse <= 0) return null;
      const scaledAmount = Math.max(0, Math.floor(Number(amount) || 0)) * normalized.quantity;
      return scaledAmount > 0 ? { method, amount: scaledAmount, damagePerUse } : null;
    })
    .filter(Boolean);

  if (items.length === 0) return null;

  const plan = buildPlan({
    id: `${target.id}-custom`,
    label: 'custom',
    target,
    entries: items.map(({ method, amount }) => ({ method, amount })),
    options: normalized,
    source: 'custom',
  });

  const totalDamage = items.reduce((sum, item) => sum + item.amount * item.damagePerUse, 0);

  return {
    ...plan,
    totalDamage,
    wasteDamage: Math.max(0, totalDamage - effectiveHp),
    items: plan.items.map((item, index) => ({
      ...item,
      damage: items[index].amount * items[index].damagePerUse,
    })),
  };
}

function compareByTimeThenSulfur(a, b) {
  return a.timeSeconds - b.timeSeconds || a.sulfur - b.sulfur || a.materialScore - b.materialScore;
}

function compareBySulfurThenTime(a, b) {
  return a.sulfur - b.sulfur || a.timeSeconds - b.timeSeconds || a.materialScore - b.materialScore;
}

function compareByMaterialScoreThenTime(a, b) {
  return a.materialScore - b.materialScore || a.timeSeconds - b.timeSeconds || a.sulfur - b.sulfur;
}
