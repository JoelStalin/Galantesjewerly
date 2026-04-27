export type CarrierType = 'usps' | 'ups' | 'fedex' | 'pickup';

export interface ShippingRate {
  carrier: CarrierType;
  serviceName: string;
  price: number;
  currency: string;
  estimatedDays: number;
  insuranceIncluded: boolean;
  insuranceValue: number;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface PackageDetails {
  weightLbs: number;
  value: number; // For insurance
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
}
