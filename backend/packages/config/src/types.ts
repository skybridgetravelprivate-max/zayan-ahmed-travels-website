export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "datetime"
  | "select"
  | "boolean"
  | "email"
  | "phone"
  | "money";

export type EntityField = {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  filter?: boolean;
  search?: boolean;
};

export type EntityDef = {
  key: string;
  prisma: string;
  path: string;
  permission: string;
  title: string;
  titleField: string;
  numberField?: string;
  branchScoped?: boolean;
  defaultSort?: string;
  fields: EntityField[];
};
