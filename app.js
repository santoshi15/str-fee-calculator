window.dataLayer = window.dataLayer || [];
import { calculateFees, calculateROI } from './calc.js';

const $ = id => document.getElementById(id);
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const pct = value => `${value.toFixed(2)}%`;
const feeForm = $('fee-form');
const roiForm = $('roi-form');
let feeTracked = false;
let roiTracked = false;
let currentFees;
const today = new Date();
$('bookingDate').value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const values = form => Object.fromEntries(new FormData(form));
const row = (label, value, className = '') => `<div class="${className}"><dt>${label}</dt><dd>${value}</dd></div>`;

function valid(form, errorId) {
  const inputs = values(form);
  const excessiveDiscount = form === feeForm && Number(inputs.additionalDiscountPct) +
    (Number(inputs.nights) >= 28 ? Number(inputs.monthlyDiscountPct) : Number(inputs.nights) >= 7 ? Number(inputs.weeklyDiscountPct) : 0) > 100;
  const okay = form.checkValidity() && !excessiveDiscount;
  $(errorId).textContent = okay ? '' : excessiveDiscount ? 'Combined discounts must be 100% or less. Results show the last valid inputs.' : 'Complete all fields with valid values. Results show the last valid inputs.';
  return okay;
}
function renderFees() {
  if (!valid(feeForm, 'fee-error')) return;
  const inputs = values(feeForm);
  const result = calculateFees(inputs);
  currentFees = { result, inputs };
  $('structure-label').textContent = result.vrbo.label;
  const common = row('Nightly subtotal', money(result.nightlySubtotal)) + row(`Discount (${result.lengthDiscountPctUsed}% length + ${Number(inputs.additionalDiscountPct)}% additional)`, `-${money(result.discountAmount)}`)
    + row('Cleaning', money(Number(inputs.cleaningFee))) + row('Pet', money(Number(inputs.petFee))) + row('Host gross', money(result.basis));
  const airbnb = common + row('Guest total before taxes', money(result.airbnb.guestTotalBeforeTaxes)) + row('Platform fee (15.5%)', money(result.airbnb.fee)) + row('Host payout', money(result.airbnb.payout), 'payout') + row('Effective fee', pct(result.airbnb.effectivePct));
  const oldStructure = result.vrbo.structure === 'old';
  const vrbo = common + (Number(inputs.taxesCollected) > 0 || Number(inputs.refundableDeposit) > 0
    ? row('Taxes collected', money(Number(inputs.taxesCollected))) + row('Refundable deposit', money(Number(inputs.refundableDeposit))) : '')
    + (oldStructure && result.vrbo.processingBase !== result.basis ? row('Processing base', money(result.vrbo.processingBase)) : '')
    + (oldStructure ? row('Commission (5%)', money(result.vrbo.commission)) + row('Processing (3%, on host charges plus taxes and deposit entered)', money(result.vrbo.processing)) : '')
    + row(`Platform fee (${pct(result.vrbo.effectivePct)})`, money(result.vrbo.fee))
    + row('Host payout', money(result.vrbo.payout), 'payout') + row('Effective fee', pct(result.vrbo.effectivePct));
  $('fee-results').innerHTML = `<div class="result-grid"><article class="result-card airbnb"><h2>Airbnb</h2><dl class="metrics">${airbnb}</dl></article><article class="result-card vrbo"><h2>Vrbo</h2><dl class="metrics">${vrbo}</dl></article></div><p class="gap">${result.gap.text}</p>`;
  $('copy-status').textContent = '';
}
function renderROI() {
  if (!valid(roiForm, 'roi-error')) return;
  const inputs = values(roiForm);
  const result = calculateROI(inputs);
  const outputs = [['Gross annual revenue', 'grossRevenue'], ['Platform fees', 'platformFees'], ['Operating expenses', 'operatingExpenses'], ['Net operating income (NOI)', 'NOI'], ['Annual debt service', 'annualDebtService'], ['Cash flow after debt service', 'cashFlow'], ['Cap rate', 'capRate'], ['Cash on cash return', 'cashOnCash'], ['Revenue per available night', 'revPAN']];
  $('roi-results').innerHTML = `<h3>Your annual estimate</h3><dl class="metrics">${outputs.map(([label, key]) => row(label, ['capRate', 'cashOnCash'].includes(key) ? pct(result[key]) : money(result[key]))).join('')}</dl>`;
}
feeForm.addEventListener('input', () => {
  if (!feeTracked) { window.dataLayer.push({ event: 'calculator_run' }); feeTracked = true; }
  renderFees();
});
roiForm.addEventListener('input', () => {
  if (!roiTracked) { window.dataLayer.push({ event: 'roi_run' }); roiTracked = true; }
  renderROI();
});
for (const form of [feeForm, roiForm]) form.addEventListener('submit', event => event.preventDefault());
function openInquiry() {
  $('inquiry').open = true;
  $('inquiry').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('inquiry').querySelector('summary').focus({ preventScroll: true });
}
$('audit-cta').addEventListener('click', () => { window.dataLayer.push({ event: 'audit_cta_click' }); openInquiry(); });
$('checklist-link').addEventListener('click', event => { event.preventDefault(); openInquiry(); });
$('inquiry-form').addEventListener('submit', event => {
  event.preventDefault();
  $('inquiry-status').textContent = 'This form does not send yet. Use the audit inbox once listed. Nothing was sent or stored.';
});
$('print-results').addEventListener('click', () => window.print());
$('copy-results').addEventListener('click', async () => {
  const { result, inputs } = currentFees;
  const summary = `STR Fee Calculator\nBooking date: ${inputs.bookingDate}\nVrbo: ${result.vrbo.label}\nHost gross: ${money(result.basis)}\nAirbnb guest total before taxes: ${money(result.airbnb.guestTotalBeforeTaxes)}\nAirbnb payout: ${money(result.airbnb.payout)}\nVrbo payout: ${money(result.vrbo.payout)}${result.vrbo.structure === 'old' ? `\nVrbo commission: ${money(result.vrbo.commission)}\nVrbo processing (on amounts entered): ${money(result.vrbo.processing)}` : ''}\n${result.gap.text}`;
  let copied = false;
  try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(summary); copied = true; } } catch { /* Try the local selection fallback. */ }
  if (!copied) {
    const field = document.createElement('textarea');
    field.value = summary;
    field.setAttribute('aria-label', 'Results to copy');
    field.style.position = 'fixed'; field.style.top = '0'; field.style.left = '0';
    document.body.append(field); field.select();
    try { copied = document.execCommand('copy'); } catch { copied = false; }
    if (!copied) { $('copy-status').textContent = 'Automatic copy is unavailable. Select and copy the summary below.'; field.style.position = 'static'; field.readOnly = true; field.focus(); return; }
    field.remove(); $('copy-results').focus();
  }
  $('copy-status').textContent = 'Results copied.';
});
renderFees();
renderROI();
