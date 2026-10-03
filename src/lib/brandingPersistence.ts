import { idbSaveBranding } from "../localDb";

export type BrandingLogo = { id: string; name: string; url: string };

export type PersistBrandingOverrides = {
  customLogos?: BrandingLogo[];
  selectedLogo?: string;
  selectedLogoRight?: string;
  customLogoStyle?: string;
  customSignatureUrl?: string;
};

export type PersistBrandingCurrent = {
  customLogos: BrandingLogo[];
  selectedLogo: string;
  selectedLogoRight: string;
  customLogoStyle: string;
  customSignatureUrl: string;
};

/** Persist branding assets to IndexedDB + localStorage (quota-safe). */
export async function persistBrandingAssets(
  current: PersistBrandingCurrent,
  overrides?: PersistBrandingOverrides
): Promise<void> {
  const logos = overrides?.customLogos ?? current.customLogos;
  const leftId = overrides?.selectedLogo ?? current.selectedLogo;
  const rightId = overrides?.selectedLogoRight ?? current.selectedLogoRight;
  const style = overrides?.customLogoStyle ?? current.customLogoStyle;
  const signature = overrides?.customSignatureUrl ?? current.customSignatureUrl;

  try {
    await idbSaveBranding({
      customLogos: logos,
      selectedLogo: leftId,
      selectedLogoRight: rightId,
      customLogoStyle: style,
      customSignatureUrl: signature || "",
      updatedAt: Date.now(),
    });
  } catch (e) {
    console.warn("Could not persist branding to IndexedDB:", e);
  }

  try {
    localStorage.setItem("rad_selected_logo", leftId);
    localStorage.setItem("rad_selected_logo_right", rightId);
    localStorage.setItem("rad_custom_logo_style", style);
  } catch (e) {
    console.warn("Could not persist logo selection keys:", e);
  }

  try {
    localStorage.setItem("rad_custom_logos", JSON.stringify(logos));
  } catch (e) {
    // Banner images often exceed the ~5MB localStorage quota. Keep IndexedDB copy.
    console.warn("localStorage full for logos/banner; kept durable copy in IndexedDB:", e);
    try {
      localStorage.removeItem("rad_custom_logos");
    } catch {
      /* ignore */
    }
  }

  if (typeof signature === "string" && signature) {
    try {
      localStorage.setItem("rad_custom_signature", signature);
    } catch (e) {
      console.warn("localStorage full for signature; kept durable copy in IndexedDB:", e);
    }
  }
}
