// Locked v1 rates. Keep these named constants together for future verification.
export const AIRBNB_HOST_FEE_RATE = 0.155;
export const VRBO_NEW_COMMISSION_RATE = 0.12;
export const VRBO_NEW_START_DATE = '2026-10-29';
export const VRBO_OLD_COMMISSION_RATE = 0.05;
export const VRBO_PROCESSING_RATE = 0.03;
export const round2 = value => Math.round((value + Number.EPSILON) * 100) / 100;
const number = value => Math.max(0, Number(value) || 0);
const percent = value => Math.min(100, number(value));
const usd = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

export function calculateFees(inputs) {
  const nightlySubtotal = round2(number(inputs.nightlyRate) * number(inputs.nights));
  const lengthDiscountPctUsed = number(inputs.nights) >= 28 ? percent(inputs.monthlyDiscountPct)
    : number(inputs.nights) >= 7 ? percent(inputs.weeklyDiscountPct) : 0;
  const discountAmount = round2(nightlySubtotal * (lengthDiscountPctUsed + percent(inputs.additionalDiscountPct)) / 100);
  const discountedNightly = round2(nightlySubtotal - discountAmount);
  const basis = round2(discountedNightly + number(inputs.cleaningFee) + number(inputs.petFee));
  const airbnbFee = round2(basis * AIRBNB_HOST_FEE_RATE);
  const airbnb = { guestTotalBeforeTaxes: basis, fee: airbnbFee, payout: round2(basis - airbnbFee), effectivePct: basis ? airbnbFee / basis * 100 : 0 };
  const isNew = inputs.bookingDate >= VRBO_NEW_START_DATE;
  const commission = round2(basis * (isNew ? VRBO_NEW_COMMISSION_RATE : VRBO_OLD_COMMISSION_RATE));
  const processingBase = round2(basis + number(inputs.taxesCollected) + number(inputs.refundableDeposit));
  const processing = isNew ? 0 : round2(VRBO_PROCESSING_RATE * processingBase);
  const fee = round2(commission + processing);
  const vrbo = {
    structure: isNew ? 'new' : 'old',
    label: isNew ? 'New structure (booking on or after Oct 29, 2026): flat 12%, no processing'
      : 'Old structure (booking before Oct 29, 2026): 5% commission plus 3% processing on amounts entered. Assumes Vrbo handled payments.',
    commission, processing, processingBase, processingIsEstimate: false, fee,
    payout: round2(basis - fee), effectivePct: basis ? fee / basis * 100 : 0,
  };
  const amount = round2(Math.abs(vrbo.payout - airbnb.payout));
  const winner = vrbo.payout > airbnb.payout ? 'Vrbo' : airbnb.payout > vrbo.payout ? 'Airbnb' : 'Equal';
  return { nightlySubtotal, lengthDiscountPctUsed, discountAmount, discountedNightly, basis, airbnb, vrbo,
    gap: { amount, winner, text: winner === 'Equal' ? 'You keep the same amount on both platforms for this stay.' : `You keep ${usd(amount)} more on ${winner} for this stay.` } };
}

export function calculateROI(inputs) {
  const homeValue = number(inputs.homeValue);
  const bookedNights = 365 * percent(inputs.occupancyPct) / 100;
  const staysPerYear = number(inputs.averageStayNights) ? bookedNights / number(inputs.averageStayNights) : 0;
  const gross = bookedNights * number(inputs.nightlyRate) + staysPerYear * number(inputs.cleaningFeePerStay);
  const rates = { airbnb: AIRBNB_HOST_FEE_RATE, 'vrbo-new': VRBO_NEW_COMMISSION_RATE,
    'vrbo-old': VRBO_OLD_COMMISSION_RATE + VRBO_PROCESSING_RATE, direct: 0.03 };
  const platformFeeRate = rates[inputs.platform] ?? rates['vrbo-new'];
  const platformFees = round2(gross * platformFeeRate);
  const operatingExpenses = round2(['annualTaxes', 'annualInsurance', 'annualUtilities', 'annualSupplies', 'annualMaintenance', 'annualManagement', 'otherAnnualExpenses']
    .reduce((sum, key) => sum + number(inputs[key]), staysPerYear * number(inputs.cleanerCostPerStay)));
  const cashInvested = round2(homeValue * percent(inputs.downPaymentPct) / 100);
  const loanAmount = round2(homeValue - cashInvested);
  const monthlyRate = number(inputs.interestRatePct) / 100 / 12;
  const payments = number(inputs.loanTermYears) * 12;
  const monthly = payments ? (monthlyRate ? loanAmount * monthlyRate / (1 - Math.pow(1 + monthlyRate, -payments)) : loanAmount / payments) : 0;
  const annualDebtService = round2(monthly * 12);
  const grossRevenue = round2(gross);
  const NOI = round2(grossRevenue - platformFees - operatingExpenses);
  const cashFlow = round2(NOI - annualDebtService);
  return { bookedNights, staysPerYear, grossRevenue, revenueBasis: grossRevenue, platformFeeRate, platformFees,
    operatingExpenses, loanAmount, monthlyPayment: round2(monthly), annualDebtService, NOI, cashFlow, cashInvested,
    capRate: homeValue ? NOI / homeValue * 100 : 0, cashOnCash: cashInvested ? cashFlow / cashInvested * 100 : 0,
    revPAN: round2(grossRevenue / 365) };
}

if (typeof window !== 'undefined') window.STRCALC = { calculateFees, calculateROI, round2 };
else if (typeof self !== 'undefined') self.STRCALC = { calculateFees, calculateROI, round2 };
