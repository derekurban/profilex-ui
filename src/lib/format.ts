const numFmt = new Intl.NumberFormat();
const usdFmt = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});
const pctFmt = new Intl.NumberFormat(undefined, {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const fmtNum = (n: number): string => numFmt.format(Math.round(n));

export const fmtUSD = (n: number): string => usdFmt.format(n || 0);

export const fmtPercent = (n: number): string => pctFmt.format(n);
