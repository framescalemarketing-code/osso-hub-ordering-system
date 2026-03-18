import { integrations } from './config';
import type { OrderItem } from '@/lib/types';

interface LensOrderPayload {
  orderItem: OrderItem;
  prescription: {
    od_sphere?: number | null; od_cylinder?: number | null; od_axis?: number | null; od_add?: number | null;
    os_sphere?: number | null; os_cylinder?: number | null; os_axis?: number | null; os_add?: number | null;
    pd_distance?: number | null; pd_right?: number | null; pd_left?: number | null;
  };
  patientName: string;
  orderNumber: string;
}

export async function orderLensFromVendor(payload: LensOrderPayload): Promise<{ vendorOrderId: string } | null> {
  const vendor = payload.orderItem.lens_vendor;
  if (!vendor || vendor === 'other') return null;

  if (vendor === 'nassau' && integrations.nassau.enabled()) {
    return await orderFromNassau(payload);
  }
  if (vendor === 'abb_optical' && integrations.abb_optical.enabled()) {
    return await orderFromABB(payload);
  }

  return null;
}

async function orderFromNassau(payload: LensOrderPayload): Promise<{ vendorOrderId: string }> {
  const body = {
    patient_name: payload.patientName,
    reference: payload.orderNumber,
    lens: {
      type: payload.orderItem.lens_type,
      material: payload.orderItem.lens_material,
      coating: payload.orderItem.lens_coating,
      tint: payload.orderItem.lens_tint,
    },
    rx: {
      od: { sph: payload.prescription.od_sphere, cyl: payload.prescription.od_cylinder, axis: payload.prescription.od_axis, add: payload.prescription.od_add },
      os: { sph: payload.prescription.os_sphere, cyl: payload.prescription.os_cylinder, axis: payload.prescription.os_axis, add: payload.prescription.os_add },
      pd: { distance: payload.prescription.pd_distance, mono_right: payload.prescription.pd_right, mono_left: payload.prescription.pd_left },
    },
    frame: {
      brand: payload.orderItem.frame_brand,
      model: payload.orderItem.frame_model,
      color: payload.orderItem.frame_color,
      size: payload.orderItem.frame_size,
    },
  };

  const res = await fetch(`${process.env.NASSAU_API_URL}/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NASSAU_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Nassau order failed: ${res.status}`);
  const data = await res.json();
  return { vendorOrderId: data.order_id || data.id };
}

async function orderFromABB(payload: LensOrderPayload): Promise<{ vendorOrderId: string }> {
  const body = {
    patientName: payload.patientName,
    externalReference: payload.orderNumber,
    lens: {
      lensType: payload.orderItem.lens_type,
      material: payload.orderItem.lens_material,
      coatings: payload.orderItem.lens_coating,
      tint: payload.orderItem.lens_tint,
    },
    prescription: {
      rightEye: { sphere: payload.prescription.od_sphere, cylinder: payload.prescription.od_cylinder, axis: payload.prescription.od_axis, addPower: payload.prescription.od_add },
      leftEye: { sphere: payload.prescription.os_sphere, cylinder: payload.prescription.os_cylinder, axis: payload.prescription.os_axis, addPower: payload.prescription.os_add },
      pd: { distance: payload.prescription.pd_distance, rightMono: payload.prescription.pd_right, leftMono: payload.prescription.pd_left },
    },
    frame: {
      brand: payload.orderItem.frame_brand,
      model: payload.orderItem.frame_model,
    },
  };

  const res = await fetch(`${process.env.ABB_OPTICAL_API_URL}/api/v1/orders`, {
    method: 'POST',
    headers: {
      'X-Api-Key': process.env.ABB_OPTICAL_API_KEY!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`ABB Optical order failed: ${res.status}`);
  const data = await res.json();
  return { vendorOrderId: data.orderId || data.id };
}
