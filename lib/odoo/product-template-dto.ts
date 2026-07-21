export type OdooScalar = string | number | boolean | null;
export type OdooRelationalCommand = [number, number, unknown?];
export type OdooMany2One = number | [number, string] | false;

export type OdooProductTemplateDTO = {
  id?: number;
  name: string;
  display_name?: string;
  default_code?: string | false;
  barcode?: string | false;
  type?: 'consu' | 'service' | 'combo' | 'product' | string;
  sale_ok?: boolean;
  purchase_ok?: boolean;
  is_published?: boolean;
  website_published?: boolean;
  available_in_pos?: boolean;
  website_sequence?: number;
  public_categ_ids?: number[] | OdooRelationalCommand[];
  categ_id?: OdooMany2One;
  list_price: number;
  standard_price?: number;
  taxes_id?: number[] | OdooRelationalCommand[];
  supplier_taxes_id?: number[] | OdooRelationalCommand[];
  description?: string | false;
  description_sale?: string | false;
  description_purchase?: string | false;
  website_description?: string | false;
  image_1920?: string | false;
  attribute_line_ids?: OdooRelationalCommand[];
  optional_product_ids?: number[] | OdooRelationalCommand[];
  accessory_product_ids?: number[] | OdooRelationalCommand[];
  alternative_product_ids?: number[] | OdooRelationalCommand[];
  invoice_policy?: 'order' | 'delivery' | string;
  uom_id?: OdooMany2One;
  uom_po_id?: OdooMany2One;
  tracking?: 'none' | 'lot' | 'serial' | string;
  responsible_id?: OdooMany2One;
  route_ids?: number[] | OdooRelationalCommand[];
  sale_delay?: number;
  weight?: number;
  volume?: number;

  // Read-only/computed inventory and audit fields. The bot must not write these.
  qty_available?: number;
  virtual_available?: number;
  free_qty?: number;
  incoming_qty?: number;
  outgoing_qty?: number;
  product_variant_id?: OdooMany2One;
  product_variant_ids?: number[];
  product_variant_count?: number;
  currency_id?: OdooMany2One;
  company_id?: OdooMany2One;
  create_uid?: OdooMany2One;
  create_date?: string;
  write_uid?: OdooMany2One;
  write_date?: string;
  __last_update?: string;
};

export type GalantesInventoryProductDraftDTO = {
  clusterId: string;
  odoo: Pick<OdooProductTemplateDTO, 'name' | 'list_price'> &
    Partial<OdooProductTemplateDTO> & {
      sale_ok: true;
      purchase_ok: boolean;
      type: string;
    };
  approvedStock: number;
  imagePaths: string[];
  approvedByUser: true;
};
