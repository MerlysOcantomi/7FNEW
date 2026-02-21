import QRCode from "qrcode"

const SKINA_BLUE = "#1a3a5c"

export interface QROptions {
  width?: number
  margin?: number
  color?: { dark?: string; light?: string }
}

const DEFAULT_OPTIONS: QROptions = {
  width: 400,
  margin: 2,
  color: { dark: SKINA_BLUE, light: "#ffffff" },
}

export async function generateQRDataURL(
  url: string,
  options?: QROptions,
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  const dataUrl = await QRCode.toDataURL(url, {
    width: opts.width,
    margin: opts.margin,
    color: {
      dark: opts.color?.dark ?? SKINA_BLUE,
      light: opts.color?.light ?? "#ffffff",
    },
    errorCorrectionLevel: "M",
  })

  return dataUrl
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}
