import type { OrderIntake, OrderType, Prescription } from '@/lib/types';

export function createEmptyOrderIntake(orderType: OrderType, customerId = '', prescriptionId: string | null = null): OrderIntake {
  return {
    orderType,
    customerId,
    prescriptionId,
    profile: {
      euProfileLink: '',
      euId: '',
      middleInitial: '',
      secondaryEmail: '',
      supervisorEmail: '',
      costCenter: '',
      opticianName: '',
      multipleNumber: '',
      launchMultiple: false,
    },
    authorization: {
      uvExposure: false,
      electricExposure: false,
      authRequested: false,
      authApprovalStatus: 'not_required',
      authFormLink: '',
      dispenseType: 'office-pickup',
      invoiceType: orderType === 'program' ? 'program-allowance' : 'out-of-pocket',
      allowance: 0,
      serviceAndTechFee: 15,
    },
    prescription: {
      rxToCome: false,
      rxExpirationDate: '',
      rxUploadPath: '',
      rxNotes: '',
      odSphere: null,
      odCylinder: null,
      odAxis: null,
      osSphere: null,
      osCylinder: null,
      osAxis: null,
      odAdd: null,
      osAdd: null,
      odPrism: null,
      odPrismDirection: '',
      osPrism: null,
      osPrismDirection: '',
      odPd: null,
      osPd: null,
      odHeight: null,
      osHeight: null,
    },
    product: {
      frameSelected: '',
      framePrice: 0,
      sideShieldType: 'none',
      sideShieldOptions: '',
      sideShieldClearanceCode: '',
      lensType: '',
      lensMaterial: '',
      lensCoating: 'No Coating',
      mirror: 'No Mirror',
      tint: 'Clear',
      specialEdging: 'No Special Edge',
      optionalFee: 0,
      customerShipAddress: '',
      opticianNotes: '',
    },
    finance: {
      discount: 0,
      oopBalanceDue: false,
      oopPaidDate: '',
      financeNotes: '',
      sendItemizedReceipt: false,
      logCashReceived: false,
      notesToOps: '',
      remakeType: '',
      comments: '',
    },
  };
}

export function applyPrescriptionToIntake(intake: OrderIntake, prescription: Prescription | null): OrderIntake {
  if (!prescription) {
    return intake;
  }

  return {
    ...intake,
    prescriptionId: prescription.id,
    prescription: {
      ...intake.prescription,
      rxExpirationDate: prescription.expiration_date || '',
      rxUploadPath: prescription.pdf_storage_path || '',
      rxNotes: prescription.notes || '',
      odSphere: prescription.od_sphere,
      odCylinder: prescription.od_cylinder,
      odAxis: prescription.od_axis,
      osSphere: prescription.os_sphere,
      osCylinder: prescription.os_cylinder,
      osAxis: prescription.os_axis,
      odAdd: prescription.od_add,
      osAdd: prescription.os_add,
      odPrism: prescription.od_prism,
      odPrismDirection: prescription.od_prism_base || '',
      osPrism: prescription.os_prism,
      osPrismDirection: prescription.os_prism_base || '',
    },
  };
}
