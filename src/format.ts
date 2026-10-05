export function number(value: number | null | undefined) {
  if (value === null || value === undefined) return "Nao disponivel na fonte";
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function percent(value: number | null | undefined) {
  if (value === null || value === undefined) return "Nao disponivel na fonte";
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + "%";
}

export function dateTime(value?: string) {
  if (!value) return "Nao informado pela fonte";
  return value;
}
