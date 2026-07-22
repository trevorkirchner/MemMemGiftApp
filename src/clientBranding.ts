import defaultBackgroundImage from "./assets/Hole7.png";
import defaultLogo from "./assets/PenGoldLogo.png";

type ClientBranding = {
  appName: string;
  orgName: string;
  slug: string;
  participantPortalTitle: string;
  adminPortalTitle: string;
  logoUrl: string;
  backgroundImageUrl: string;
  primaryColor: string;
  primaryDarkColor: string;
  primaryMidColor: string;
};

const env = import.meta.env;
const orgName = env.VITE_ORG_NAME || "Peninsula";
const appName = env.VITE_APP_NAME || "TourneyGifts";

export const clientBranding: ClientBranding = {
  appName,
  orgName,
  slug: env.VITE_CLIENT_SLUG || "peninsula",
  participantPortalTitle:
    env.VITE_PARTICIPANT_PORTAL_TITLE || `${orgName} Gift Portal`,
  adminPortalTitle: env.VITE_ADMIN_PORTAL_TITLE || `${orgName} Admin Portal`,
  logoUrl: env.VITE_LOGO_URL || defaultLogo,
  backgroundImageUrl: env.VITE_BACKGROUND_IMAGE_URL || defaultBackgroundImage,
  primaryColor: env.VITE_PRIMARY_COLOR || "#123c2c",
  primaryDarkColor: env.VITE_PRIMARY_DARK_COLOR || "#0b2a1f",
  primaryMidColor: env.VITE_PRIMARY_MID_COLOR || "#3e7159",
};

export function applyClientBranding() {
  document.documentElement.style.setProperty(
    "--tg-primary",
    clientBranding.primaryColor
  );
  document.documentElement.style.setProperty(
    "--tg-primary-dark",
    clientBranding.primaryDarkColor
  );
  document.documentElement.style.setProperty(
    "--tg-primary-mid",
    clientBranding.primaryMidColor
  );

  document.title = clientBranding.appName;
}
