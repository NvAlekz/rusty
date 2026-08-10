import React, { useEffect, useMemo, useState } from 'react';
import { useSettings } from '../context/SettingsContext';
import {
  RAID_CATEGORIES,
  RAID_DATA_VERIFIED_AT,
  RAID_MATERIALS,
  RAID_METHODS,
  RAID_METHOD_BY_ID,
  RAID_TARGETS,
} from '../data/raidData';
import {
  calculateCustomRaidPlan,
  calculateFinishRecommendation,
  calculateSingleMethodCost,
  formatRaidAmount,
  formatRaidTime,
  getMethodDamagePerUse,
  getSupportedMethods,
  rankRaidPlans,
  targetSupportsSoftSide,
} from '../utils/raidCalculator';

const FEATURED_MATERIALS = ['sulfur', 'charcoal', 'metalFragments'];
const RAID_TARGET_NAME_OVERRIDES_ES = {
  'twig-wall': 'Pared de Mimbre',
  'wood-wall': 'Pared de Madera',
  'stone-wall': 'Pared de Piedra',
  'sheet-metal-wall': 'Pared de Chapa',
  'armored-wall': 'Pared Blindada',
  'wood-floor': 'Piso de Madera',
  'stone-floor': 'Piso de Piedra',
  'sheet-metal-floor': 'Piso de Chapa',
  'armored-floor': 'Piso Blindado',
  'wood-foundation': 'Cimientos de Madera',
  'stone-foundation': 'Cimientos de Piedra',
  'sheet-metal-foundation': 'Cimientos de Chapa',
  'armored-foundation': 'Cimientos Blindados',
  'wooden-door': 'Puerta de Madera',
  'sheet-metal-door': 'Puerta de Chapa',
  'garage-door': 'Puerta de Garaje',
  'armored-door': 'Puerta Blindada',
  'wood-double-door': 'Puerta Doble de Madera',
  'wood-roof': 'Techo Inclinado de Madera',
  'stone-roof': 'Techo Inclinado de Piedra',
  'sheet-metal-roof': 'Techo Inclinado de Chapa',
  'armored-roof': 'Techo Inclinado Blindado',
  'sheet-metal-double-door': 'Puerta Doble de Chapa',
  'armored-double-door': 'Puerta Doble Blindada',
  'ladder-hatch': 'Escotilla',
  'triangle-ladder-hatch': 'Escotilla Triangular',
  'floor-grill': 'Rejilla de Suelo',
  'shop-front': 'Escaparate',
  'metal-shop-front': 'Escaparate Metálico',
  'wood-window-bars': 'Rejas de Madera',
  'metal-window-bars': 'Rejas de Metal',
  'armored-window-bars': 'Rejas Blindadas',
  'reinforced-glass-window': 'Ventana de Vidrio Reforzado',
  'tool-cupboard': 'Caja de Herramientas',
  'auto-turret': 'Torretas Automáticas',
  'sam-site': 'Sitio SAM',
  'flame-turret': 'Torreta de Llama',
  'shotgun-trap': 'Trampa de Escopeta',
  'landmine': 'Mina Terrestre',
  'high-external-wooden-wall': 'Pared Externa Alta de Madera',
  'high-external-stone-wall': 'Pared Externa Alta de Piedra',
  'high-external-wooden-gate': 'Puerta Externa Alta de Madera',
  'high-external-stone-gate': 'Puerta Externa Alta de Piedra',
  'wooden-barricade': 'Barricada de Madera',
  'stone-barricade': 'Barricada de Piedra',
  'metal-barricade': 'Barricada de Metal',
  'small-wood-box': 'Caja de Madera Pequeña',
  'large-wood-box': 'Caja de Madera Grande',
  'vending-machine': 'Máquina Expendedora',
  'drop-box': 'Buzón',
  'furnace': 'Horno',
  'large-furnace': 'Horno Grande',
  'locker': 'Taquilla',
  'sleeping-bag': 'Bolsa para Dormir',
};

const RAID_METHOD_NAME_OVERRIDES_ES = {
  c4: 'C4',
  rocket: 'Cohete',
  'hv-rocket': 'Cohete HV',
  'incendiary-rocket': 'Cohete Incendiario',
  satchel: 'Carga Satchel',
  beancan: 'Granada Beancan',
  f1: 'Granada F1',
  'explosive-556': 'Munición Explosiva 5.56',
  'propane-bomb': 'Bomba de Propano',
  molotov: 'Cóctel Molotov',
  flamethrower: 'Lanzallamas',
  'fire-arrow': 'Flecha de Fuego',
  'salvaged-hammer': 'Martillo Recuperado',
  jackhammer: 'Martillo Neumático',
  'stone-spear': 'Lanza de Piedra',
  machete: 'Machete',
  'salvaged-axe': 'Hacha Recuperada',
  pickaxe: 'Pico',
  torch: 'Antorcha (Cuerpo a Cuerpo)',
  'bone-club': 'Garrote de Hueso',
  'salvaged-cleaver': 'Cuchilla Recuperada',
  'bone-knife': 'Cuchillo de Hueso',
  boomerang: 'Bumerán',
  chainsaw: 'Motosierra',
  hatchet: 'Hacha',
  'combat-knife': 'Cuchillo de Combate',
  mace: 'Maza',
  paddle: 'Remo',
  rock: 'Piedra',
  'salvaged-icepick': 'Pico de Hielo Recuperado',
  'stone-hatchet': 'Hacha de Piedra',
  'stone-pickaxe': 'Pico de Piedra',
  longsword: 'Espada Larga',
  'salvaged-sword': 'Espada Recuperada',
  'wooden-spear': 'Lanza de Madera',
  'python': 'Pistola Python (Exp.)',
  'explosive-556-sar': 'Exp. 5.56 (SAR)',
  'explosive-556-ak': 'Exp. 5.56 (AK)',
  'mlrs-rocket': 'Cohete MLRS',
  '40mm-he': 'Granada HE 40mm',
};

const RAID_CATEGORY_OVERRIDES_ES = {
  Walls: 'Paredes',
  Floors: 'Suelos',
  Foundations: 'Fundaciones',
  Roofs: 'Techos',
  Doors: 'Puertas',
  'Frames & Windows': 'Marcos y Ventanas',
  Deployables: 'Desplegables',
  Defenses: 'Defensas',
  'External Walls': 'Paredes Externas',
  Barricades: 'Barricadas',
  Other: 'Otros',
};

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function genericSpanishName(name) {
  const replacements = [
    ['Shop Front', 'Escaparate'],
    ['Window Bars', 'Rejas de Ventana'],
    ['Reinforced Glass Window', 'Ventana de Vidrio Reforzado'],
    ['Double Door', 'Puerta Doble'],
    ['Garage Door', 'Puerta de Garaje'],
    ['High External', 'Externa Alta'],
    ['Ladder Hatch', 'Escotilla'],
    ['Triangle Ladder Hatch', 'Escotilla Triangular'],
    ['Floor Grill', 'Rejilla de Suelo'],
    ['Roof', 'Techo'],
    ['Tool Cupboard', 'Caja de Herramientas'],
    ['Auto Turret', 'Torreta Automática'],
    ['Flame Turret', 'Torreta de Llama'],
    ['Shotgun Trap', 'Trampa de Escopeta'],
    ['Land Mine', 'Mina Terrestre'],
    ['Wooden', 'de Madera'],
    ['Sheet Metal', 'de Chapa'],
    ['Armored', 'Blindada'],
    ['Stone', 'Piedra'],
    ['Wood', 'Madera'],
    ['Wall', 'Pared'],
    ['Floor', 'Suelo'],
    ['Foundation', 'Fundación'],
    ['Door', 'Puerta'],
    ['Window', 'Ventana'],
    ['Box', 'Caja'],
    ['Large', 'Grande'],
    ['Vending Machine', 'Máquina Expendedora'],
    ['Sleeping Bag', 'Bolsa para Dormir'],
    ['Drop Box', 'Buzón'],
    ['Barricade', 'Barricada'],
  ];

  return replacements.reduce((current, [source, target]) => {
    const regex = new RegExp(`\\b${escapeRegExp(source)}\\b`, 'g');
    return current.replace(regex, target);
  }, name);
}

function translateRaidName(entry, type, language) {
  if (language !== 'es') return entry.name;
  const overrides = type === 'target' ? RAID_TARGET_NAME_OVERRIDES_ES : RAID_METHOD_NAME_OVERRIDES_ES;
  return overrides[entry.id] || genericSpanishName(entry.name);
}

function translateRaidCategory(category, language) {
  if (language !== 'es') return category;
  return RAID_CATEGORY_OVERRIDES_ES[category] || category;
}

function getPlanAmountLabel(plan, language) {
  if (!plan) return '';

  if (plan.items.length === 1) {
    const item = plan.items[0];
    const methodName = translateRaidName(item.method, 'method', language);
    const amount = formatRaidAmount(item.amount);

    return `${amount}x ${methodName}`;
  }

  return plan.items
    .map((item) => `${formatRaidAmount(item.amount)}x ${translateRaidName(item.method, 'method', language)}`)
    .join(' + ');
}

export default function RaidCalculator() {
  const { t, language } = useSettings();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [targetId, setTargetId] = useState('garage-door');
  const [methodId, setMethodId] = useState('explosive-556');
  const [quantity, setQuantity] = useState(1);
  const [healthPercent, setHealthPercent] = useState(100);
  const [side, setSide] = useState('hard');
  const [raiderCount, setRaiderCount] = useState(1);
  const [customOpen, setCustomOpen] = useState(false);
  const [customEntries, setCustomEntries] = useState([]);

  const selectedTarget = useMemo(
    () => RAID_TARGETS.find((target) => target.id === targetId) || RAID_TARGETS[0],
    [targetId]
  );

  const supportsSoft = targetSupportsSoftSide(selectedTarget);

  useEffect(() => {
    if (!supportsSoft && side === 'soft') setSide('hard');
  }, [side, supportsSoft]);

  const filteredTargets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return RAID_TARGETS.filter((target) => {
      const matchesCategory = category === 'all' || target.category === category;
      const translatedName = translateRaidName(target, 'target', language).toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        target.name.toLowerCase().includes(normalizedQuery) ||
        translatedName.includes(normalizedQuery) ||
        target.tags.some((tag) => tag.includes(normalizedQuery));

      return matchesCategory && matchesQuery;
    });
  }, [category, query, language]);

  const supportedMethods = useMemo(
    () => getSupportedMethods(selectedTarget, RAID_METHODS, side),
    [selectedTarget, side]
  );

  useEffect(() => {
    if (!supportedMethods.some((method) => method.id === methodId)) {
      setMethodId(supportedMethods[0]?.id || '');
    }
  }, [methodId, supportedMethods]);

  const selectedMethod = RAID_METHOD_BY_ID[methodId] || supportedMethods[0];

  const selectedPlan = useMemo(
    () =>
      calculateSingleMethodCost(selectedTarget, selectedMethod, {
        quantity,
        healthPercent,
        side,
        raiderCount,
      }),
    [healthPercent, quantity, raiderCount, selectedMethod, selectedTarget, side]
  );

  const recommendation = useMemo(() => {
    const result = calculateFinishRecommendation(selectedTarget, selectedMethod, RAID_METHODS, {
      quantity,
      healthPercent,
      side,
      raiderCount,
    });
    if (!result) return null;
    return {
      ...result,
      sulfurSavings: Math.max(0, (selectedPlan?.sulfur || 0) - result.plan.sulfur),
    };
  }, [healthPercent, quantity, raiderCount, selectedMethod, selectedPlan, selectedTarget, side]);

  const customPlan = useMemo(
    () =>
      calculateCustomRaidPlan(
        selectedTarget,
        customEntries
          .map((entry) => ({ method: RAID_METHOD_BY_ID[entry.methodId], amount: entry.amount }))
          .filter((entry) => entry.method),
        { quantity, healthPercent, side, raiderCount }
      ),
    [customEntries, healthPercent, quantity, raiderCount, selectedTarget, side]
  );

  const handleCustomAdd = (methodId) => {
    setCustomEntries((entries) => {
      const existing = entries.find((entry) => entry.methodId === methodId);
      if (existing) {
        return entries.map((entry) =>
          entry.methodId === methodId ? { ...entry, amount: entry.amount + 1 } : entry
        );
      }
      return [...entries, { methodId, amount: 1 }];
    });
  };

  const handleCustomRemove = (methodId) => {
    setCustomEntries((entries) =>
      entries
        .map((entry) => (entry.methodId === methodId ? { ...entry, amount: entry.amount - 1 } : entry))
        .filter((entry) => entry.amount > 0)
    );
  };

  const handleCustomClear = () => setCustomEntries([]);

  const rankedPlans = useMemo(
    () =>
      rankRaidPlans(selectedTarget, RAID_METHODS, {
        quantity,
        healthPercent,
        side,
        raiderCount,
        methodId,
      }),
    [healthPercent, methodId, quantity, raiderCount, selectedTarget, side]
  );

  return (
    <div className="raid-calculator">
      <div className="raid-head">
        <div>
          <div className="section-title">
            {t('raid_title')} <span>{t('raid_subtitle')}</span>
          </div>
          <p className="raid-head__meta">
            {t('raid_verified')} {RAID_DATA_VERIFIED_AT}
          </p>
        </div>
        <div className="raid-head__stats">
          <span>{RAID_TARGETS.length} {t('raid_targets')}</span>
          <span>{RAID_METHODS.length} {t('raid_methods')}</span>
        </div>
      </div>

      <div className="raid-layout">
        <section className="raid-panel raid-panel--targets">
          <div className="raid-toolbar">
            <input
              className="raid-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('raid_search')}
            />
            <select
              className="select-cyan raid-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              <option value="all">{t('raid_all')}</option>
              {RAID_CATEGORIES.map((categoryName) => (
                <option key={categoryName} value={categoryName}>
                  {translateRaidCategory(categoryName, language)}
                </option>
              ))}
            </select>
          </div>

          <div className="raid-target-grid">
            {filteredTargets.map((target) => (
              <button
                key={target.id}
                className={`raid-target ${target.id === selectedTarget.id ? 'raid-target--active' : ''}`}
                onClick={() => setTargetId(target.id)}
                title={`${translateRaidName(target, 'target', language)} - ${target.hp} HP`}
              >
                <RaidIcon entry={target} size="large" />
                <span className="raid-target__name">{translateRaidName(target, 'target', language)}</span>
                <span className="raid-target__hp">{target.hp} HP</span>
              </button>
            ))}
          </div>
        </section>

        <section className="raid-panel raid-panel--detail">
          <SelectedTargetHeader target={selectedTarget} t={t} language={language} />

          <div className="raid-controls">
            <NumberControl
              label={t('raid_quantity')}
              value={quantity}
              min={1}
              max={99}
              onChange={setQuantity}
            />
            <NumberControl
              label={t('raid_health')}
              value={healthPercent}
              min={1}
              max={100}
              suffix="%"
              onChange={setHealthPercent}
            />
            <NumberControl
              label={t('raid_raiders')}
              value={raiderCount}
              min={1}
              max={12}
              onChange={setRaiderCount}
            />
          </div>

          <div className="raid-side-control">
            <span>{t('raid_side')}</span>
            <div className="raid-segment">
              <button
                className={side === 'hard' ? 'raid-segment__btn raid-segment__btn--active' : 'raid-segment__btn'}
                onClick={() => setSide('hard')}
              >
                {t('raid_hard')}
              </button>
              <button
                className={side === 'soft' ? 'raid-segment__btn raid-segment__btn--active' : 'raid-segment__btn'}
                onClick={() => setSide('soft')}
                disabled={!supportsSoft}
              >
                {t('raid_soft')}
              </button>
            </div>
          </div>

          <div className="raid-methods">
            <div className="raid-panel-title">{t('raid_method')}</div>
            <div className="raid-method-grid">
              {supportedMethods.map((method) => (
                <button
                  key={method.id}
                  className={`raid-method ${method.id === methodId ? 'raid-method--active' : ''}`}
                  onClick={() => setMethodId(method.id)}
                  title={translateRaidName(method, 'method', language)}
                >
                  <RaidIcon entry={method} />
                  <span>{translateRaidName(method, 'method', language)}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="raid-results">
          <div className="raid-results__head">
            <button
              className={`raid-custom-toggle ${customOpen ? 'raid-custom-toggle--active' : ''}`}
              onClick={() => setCustomOpen((open) => !open)}
            >
              {t('raid_custom')}
            </button>
          </div>

          {customOpen && (
            <CustomRaidPanel
              target={selectedTarget}
              methods={RAID_METHODS}
              entries={customEntries}
              plan={customPlan}
              onAdd={handleCustomAdd}
              onRemove={handleCustomRemove}
              onClear={handleCustomClear}
              t={t}
              language={language}
            />
          )}

          <PlanCard
            title={t('raid_selected')}
            plan={selectedPlan}
            tone="cyan"
            recommendation={recommendation}
            t={t}
            language={language}
          />
          <PlanCard title={t('raid_fastest')} plan={rankedPlans.fastestCombo} tone="green" t={t} language={language} />
          {rankedPlans.fastestMixed && (
            <PlanCard title={t('raid_mixed')} plan={rankedPlans.fastestMixed} tone="yellow" t={t} language={language} />
          )}
          <PlanCard title={t('raid_cheapest')} plan={rankedPlans.cheapestSulfur} tone="muted" t={t} language={language} />

          <div className="raid-panel raid-panel--alternatives">
            <div className="raid-panel-title">{t('raid_alternatives')}</div>
            <div className="raid-alternative-list">
              {rankedPlans.alternatives.slice(0, 7).map((plan) => (
                <div key={plan.id} className="raid-alternative">
                  <span>{getPlanAmountLabel(plan, language)}</span>
                  <strong>{formatRaidAmount(plan.sulfur)} S</strong>
                  <em>{formatRaidTime(plan.timeSeconds)}</em>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SelectedTargetHeader({ target, t, language }) {
  return (
    <div className="raid-selected-target">
      <RaidIcon entry={target} size="hero" />
      <div>
        <div className="raid-selected-target__label">{t('raid_target')}</div>
        <div className="raid-selected-target__name">{translateRaidName(target, 'target', language)}</div>
        <div className="raid-selected-target__meta">
          {target.hp} HP - {translateRaidCategory(target.category, language)}
        </div>
      </div>
    </div>
  );
}

function NumberControl({ label, value, min, max, suffix, onChange }) {
  return (
    <label className="raid-number">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(clamp(Number(event.target.value), min, max))}
      />
      {suffix && <em>{suffix}</em>}
    </label>
  );
}

function PlanCard({ title, plan, tone, recommendation, t, language }) {
  if (!plan) {
    return (
      <div className={`raid-plan raid-plan--${tone}`}>
        <div className="raid-plan__title">{title}</div>
        <div className="raid-plan__empty">{t('raid_no_method')}</div>
      </div>
    );
  }

  return (
    <div className={`raid-plan raid-plan--${tone}`}>
      <div className="raid-plan__title">{title}</div>
      <div className="raid-plan__amount">{getPlanAmountLabel(plan, language)}</div>
      <div className="raid-plan__metrics">
        <span>
          <strong>{formatRaidTime(plan.timeSeconds)}</strong>
          {t('raid_time')}
        </span>
        <span>
          <strong>{formatRaidAmount(plan.sulfur)}</strong>
          Sulfur
        </span>
        <span>
          <strong>{formatRaidAmount(plan.charcoal)}</strong>
          Charcoal
        </span>
      </div>
      <MaterialList plan={plan} />
      <CraftNotes plan={plan} language={language} />
      {recommendation && (
        <div className="raid-recommend">
          <div className="raid-recommend__title">{t('raid_recommended')}</div>
          <div className="raid-recommend__amount">{getPlanAmountLabel(recommendation.plan, language)}</div>
          <div className="raid-recommend__save">
            {t('raid_savings')} {formatRaidAmount(recommendation.sulfurSavings)} Sulfur
          </div>
        </div>
      )}
    </div>
  );
}

function MaterialList({ plan }) {
  const entries = Object.entries(plan.materials)
    .filter(([, amount]) => amount > 0)
    .sort(([a], [b]) => {
      const aFeatured = FEATURED_MATERIALS.includes(a) ? 0 : 1;
      const bFeatured = FEATURED_MATERIALS.includes(b) ? 0 : 1;
      return aFeatured - bFeatured || a.localeCompare(b);
    });

  return (
    <div className="raid-materials">
      {entries.map(([key, amount]) => (
        <span key={key} className="raid-material">
          {RAID_MATERIALS[key]?.shortLabel || key}: {formatRaidAmount(amount)}
        </span>
      ))}
    </div>
  );
}

function CraftNotes({ plan, language }) {
  const notes = plan.items
    .filter((item) => item.waste > 0)
    .map((item) => `${translateRaidName(item.method, 'method', language)}: craft ${formatRaidAmount(item.craftedAmount)}, use ${formatRaidAmount(item.amount)}`);

  if (notes.length === 0) return null;

  return (
    <div className="raid-craft-notes">
      {notes.join(' / ')}
    </div>
  );
}

function CustomRaidPanel({ target, methods, entries, plan, onAdd, onRemove, onClear, t, language }) {
  const hp = target.hp;
  const damage = plan ? plan.totalDamage : 0;
  const waste = plan ? plan.wasteDamage : 0;
  const greenWidth = Math.min(100, (damage / hp) * 100);
  const redWidth = Math.max(0, Math.min(100, (waste / hp) * 100));

  return (
    <div className="raid-panel raid-panel--custom">
      <div className="raid-panel-title">{t('raid_custom')}</div>

      <div className="raid-hpbar">
        <div className="raid-hpbar__track">
          <div className="raid-hpbar__fill raid-hpbar__fill--green" style={{ width: `${greenWidth}%` }} />
          {waste > 0 && (
            <div className="raid-hpbar__fill raid-hpbar__fill--red" style={{ width: `${redWidth}%` }} />
          )}
        </div>
        <div className="raid-hpbar__labels">
          <span>
            {formatRaidAmount(Math.round(damage))} / {formatRaidAmount(hp)} HP
          </span>
          {waste > 0 && (
            <span className="raid-hpbar__waste">
              +{formatRaidAmount(Math.round(waste))} {t('raid_wasted')}
            </span>
          )}
        </div>
      </div>

      <div className="raid-custom-methods">
        {methods.map((method) => {
          const damagePerUse = getMethodDamagePerUse(target, method, 'hard') || getMethodDamagePerUse(target, method, 'soft');
          if (!damagePerUse) return null;

          return (
            <button
              key={method.id}
              className="raid-custom-method"
              onClick={() => onAdd(method.id)}
              title={`${translateRaidName(method, 'method', language)} - ${formatRaidAmount(Math.round(damagePerUse))} ${t('raid_damage')}`}
            >
              <RaidIcon entry={method} />
              <span>{translateRaidName(method, 'method', language)}</span>
              <em>{formatRaidAmount(Math.round(damagePerUse))}</em>
            </button>
          );
        })}
      </div>

      {entries.length > 0 && (
        <>
          <div className="raid-custom-list">
            {entries.map((entry) => {
              const method = RAID_METHOD_BY_ID[entry.methodId];
              if (!method) return null;
              const damagePerUse = getMethodDamagePerUse(target, method, 'hard') || getMethodDamagePerUse(target, method, 'soft') || 0;

              return (
                <div key={entry.methodId} className="raid-custom-row">
                  <RaidIcon entry={method} />
                  <span className="raid-custom-row__name">{translateRaidName(method, 'method', language)}</span>
                  <span className="raid-custom-row__dmg">
                    {formatRaidAmount(Math.round(entry.amount * damagePerUse))} {t('raid_damage')}
                  </span>
                  <div className="raid-custom-row__stepper">
                    <button onClick={() => onRemove(entry.methodId)}>-</button>
                    <em>{entry.amount}</em>
                    <button onClick={() => onAdd(entry.methodId)}>+</button>
                  </div>
                </div>
              );
            })}
          </div>

          {plan && (
            <div className="raid-custom-summary">
              <div className="raid-plan__metrics">
                <span>
                  <strong>{formatRaidTime(plan.timeSeconds)}</strong>
                  {t('raid_time')}
                </span>
                <span>
                  <strong>{formatRaidAmount(plan.sulfur)}</strong>
                  Sulfur
                </span>
                <span>
                  <strong>{formatRaidAmount(plan.charcoal)}</strong>
                  Charcoal
                </span>
              </div>
              <MaterialList plan={plan} />
            </div>
          )}

          <button className="raid-custom-clear" onClick={onClear}>
            {t('raid_clear')}
          </button>
        </>
      )}
    </div>
  );
}

function RaidIcon({ entry, size = 'normal' }) {
  const [failed, setFailed] = useState(false);
  const className = `raid-icon raid-icon--${size}`;
  const fallbackSvg = getFallbackSvg(entry);
  const hasImg = entry?.icon && !failed;

  return (
    <span className={className}>
      {hasImg ? (
        <img src={entry.icon} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="raid-icon--fallback">
          {fallbackSvg}
        </span>
      )}
    </span>
  );
}

function getFallbackSvg(entry) {
  const tags = entry?.tags || [];
  const id = entry?.id || '';
  const isDoor = tags.includes('door');
  const isDoorGarage = tags.includes('garage');
  const isWall = tags.includes('wall');
  const isFloor = tags.includes('floor');
  const isFoundation = tags.includes('foundation');
  const isRoof = tags.includes('roof');
  const isWood = tags.includes('wood');
  const isStone = tags.includes('stone');
  const isMetal = tags.includes('metal');
  const isArmored = tags.includes('armored') || tags.includes('hqm');
  const isTwig = tags.includes('twig');
  const isFire = tags.includes('fire');
  const isBarricade = tags.includes('barricade');
  const isStorage = tags.includes('storage');
  const isTurret = tags.includes('turret');
  const isTrap = tags.includes('trap');
  const isDeployable = tags.includes('deployable');
  const isEco = tags.includes('eco');
  const isExplosive = tags.includes('explosive');
  const isGrenade = tags.includes('grenade');

  if (isDoor) return GarageDoorSvg({ armada: isArmored ? 'armored' : isMetal ? 'metal' : 'wood' });
  if (isFoundation) return FoundationSvg(isWood ? 'wood' : isStone ? 'stone' : isMetal ? 'metal' : 'armored');
  if (isFloor) return FloorSvg(isWood ? 'wood' : isStone ? 'stone' : isMetal ? 'metal' : 'armored');
  if (isRoof) return RoofSvg(isWood ? 'wood' : isStone ? 'stone' : isMetal ? 'metal' : 'armored');
  if (isWall && (isWood || isStone || isMetal || isArmored)) return WallSvg(isWood ? 'wood' : isStone ? 'stone' : isMetal ? 'metal' : 'armored');
  if (isBarricade) return BarricadeSvg();
  if (isTurret) return TurretSvg();
  if (isTrap) return TrapSvg();
  if (isStorage) return BoxSvg();
  if (isDeployable) return ToolCupboardSvg();
  if (isEco) return ToolSvg();
  if (isFire) return FlameSvg();
  if (isExplosive) return ExplosiveSvg();
  if (isGrenade) return GrenadeSvg();

  return GenericBoxSvg();
}

function WallSvg(grad) {
  const colors = { wood: ['#8B5E3C','#A67C52','#6B3A2A'], stone: ['#6B7280','#9CA3AF','#4B5563'], metal: ['#60A5FA','#93C5FD','#3B82F6'], armored: ['#C084FC','#A78BFA','#8B5CF6'] };
  const [top, mid, bot] = colors[grad] || colors.stone;
  return <svg viewBox="0 0 48 48"><rect x="4" y="10" width="40" height="28" rx="2" fill={bot}/><rect x="4" y="10" width="40" height="10" rx="2" fill={mid}/><rect x="6" y="11" width="17" height="8" rx="1" fill={top}/><rect x="25" y="11" width="17" height="8" rx="1" fill={top}/><rect x="6" y="21" width="36" height="5" fill={mid} opacity="0.5"/><rect x="4" y="28" width="40" height="10" rx="2" fill={bot} opacity="0.8"/></svg>;
}

function FloorSvg(grad) {
  const colors = { wood: { t: '#8B5E3C', l: '#A85352' }, stone: { t: '#6B7280', l: '#9CA3AF' }, metal: { t: '#60A5FA', l: '#93C5FD' }, armored: { t: '#8B5CF6', l: '#A78BFA' } };
  const { t, l } = colors[grad] || colors.stone;
  return <svg viewBox="0 0 48 48"><rect x="4" y="4" width="40" height="40" rx="3" fill={t} opacity="0.3"/><rect x="6" y="6" width="16" height="12" rx="1" fill={l} opacity="0.6"/><rect x="24" y="6" width="18" height="12" rx="1" fill={l} opacity="0.4"/><rect x="6" y="20" width="16" height="12" rx="1" fill={l} opacity="0.5"/><rect x="24" y="20" width="18" height="12" rx="1" fill={l} opacity="0.6"/></svg>;
}

function FoundationSvg(grad) {
  const colors = { wood: '#8B5E3C', stone: '#6B7280', metal: '#60A5FA', armored: '#8B5CF6' };
  const fill = colors[grad] || colors.stone;
  return <svg viewBox="0 0 48 48"><rect x="2" y="12" width="44" height="30" rx="2" fill={fill}/><rect x="4" y="14" width="40" height="8" fill={fill} opacity="0.6"/><rect x="6" y="24" width="14" height="7" rx="1" fill={fill} opacity="0.3"/><rect x="22" y="24" width="20" height="7" rx="1" fill={fill} opacity="0.3"/></svg>;
}

function RoofSvg(grad) {
  const colors = { wood: '#8B5E3C', stone: '#6B7280', metal: '#60A5FA', armored: '#8B5CF6' };
  const fill = colors[grad] || colors.stone;
  return <svg viewBox="0 0 48 48"><polygon points="4,38 24,4 44,38" fill={fill} opacity="0.3"/><polygon points="24,4 24,38" stroke={fill} strokeWidth="1.5" fill="none"/> <rect x="6" y="30" width="36" height="8" rx="2" fill={fill}/><rect x="6" y="36" width="36" height="4" rx="1" fill={fill} opacity="0.7"/></svg>;
}

function GarageDoorSvg({ armored }) {
  const color = armored === 'armored' ? '#a78bfa' : armored === 'metal' ? '#60a5fa' : '#f59e0b';
  return <svg viewBox="0 0 48 48"><rect x="6" y="4" width="36" height="40" rx="2" fill={color} opacity="0.2"/><rect x="8" y="6" width="32" height="8" rx="2" fill={color}/><rect x="8" y="16" width="32" height="8" rx="2" fill={color} opacity="0.9"/><rect x="8" y="26" width="32" height="8" rx="2" fill={color} opacity="0.9"/><rect x="10" y="36" width="28" height="8" rx="2" fill={color} opacity="0.8"/><circle cx="32" cy="30" r="1.5" fill="#020"/></svg>;
}

function BarricadeSvg() { return <svg viewBox="0 0 48 48"><rect x="14" y="6" width="20" height="36" rx="2" fill="#9ca3af"/><line x1="14" y1="18" x2="34" y2="18" stroke="#4b5563" strokeWidth="2"/><line x1="14" y1="28" x2="34" y2="28" stroke="#4b5563" strokeWidth="2"/><line x1="22" y1="6" x2="22" y2="42" stroke="#4b5563" strokeWidth="2"/><line x1="26" y1="6" x2="26" y2="42" stroke="#4b5563" strokeWidth="2"/></svg>; }

function TurretSvg() { return <svg viewBox="0 0 48 48"><rect x="18" y="14" width="12" height="20" rx="3" fill="#4b5563"/><rect x="20" y="16" width="8" height="4" rx="1" fill="#ef4444"/><rect x="30" y="22" width="4" height="2" rx="1" fill="#4b5563"/><line x1="32" y1="23" x2="44" y2="18" stroke="#4b5563" strokeWidth="2"/><path d="M18 34 l4 8 h4 l4-8" fill="#4b5563"/></svg> }

function TrapSvg() { return <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="16" fill="#1e2a30"/><circle cx="24" cy="24" r="10" fill="#ef4444" opacity="0.7"/><circle cx="24" cy="24" r="4" fill="#fef08a"/><line x1="24" y1="8" x2="24" y2="40" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="2 2"/><line x1="8" y1="24" x2="40" y2="24" stroke="#6b7280" strokeWidth="1.5" strokeDasharray="2 2"/></svg> }

function BoxSvg() { return <svg viewBox="0 0 48 48"><rect x="8" y="16" width="32" height="22" rx="2" fill="#8b5e3c"/><rect x="6" y="14" width="36" height="6" rx="2" fill="#a0522d"/><rect x="12" y="26" width="24" height="4" rx="1" fill="#6b3c2a"/><rect x="18" y="14" width="12" height="3" rx="1" fill="#d4a76a"/></svg> }

function ToolCupboardSvg() { return <svg viewBox="0 0 48 48"><rect x="8" y="6" width="32" height="36" rx="3" fill="#4b7280"/><rect x="10" y="8" width="28" height="16" rx="2" fill="#5b8fa8"/><circle cx="24" cy="28" r="3" fill="#2d4a53"/><rect x="18" y="34" width="8" height="2" rx="1" fill="#2d4a53"/></svg> }

function ToolSvg() { return <svg viewBox="0 0 48 48"><rect x="20" y="24" width="8" height="20" rx="2" fill="#6b5353"/><rect x="16" y="12" width="16" height="14" rx="4" fill="#9ca3af"/><rect x="19" y="6" width="4" height="8" rx="1" fill="#4b5563"/></svg> }

function FlameSvg() { return <svg viewBox="0 0 48 48"><ellipse cx="24" cy="38" rx="10" ry="6" fill="#f97316"/><path d="M24 12 c-4 12-8 16-8 22 c0 4.4 3.6 8 8 8s8-3.6 8-8c0-4-2-8-8-22z" fill="#ea580c"/><path d="M24 20 c-3 8-6 10-6 14 c0 3.3 2.7 6 6 6s6-2.7 6-6c0-4-2-6-6-14z" fill="#fbbf24"/></svg> }

function ExplosiveSvg() { return <svg viewBox="0 0 48 48"><rect x="10" y="14" width="28" height="22" rx="6" fill="#64748b"/><rect x="13" y="19" width="22" height="4" rx="1" fill="#334155"/><rect x="12" y="28" width="24" height="6" rx="2" fill="#22d3ee" opacity="0.8"/><rect x="26" y="4" width="2" height="12" rx="1" fill="#ef4444"/><circle cx="27" cy="5" r="3" fill="#fca5a5"/></svg> }

function GrenadeSvg() { return <svg viewBox="0 0 48 48"><circle cx="24" cy="28" r="14" fill="#4b7280"/><rect x="20" y="14" width="8" height="2" rx="1" fill="#4b5563"/><rect x="21" y="8" width="6" height="6" rx="3" fill="#4b7280"/><circle cx="24" cy="34" r="6" fill="#64748b"/><line x1="18" y1="28" x2="30" y2="28" stroke="#4b5563" strokeWidth="1"/><line x1="15" y1="34" x2="33" y2="34" stroke="#4b5563" strokeWidth="1"/></svg> }

function GenericBoxSvg() { return <svg viewBox="0 0 48 48"><rect x="6" y="8" width="36" height="32" rx="5" fill="none" stroke="#64748b" strokeWidth="1.5"/><path d="M17 18h14M17 28h14M17 32h6" stroke="#64748b" strokeWidth="1.2" opacity="0.6"/><circle cx="15" cy="12" r="1" fill="#22d3ee" opacity="0.5"/></svg> }

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
