const ISO_4217_CODES = new Set(
  "AED AFN ALL AMD ANG AOA ARS AUD AWG AZN BAM BBD BDT BGN BHD BIF BMD BND BOB BOV BRL BSD BTN BWP BYN BZD CAD CDF CHE CHF CHW CLF CLP CNY COP COU CRC CUC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MXV MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SLL SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD USN UYI UYU UYW UZS VED VES VND VUV WST XAF XAG XAU XBA XBB XBC XBD XCD XCG XDR XOF XPD XPF XPT XSU XTS XUA XXX YER ZAR ZMW ZWG".split(" ")
);

export function isValidCurrencyCode(value: string | null | undefined): value is string {
  return typeof value === "string" && ISO_4217_CODES.has(value.toUpperCase());
}

export function normalizeDecimal(value: string | number | null | undefined): string | null {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(raw)) return null;
  const [whole, fraction = ""] = raw.split(".");
  const trimmedFraction = fraction.replace(/0+$/, "");
  const normalizedWhole = whole.replace(/^0+(?=\d)/, "");
  return trimmedFraction ? `${normalizedWhole}.${trimmedFraction}` : normalizedWhole;
}

export function multiplyDecimal(value: string, quantity: number): string {
  const normalized = normalizeDecimal(value);
  if (!normalized || !Number.isInteger(quantity) || quantity < 0) {
    throw new Error("Invalid decimal multiplication input");
  }
  const [whole, fraction = ""] = normalized.split(".");
  const scaled = BigInt(`${whole}${fraction}`) * BigInt(quantity);
  return fromScaledInteger(scaled, fraction.length);
}

export function addDecimals(left: string, right: string): string {
  const leftValue = normalizeDecimal(left);
  const rightValue = normalizeDecimal(right);
  if (leftValue == null || rightValue == null) throw new Error("Invalid decimal addition input");
  const leftParts = leftValue.split(".");
  const rightParts = rightValue.split(".");
  const scale = Math.max(leftParts[1]?.length ?? 0, rightParts[1]?.length ?? 0);
  const leftScaled = BigInt(leftParts.join("")) * BigInt(10) ** BigInt(scale - (leftParts[1]?.length ?? 0));
  const rightScaled = BigInt(rightParts.join("")) * BigInt(10) ** BigInt(scale - (rightParts[1]?.length ?? 0));
  return fromScaledInteger(leftScaled + rightScaled, scale);
}

export function formatDecimal(value: string, minimumFractionDigits = 2): string {
  const normalized = normalizeDecimal(value);
  if (normalized == null) return value;
  const [whole, fraction = ""] = normalized.split(".");
  return `${whole}.${fraction.padEnd(minimumFractionDigits, "0")}`;
}

function fromScaledInteger(value: bigint, scale: number): string {
  if (scale === 0) return value.toString();
  const digits = value.toString().padStart(scale + 1, "0");
  return normalizeDecimal(`${digits.slice(0, -scale)}.${digits.slice(-scale)}`) ?? "0";
}
