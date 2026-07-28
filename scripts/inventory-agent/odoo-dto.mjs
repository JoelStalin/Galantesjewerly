import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

export class OdooFieldRegistry {
  constructor(schema) { this.schema=schema; this.fields=new Set(Object.keys(schema.fields||{})); this.required=new Set(schema.requiredForCreate||[]); this.readonly=new Set(schema.readonlyOrComputed||[]); this.allowlist=new Set(schema.writeAllowlist||[]); }
  validate(values,{create=true}={}) { const unknown=Object.keys(values).filter(k=>!this.fields.has(k)); const readonly=Object.keys(values).filter(k=>this.readonly.has(k)); const blocked=Object.keys(values).filter(k=>!this.allowlist.has(k)); const missing=create?[...this.required].filter(k=>values[k]===undefined||values[k]===null||values[k]===''):[]; return {ok:!unknown.length&&!readonly.length&&!blocked.length&&!missing.length,unknown,readonly,blocked,missing}; }
  sanitize(values) { return Object.fromEntries(Object.entries(values).filter(([k])=>this.fields.has(k)&&this.allowlist.has(k)&&!this.readonly.has(k))); }
}
export class OdooRecordDTO { constructor(registry,values={}){this.registry=registry;this.values={...values};} validate(options){return this.registry.validate(this.values,options);} toJSON(options){const result=this.validate(options);if(!result.ok)throw new Error(`Invalid Odoo DTO: ${JSON.stringify(result)}`);return this.registry.sanitize(this.values);} }
export class ProductTemplateDTO extends OdooRecordDTO { constructor(registry,values){super(registry,{type:'consu',sale_ok:true,purchase_ok:false,is_published:false,website_published:false,...values});} }
export class ProductGalleryDTO { constructor(clusterId,primaryImagePath,galleryImagePaths=[]){this.clusterId=clusterId;this.primaryImagePath=primaryImagePath;this.galleryImagePaths=[...galleryImagePaths];} validate(){return Boolean(this.clusterId&&this.primaryImagePath)&&this.galleryImagePaths.every(Boolean);} }
export class ProductPublicationDTO { constructor(registry,draft){this.product=new ProductTemplateDTO(registry,draft.vals);this.gallery=new ProductGalleryDTO(draft.clusterId,draft.primaryImagePath,draft.galleryImagePaths);this.approvedStock=draft.approvedStock;} validate(){const product=this.product.validate({create:true});const stock=Number.isInteger(this.approvedStock)&&this.approvedStock>=0;return {ok:product.ok&&stock&&this.gallery.validate(),product,stock,gallery:this.gallery.validate()};} }
export async function loadOdooFieldRegistry(schemaPath='scripts/inventory-agent/odoo-product-template.dto.json'){return new OdooFieldRegistry(JSON.parse(await readFile(path.join(root,schemaPath),'utf8')));}
