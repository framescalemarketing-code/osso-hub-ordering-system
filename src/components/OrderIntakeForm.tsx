'use client';

import type {
  OrderAuthorizationIntake,
  OrderIntake,
} from '@/lib/types';

interface Props {
  intake: OrderIntake;
  onChange: (intake: OrderIntake) => void;
  onComplete: () => void;
}

type IntakeSection = 'profile' | 'authorization' | 'prescription' | 'product' | 'finance';
type SectionValue = OrderIntake[IntakeSection];

const invoiceTypes = [
  'out-of-pocket',
  'program-allowance',
  'cash',
  'invoice-employer',
];

const dispenseTypes = [
  'office-pickup',
  'ship-to-customer',
  'ship-to-ops',
  'lab-direct',
];

const authStatuses: OrderAuthorizationIntake['authApprovalStatus'][] = [
  'not_required',
  'pending',
  'approved',
  'rejected',
];

const sideShieldTypes = ['none', 'permanent', 'removable'];

const lensTypeOptions = ['Single Vision', 'Bifocal', 'Progressive', 'Occupational', 'Custom'];
const lensMaterialOptions = ['Poly', 'Trivex', 'Hi-Index', 'Glass', 'Custom'];
const coatingOptions = ['No Coating', 'AR', 'Premium AR', 'Blue Filter', 'UV', 'Custom'];
const tintOptions = ['Clear', 'Grey', 'Brown', 'Transitions', 'Polarized', 'Custom'];
const mirrorOptions = ['No Mirror', 'Silver', 'Blue', 'Red', 'Custom'];
const edgingOptions = ['No Special Edge', 'Roll and Polish', 'Groove', 'Drill Mount', 'Custom'];
const remakeOptions = ['', 'Breakage', 'Remake', 'Warranty', 'Reprocess'];

function textValue(value: string | number | null | undefined) {
  return value ?? '';
}

export default function OrderIntakeForm({ intake, onChange, onComplete }: Props) {
  function updateSection(section: IntakeSection, key: string, value: string | number | boolean) {
    onChange({
      ...intake,
      [section]: {
        ...(intake[section] as SectionValue),
        [key]: value,
      },
    });
  }

  function updateNumber(section: IntakeSection, key: string, value: string) {
    const parsed = value === '' ? 0 : Number(value);
    updateSection(section, key, Number.isNaN(parsed) ? 0 : parsed);
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-blue-500';
  const labelClass = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500';
  const sectionClass = 'rounded-2xl border border-gray-200 bg-white p-6';

  return (
    <div className="space-y-6">
      <div className={sectionClass}>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Profile Intake</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className={labelClass}>EU Profile Link</label>
            <input value={intake.profile.euProfileLink} onChange={e => updateSection('profile', 'euProfileLink', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>EU ID</label>
            <input value={intake.profile.euId} onChange={e => updateSection('profile', 'euId', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Middle Initial</label>
            <input value={intake.profile.middleInitial} onChange={e => updateSection('profile', 'middleInitial', e.target.value)} className={inputClass} maxLength={2} />
          </div>
          <div>
            <label className={labelClass}>Secondary Email</label>
            <input value={intake.profile.secondaryEmail} onChange={e => updateSection('profile', 'secondaryEmail', e.target.value)} className={inputClass} type="email" />
          </div>
          <div>
            <label className={labelClass}>Supervisor Email</label>
            <input value={intake.profile.supervisorEmail} onChange={e => updateSection('profile', 'supervisorEmail', e.target.value)} className={inputClass} type="email" />
          </div>
          <div>
            <label className={labelClass}>Cost Center</label>
            <input value={intake.profile.costCenter} onChange={e => updateSection('profile', 'costCenter', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Optician</label>
            <input value={intake.profile.opticianName} onChange={e => updateSection('profile', 'opticianName', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Multiple #</label>
            <input value={intake.profile.multipleNumber} onChange={e => updateSection('profile', 'multipleNumber', e.target.value)} className={inputClass} />
          </div>
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700">
            <input type="checkbox" checked={intake.profile.launchMultiple} onChange={e => updateSection('profile', 'launchMultiple', e.target.checked)} />
            Launch Multiple
          </label>
        </div>
      </div>

      <div className={sectionClass}>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Authorization & Billing Intake</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700">
            <input type="checkbox" checked={intake.authorization.uvExposure} onChange={e => updateSection('authorization', 'uvExposure', e.target.checked)} />
            SDGE UV Exposure
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700">
            <input type="checkbox" checked={intake.authorization.electricExposure} onChange={e => updateSection('authorization', 'electricExposure', e.target.checked)} />
            SDGE Electric Exposure
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700">
            <input type="checkbox" checked={intake.authorization.authRequested} onChange={e => updateSection('authorization', 'authRequested', e.target.checked)} />
            Authorization Requested
          </label>
          <div>
            <label className={labelClass}>Auth / Approval Status</label>
            <select value={intake.authorization.authApprovalStatus} onChange={e => updateSection('authorization', 'authApprovalStatus', e.target.value as OrderAuthorizationIntake['authApprovalStatus'])} className={inputClass}>
              {authStatuses.map(status => (
                <option key={status} value={status}>
                  {status.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Auth Form Link</label>
            <input value={intake.authorization.authFormLink} onChange={e => updateSection('authorization', 'authFormLink', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Dispense Type</label>
            <select value={intake.authorization.dispenseType} onChange={e => updateSection('authorization', 'dispenseType', e.target.value)} className={inputClass}>
              {dispenseTypes.map(type => (
                <option key={type} value={type}>
                  {type.replace(/-/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Invoice Type</label>
            <select value={intake.authorization.invoiceType} onChange={e => updateSection('authorization', 'invoiceType', e.target.value)} className={inputClass}>
              {invoiceTypes.map(type => (
                <option key={type} value={type}>
                  {type.replace(/-/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Allowance</label>
            <input type="number" step="0.01" value={textValue(intake.authorization.allowance)} onChange={e => updateNumber('authorization', 'allowance', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Service & Tech Fee</label>
            <input type="number" step="0.01" value={textValue(intake.authorization.serviceAndTechFee)} onChange={e => updateNumber('authorization', 'serviceAndTechFee', e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Prescription & Measurements</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700">
            <input type="checkbox" checked={intake.prescription.rxToCome} onChange={e => updateSection('prescription', 'rxToCome', e.target.checked)} />
            Rx To Come
          </label>
          <div>
            <label className={labelClass}>Rx Expiration</label>
            <input type="date" value={intake.prescription.rxExpirationDate} onChange={e => updateSection('prescription', 'rxExpirationDate', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Rx Upload Path</label>
            <input value={intake.prescription.rxUploadPath} onChange={e => updateSection('prescription', 'rxUploadPath', e.target.value)} className={inputClass} />
          </div>
          <div className="xl:col-span-4">
            <label className={labelClass}>Rx Notes</label>
            <textarea value={intake.prescription.rxNotes} onChange={e => updateSection('prescription', 'rxNotes', e.target.value)} className={inputClass} rows={2} />
          </div>
          <div>
            <label className={labelClass}>OD PD</label>
            <input type="number" step="0.5" value={textValue(intake.prescription.odPd)} onChange={e => updateNumber('prescription', 'odPd', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>OS PD</label>
            <input type="number" step="0.5" value={textValue(intake.prescription.osPd)} onChange={e => updateNumber('prescription', 'osPd', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>OD HT</label>
            <input type="number" step="0.5" value={textValue(intake.prescription.odHeight)} onChange={e => updateNumber('prescription', 'odHeight', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>OS HT</label>
            <input type="number" step="0.5" value={textValue(intake.prescription.osHeight)} onChange={e => updateNumber('prescription', 'osHeight', e.target.value)} className={inputClass} />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Product Intake</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <label className={labelClass}>Frame Selected</label>
            <input value={intake.product.frameSelected} onChange={e => updateSection('product', 'frameSelected', e.target.value)} className={inputClass} placeholder="ARX | 7107P | 48-21-145 | BLK" />
          </div>
          <div>
            <label className={labelClass}>SO Frame Price</label>
            <input type="number" step="0.01" value={textValue(intake.product.framePrice)} onChange={e => updateNumber('product', 'framePrice', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Side Shield Type</label>
            <select value={intake.product.sideShieldType} onChange={e => updateSection('product', 'sideShieldType', e.target.value)} className={inputClass}>
              {sideShieldTypes.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Side Shield Options</label>
            <input value={intake.product.sideShieldOptions} onChange={e => updateSection('product', 'sideShieldOptions', e.target.value)} className={inputClass} placeholder="No SS Options" />
          </div>
          <div>
            <label className={labelClass}>SO / Clearance Frame ID</label>
            <input value={intake.product.sideShieldClearanceCode} onChange={e => updateSection('product', 'sideShieldClearanceCode', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Lens Type</label>
            <select value={intake.product.lensType} onChange={e => updateSection('product', 'lensType', e.target.value)} className={inputClass}>
              <option value="">Select lens type</option>
              {lensTypeOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Lens Material</label>
            <select value={intake.product.lensMaterial} onChange={e => updateSection('product', 'lensMaterial', e.target.value)} className={inputClass}>
              <option value="">Select lens material</option>
              {lensMaterialOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Lens Coating</label>
            <select value={intake.product.lensCoating} onChange={e => updateSection('product', 'lensCoating', e.target.value)} className={inputClass}>
              {coatingOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Mirror</label>
            <select value={intake.product.mirror} onChange={e => updateSection('product', 'mirror', e.target.value)} className={inputClass}>
              {mirrorOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tint</label>
            <select value={intake.product.tint} onChange={e => updateSection('product', 'tint', e.target.value)} className={inputClass}>
              {tintOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Special Edging</label>
            <select value={intake.product.specialEdging} onChange={e => updateSection('product', 'specialEdging', e.target.value)} className={inputClass}>
              {edgingOptions.map(option => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Optional Fee</label>
            <input type="number" step="0.01" value={textValue(intake.product.optionalFee)} onChange={e => updateNumber('product', 'optionalFee', e.target.value)} className={inputClass} />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <label className={labelClass}>Customer Ship Address</label>
            <textarea value={intake.product.customerShipAddress} onChange={e => updateSection('product', 'customerShipAddress', e.target.value)} className={inputClass} rows={2} />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <label className={labelClass}>Optician Notes</label>
            <textarea value={intake.product.opticianNotes} onChange={e => updateSection('product', 'opticianNotes', e.target.value)} className={inputClass} rows={2} />
          </div>
        </div>
      </div>

      <div className={sectionClass}>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Finance & Ops Intake</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <label className={labelClass}>Discount</label>
            <input type="number" step="0.01" value={textValue(intake.finance.discount)} onChange={e => updateNumber('finance', 'discount', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>OOP Paid Date</label>
            <input type="date" value={intake.finance.oopPaidDate} onChange={e => updateSection('finance', 'oopPaidDate', e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Remake Type</label>
            <select value={intake.finance.remakeType} onChange={e => updateSection('finance', 'remakeType', e.target.value)} className={inputClass}>
              {remakeOptions.map(option => (
                <option key={option || 'blank'} value={option}>
                  {option || 'Select remake type'}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700">
            <input type="checkbox" checked={intake.finance.oopBalanceDue} onChange={e => updateSection('finance', 'oopBalanceDue', e.target.checked)} />
            OOP Balance Due
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700">
            <input type="checkbox" checked={intake.finance.sendItemizedReceipt} onChange={e => updateSection('finance', 'sendItemizedReceipt', e.target.checked)} />
            Send Itemized Receipt
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700">
            <input type="checkbox" checked={intake.finance.logCashReceived} onChange={e => updateSection('finance', 'logCashReceived', e.target.checked)} />
            Log Cash Received
          </label>
          <div className="md:col-span-2 xl:col-span-3">
            <label className={labelClass}>Finance Notes</label>
            <textarea value={intake.finance.financeNotes} onChange={e => updateSection('finance', 'financeNotes', e.target.value)} className={inputClass} rows={2} />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <label className={labelClass}>Notes To Ops</label>
            <textarea value={intake.finance.notesToOps} onChange={e => updateSection('finance', 'notesToOps', e.target.value)} className={inputClass} rows={2} />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <label className={labelClass}>Comments</label>
            <textarea value={intake.finance.comments} onChange={e => updateSection('finance', 'comments', e.target.value)} className={inputClass} rows={2} />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onComplete}
          className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Continue to Backend Summary
        </button>
      </div>
    </div>
  );
}
