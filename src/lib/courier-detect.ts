const normalizeTrackingNo = (trackingNo: string) => trackingNo.replace(/\s|-/g, "").toUpperCase();

export function detectCourierByTrackingNo(trackingNo: string) {
  const no = normalizeTrackingNo(trackingNo);
  if (no.length < 5) return null;

  if (/^SF\d{8,}$/.test(no) || /^SF[A-Z0-9]{10,}$/.test(no)) return "顺丰速运";
  if (/^(JD|JDL|JDV|JDX)\d{8,}$/.test(no) || /^V[A-Z0-9]{10,}$/.test(no)) return "京东物流";
  if (/^(YT|YTO)\d{8,}$/.test(no)) return "圆通速递";
  if (/^(STO|ST)\d{8,}$/.test(no)) return "申通快递";
  if (/^(JT|JNT|JTSD)\d{8,}$/.test(no)) return "极兔速递";
  if (/^(YZ|EMS|EM|EA|EB|EC|ED|EE|EZ|GA|KA|KJ|LB|LC|LK|LP|RA|RB|RC|RR|SA|SB|SD|XA)\d{8,}/.test(no)) return "EMS";
  if (/^(DPK|DBL|DEPPON)\d{8,}$/.test(no)) return "德邦快递";
  if (/^ZTO\d{8,}$/.test(no)) return "中通快递";
  if (/^YD\d{8,}$/.test(no)) return "韵达快递";

  if (/^\d+$/.test(no)) {
    if (/^7\d{11,14}$/.test(no)) return "中通快递";
    if (/^4\d{11,14}$/.test(no) || /^9\d{11,14}$/.test(no)) return "韵达快递";
    if (/^8\d{11,14}$/.test(no)) return "圆通速递";
    if (/^3\d{11,14}$/.test(no)) return "申通快递";
    if (/^1\d{11,14}$/.test(no)) return "极兔速递";
  }

  return null;
}
