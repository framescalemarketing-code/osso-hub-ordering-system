import type {
  GlassesType,
  OrderIntake,
  OrderPricingBreakdown,
  OrderPricingSummary,
  OrderProductIntake,
} from '@/lib/types';

type FrameCategoryBand = {
  code: string;
  fee: number;
  maxPrice: number;
};

const frameCategoryBands: FrameCategoryBand[] = [
  { code: 'P1', fee: 75, maxPrice: 75 },
  { code: 'P2', fee: 100, maxPrice: 125 },
  { code: 'P3', fee: 150, maxPrice: 200 },
  { code: 'P4', fee: 225, maxPrice: Number.POSITIVE_INFINITY },
];

const lensTypeFeeMap: Array<{ match: RegExp; fee: number }> = [
  { match: /(progressive|pal)/i, fee: 190 },
  { match: /(bifocal|lined?)/i, fee: 125 },
  { match: /(single vision|^sv\b)/i, fee: 75 },
  { match: /(reader|occupational)/i, fee: 55 },
];

const lensMaterialFeeMap: Array<{ match: RegExp; fee: number; normalized: string }> = [
  { match: /poly/i, fee: 0, normalized: 'Poly' },
  { match: /trivex/i, fee: 40, normalized: 'Trivex' },
  { match: /(hi[- ]?index|1\.67|1\.74)/i, fee: 65, normalized: 'Hi-Index' },
  { match: /glass/i, fee: 50, normalized: 'Glass' },
];

const lensColorFeeMap: Array<{ match: RegExp; fee: number; normalized: string }> = [
  { match: /(clear|none|no tint)/i, fee: 0, normalized: 'Clear' },
  { match: /(transition|photochromic)/i, fee: 85, normalized: 'Transitions' },
  { match: /polarized/i, fee: 100, normalized: 'Polarized' },
  { match: /(grey|gray|brown|g-15|sun)/i, fee: 35, normalized: 'Tinted' },
];

const coatingFeeMap: Array<{ match: RegExp; fee: number }> = [
  { match: /(premium ar|anti[- ]reflective|anti reflective|ar)/i, fee: 45 },
  { match: /(blue|filter)/i, fee: 25 },
  { match: /uv/i, fee: 15 },
];

const mirrorFeeMap: Array<{ match: RegExp; fee: number }> = [
  { match: /(none|no mirror)/i, fee: 0 },
  { match: /./i, fee: 30 },
];

const tintFeeMap: Array<{ match: RegExp; fee: number }> = [
  { match: /(none|no tint|clear)/i, fee: 0 },
  { match: /./i, fee: 35 },
];

const edgingFeeMap: Array<{ match: RegExp; fee: number }> = [
  { match: /(none|no)/i, fee: 0 },
  { match: /./i, fee: 25 },
];

function normalizedString(value: string | null | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function matchFee(value: string, table: Array<{ match: RegExp; fee: number }>) {
  return table.find(entry => entry.match.test(value))?.fee ?? 0;
}

function normalizeMaterial(value: string) {
  return lensMaterialFeeMap.find(entry => entry.match.test(value))?.normalized ?? normalizedString(value, 'Custom');
}

function normalizeColor(product: OrderProductIntake) {
  const tint = normalizedString(product.tint, 'Clear');
  return lensColorFeeMap.find(entry => entry.match.test(tint))?.normalized ?? tint;
}

function computeFrameCategory(framePrice: number) {
  const match = frameCategoryBands.find(band => framePrice <= band.maxPrice) ?? frameCategoryBands[frameCategoryBands.length - 1];
  return { code: match.code, fee: match.fee };
}

function yesNo(value: boolean) {
  return value ? 'Yes' : 'No';
}

export function deriveGlassesType(intake: OrderIntake): GlassesType {
  const hasRx =
    !!intake.prescriptionId ||
    !!intake.prescription.odSphere ||
    !!intake.prescription.osSphere ||
    !!intake.prescription.odCylinder ||
    !!intake.prescription.osCylinder;
  const hasSafetyFrame = normalizedString(intake.product.sideShieldType, 'none') !== 'none';

  if (hasSafetyFrame && hasRx) return 'safety_rx';
  if (hasSafetyFrame) return 'safety_non_rx';
  if (hasRx) return 'non_safety_rx';
  return 'non_safety_non_rx';
}

export function calculateOrderPricing(intake: OrderIntake): OrderPricingSummary {
  const framePrice = Number(intake.product.framePrice) || 0;
  const optionalFee = Number(intake.product.optionalFee) || 0;
  const serviceAndTechFee = Number(intake.authorization.serviceAndTechFee) || 0;
  const allowance = Number(intake.authorization.allowance) || 0;
  const discount = Number(intake.finance.discount) || 0;
  const frameCategory = computeFrameCategory(framePrice);

  const lensType = normalizedString(intake.product.lensType, 'Custom');
  const lensMaterial = normalizedString(intake.product.lensMaterial, 'Custom');
  const lensCoating = normalizedString(intake.product.lensCoating, 'No Coating');
  const mirror = normalizedString(intake.product.mirror, 'No Mirror');
  const tint = normalizedString(intake.product.tint, 'Clear');
  const specialEdging = normalizedString(intake.product.specialEdging, 'No Special Edge');
  const shippingAddress = normalizedString(intake.product.customerShipAddress, '');
  const sideShieldType = normalizedString(intake.product.sideShieldType, 'none');

  const lensTypeFee = matchFee(lensType, lensTypeFeeMap);
  const lensMaterialFee = lensMaterialFeeMap.find(entry => entry.match.test(lensMaterial))?.fee ?? 0;
  const lensColorFee = lensColorFeeMap.find(entry => entry.match.test(tint))?.fee ?? 0;
  const coatingFee = matchFee(lensCoating, coatingFeeMap);
  const mirrorFee = matchFee(mirror, mirrorFeeMap);
  const tintFee = matchFee(tint, tintFeeMap);
  const edgingFee = matchFee(specialEdging, edgingFeeMap);
  const deliveryFee = shippingAddress ? 15 : 0;
  const sideshieldFee = sideShieldType === 'removable' ? 20 : 0;
  const lensMaterialColorFee = lensMaterialFee + lensColorFee;

  const feeBreakdown: OrderPricingBreakdown = {
    frameCategoryFee: frameCategory.fee,
    lensMaterialFee,
    lensTypeFee,
    lensColorFee,
    coatingFee,
    serviceAndTechFee,
    deliveryFee,
    sideshieldFee,
    tintFee,
    mirrorFee,
    edgingFee,
    optionalFee,
    lensMaterialColorFee,
    discount,
  };

  const totalFees = Object.entries(feeBreakdown)
    .filter(([key]) => key !== 'discount' && key !== 'lensMaterialColorFee')
    .reduce((sum, [, value]) => sum + Number(value || 0), 0);

  const normalizedInvoiceType = normalizedString(intake.authorization.invoiceType, 'out-of-pocket').toLowerCase();
  const billTo = normalizedInvoiceType.includes('out') ? 0 : Math.min(allowance, totalFees);
  const oop = Math.max(totalFees - billTo, 0);
  const oopWithDiscount = Math.max(oop - discount, 0);
  const allowanceLeftover = Math.max(allowance - billTo, 0);
  const normalizedMaterial = normalizeMaterial(lensMaterial);
  const normalizedColor = normalizeColor(intake.product);
  const programYear = new Date().getFullYear();
  const readyToFile = !intake.authorization.authRequested || intake.authorization.authApprovalStatus === 'approved';

  const summaryLines = [
    `ALLOWANCE: $${allowance.toFixed(2)}`,
    `TOTAL FEES: $${totalFees.toFixed(2)}`,
    `BILL TO: $${billTo.toFixed(2)}`,
    `OOP: $${oop.toFixed(2)}`,
    `OOP WITH DISCOUNT: $${oopWithDiscount.toFixed(2)}`,
    `ALLOWANCE LEFTOVER: $${allowanceLeftover.toFixed(2)}`,
    `AUTH REQUESTED: ${yesNo(intake.authorization.authRequested)}`,
    `READY TO FILE: ${yesNo(readyToFile)}`,
  ];

  return {
    billTo,
    oop,
    oopWithDiscount,
    allowanceLeftover,
    frameCategory: `${frameCategory.code} | $${frameCategory.fee}`,
    totalFees,
    lensColor: normalizedColor,
    lensMaterial: normalizedMaterial,
    feeBreakdown,
    orderSummary: summaryLines.join('\n'),
    readyToFile,
    programYear,
  };
}
