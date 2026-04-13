function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeDeep(baseValue, overrideValue) {
  if (Array.isArray(baseValue) || Array.isArray(overrideValue)) {
    return Array.isArray(overrideValue) ? overrideValue.slice() : Array.isArray(baseValue) ? baseValue.slice() : overrideValue;
  }

  if (isPlainObject(baseValue) || isPlainObject(overrideValue)) {
    const result = { ...(isPlainObject(baseValue) ? baseValue : {}) };

    Object.entries(isPlainObject(overrideValue) ? overrideValue : {}).forEach(([key, value]) => {
      result[key] = mergeDeep(result[key], value);
    });

    return result;
  }

  return overrideValue === undefined ? baseValue : overrideValue;
}

function hasMojibake(value) {
  return /Ã.|Â.|Æ.|Ä.|áº|á»/.test(String(value || ""));
}

function repairMojibakeText(value) {
  const source = String(value ?? "");

  if (!source) {
    return "";
  }

  if (!hasMojibake(source)) {
    return source.normalize("NFC");
  }

  const bytes = [];

  for (const char of source) {
    const codePoint = char.charCodeAt(0);

    if (codePoint > 255) {
      return source.normalize("NFC");
    }

    bytes.push(codePoint);
  }

  try {
    const repaired = new TextDecoder("utf-8").decode(new Uint8Array(bytes));

    if (repaired.includes("�")) {
      return source.normalize("NFC");
    }

    return repaired.normalize("NFC");
  } catch (error) {
    return source.normalize("NFC");
  }
}

function normalizeNestedText(value) {
  if (typeof value === "string") {
    return repairMojibakeText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeNestedText(item));
  }

  if (isPlainObject(value)) {
    const result = {};

    Object.entries(value).forEach(([key, childValue]) => {
      result[key] = normalizeNestedText(childValue);
    });

    return result;
  }

  return value;
}

function splitDisplayTwoLines(value) {
  const normalized = String(value || "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (!normalized.length) {
    return {
      line1: "",
      line2: "",
    };
  }

  return {
    line1: normalized[0],
    line2: normalized.slice(1).join(" ").trim(),
  };
}

function composeDisplayTwoLines(line1, line2) {
  const firstLine = String(line1 || "").normalize("NFC").trim();
  const secondLine = String(line2 || "").normalize("NFC").trim();

  if (!firstLine) {
    return secondLine;
  }

  return secondLine ? `${firstLine}\n${secondLine}` : firstLine;
}

function loadCmsPreviewConfig() {
  const params = new URLSearchParams(window.location.search);

  if (params.get("cmsPreview") !== "1") {
    return null;
  }

  try {
    return JSON.parse(localStorage.getItem("landingCmsPreview") || "null");
  } catch (error) {
    return null;
  }
}

function toZaloUrl(value) {
  const phone = String(value || "").trim();
  return phone ? `https://zalo.me/${phone}` : "";
}

function normalizeWhatsAppPhone(value) {
  let phone = String(value || "")
    .trim()
    .replace(/[^\d+]/g, "");

  if (!phone) {
    return "";
  }

  if (phone.startsWith("+")) {
    phone = phone.slice(1);
  }

  if (phone.startsWith("00")) {
    phone = phone.slice(2);
  }

  if (/^0\d{8,14}$/.test(phone)) {
    phone = `84${phone.slice(1)}`;
  }

  if (/^840\d{8,13}$/.test(phone)) {
    phone = `84${phone.slice(3)}`;
  }

  return /^\d+$/.test(phone) ? phone : "";
}

function toWhatsAppUrl(value) {
  const normalizedPhone = normalizeWhatsAppPhone(value);

  return normalizedPhone ? `https://api.whatsapp.com/send?phone=${normalizedPhone}` : "";
}

function normalizeWhatsAppUrl(value, fallbackPhone = "") {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return toWhatsAppUrl(fallbackPhone);
  }

  const waMeMatch = rawValue.match(/(?:https?:\/\/)?(?:www\.)?wa\.me\/([^/?#]+)/i);

  if (waMeMatch?.[1]) {
    return toWhatsAppUrl(waMeMatch[1]) || rawValue;
  }

  if (/^https?:\/\//i.test(rawValue)) {
    try {
      const url = new URL(rawValue);
      const host = String(url.hostname || "").toLowerCase();

      if (host === "api.whatsapp.com" && url.pathname.startsWith("/send")) {
        const phoneParam = url.searchParams.get("phone");
        const textParam = url.searchParams.get("text");
        const normalizedHref = toWhatsAppUrl(phoneParam);

        if (!normalizedHref) {
          return rawValue;
        }

        if (!textParam) {
          return normalizedHref;
        }

        return `${normalizedHref}?text=${encodeURIComponent(textParam)}`;
      }
    } catch (error) {
      return rawValue;
    }

    return rawValue;
  }

  return toWhatsAppUrl(rawValue) || rawValue;
}

const DEFAULT_BACKGROUND_COLOR = "#f3e1e1";

function normalizeHexColor(value, fallback = DEFAULT_BACKGROUND_COLOR) {
  const normalized = String(value || "").trim().toLowerCase();

  if (/^#[0-9a-f]{6}$/.test(normalized)) {
    return normalized;
  }

  if (/^#[0-9a-f]{3}$/.test(normalized)) {
    const [, r, g, b] = normalized;
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  return fallback;
}

function getDefaultButtonLabels() {
  return {
    links: {
      map: "Google Map",
      facebook: "Facebook",
      youtube: "YouTube",
      tiktok: "TikTok",
      zalo: "Zalo",
      hotline: "Hotline",
      biography: "Biography",
    },
    support: {
      share: "Chia sẻ",
      saveContact: "Lưu danh bạ",
      email: "Email",
    },
    dock: {
      phone: "Gọi ngay",
      zalo: "Nhắn Zalo",
      whatsapp: "WhatsApp",
    },
  };
}

function buildDefaultLinks(config) {
  const links = [];
  const labels = config.buttons?.links || getDefaultButtonLabels().links;
  const socialProfiles = config.socialProfiles || {};

  if (config.social.map) {
    links.push({
      title: labels.map || "Google Map",
      href: config.social.map,
      icon: "map",
      accent: "map",
    });
  }

  ["facebook", "youtube", "tiktok", "zalo"].forEach((platform) => {
    const profile = socialProfiles[platform];

    if (!profile?.enabled || !profile?.url) {
      return;
    }

    links.push({
      title: profile.label || labels[platform] || platform,
      href: String(profile.url).trim(),
      icon: platform,
      accent: platform,
    });
  });

  if (config.social.hotlineZalo || config.hotline) {
    links.push({
      title: labels.hotline || "Hotline",
      href: config.social.hotlineZalo || `https://zalo.me/${config.hotline}`,
      icon: "hotline",
      accent: "hotline",
    });
  }

  links.push({
    title: labels.biography || "Biography",
    href: "#bio-modal",
    icon: "doctor",
    accent: "doctor",
    action: "open-bio",
  });

  return links;
}

function normalizeLandingConfig(rawConfig) {
  const defaultButtonLabels = getDefaultButtonLabels();
  const defaults = {
    brandShort: "",
    title: "",
    titleLine2: "",
    subtitle: "",
    departmentInfo: "",
    departmentInfoLine2: "",
    phone: "",
    hotline: "",
    email: "",
    social: {
      map: "",
      facebook: "",
      zalo: "",
      hotlineZalo: "",
    },
    theme: {
      backgroundColor: DEFAULT_BACKGROUND_COLOR,
    },
    socialProfiles: {
      facebook: {
        enabled: false,
        url: "",
        label: defaultButtonLabels.links.facebook,
      },
      youtube: {
        enabled: false,
        url: "",
        label: defaultButtonLabels.links.youtube,
      },
      tiktok: {
        enabled: false,
        url: "",
        label: defaultButtonLabels.links.tiktok,
      },
      zalo: {
        enabled: false,
        url: "",
        label: defaultButtonLabels.links.zalo,
      },
      whatsapp: {
        enabled: false,
        url: "",
        label: defaultButtonLabels.dock.whatsapp,
      },
    },
    buttons: defaultButtonLabels,
    branding: {
      defaultLogo: {
        src: "",
        alt: "",
      },
      locales: {},
    },
    biography: {
      imageSrc: "",
      labels: {
        vi: {
          eyebrow: "Tiểu sử",
          close: "Đóng tiểu sử",
          scrollTop: "Về đầu trang",
        },
        en: {
          eyebrow: "Biography",
          close: "Close biography",
          scrollTop: "Back to top",
        },
      },
      locales: {
        vi: {
          imageAlt: "",
          name: "",
          nameLine2: "",
          sections: [],
        },
        en: {
          imageAlt: "",
          name: "",
          nameLine2: "",
          sections: [],
        },
      },
    },
    links: [],
  };

  const config = mergeDeep(defaults, normalizeNestedText(rawConfig || {}));
  const contactPhone = String(config.phone || "").trim();
  const hotlinePhone = String(config.hotline || "").trim();
  const email = String(config.email || "").trim();
  const titleLines = splitDisplayTwoLines(config.title || "");

  config.title = titleLines.line1;
  config.titleLine2 = String(config.titleLine2 || "").normalize("NFC").trim() || titleLines.line2;
  config.phone = contactPhone;
  config.hotline = hotlinePhone;
  config.email = email;
  config.brandShort = config.brandShort || config.title || "contact";
  config.social.zalo = toZaloUrl(contactPhone) || String(config.social.zalo || "").trim();
  config.social.hotlineZalo = toZaloUrl(hotlinePhone) || String(config.social.hotlineZalo || "").trim() || config.social.zalo;
  config.theme.backgroundColor = normalizeHexColor(config.theme?.backgroundColor || DEFAULT_BACKGROUND_COLOR);
  config.buttons = mergeDeep(defaultButtonLabels, config.buttons || {});

  const legacyFacebookUrl = String(config.social.facebook || "").trim();
  config.socialProfiles = mergeDeep({
    facebook: {
      enabled: Boolean(legacyFacebookUrl),
      url: legacyFacebookUrl,
      label: config.buttons.links.facebook,
    },
    youtube: {
      enabled: false,
      url: "",
      label: config.buttons.links.youtube,
    },
    tiktok: {
      enabled: false,
      url: "",
      label: config.buttons.links.tiktok,
    },
    zalo: {
      enabled: false,
      url: "",
      label: config.buttons.links.zalo,
    },
    whatsapp: {
      enabled: false,
      url: toWhatsAppUrl(contactPhone),
      label: config.buttons.dock.whatsapp,
    },
  }, config.socialProfiles || {});

  config.socialProfiles.facebook.url = String(
    config.socialProfiles.facebook.url || legacyFacebookUrl || "",
  ).trim();
  config.socialProfiles.facebook.enabled = Boolean(
    config.socialProfiles.facebook.enabled && config.socialProfiles.facebook.url,
  );

  config.socialProfiles.youtube.url = String(config.socialProfiles.youtube.url || "").trim();
  config.socialProfiles.youtube.enabled = Boolean(
    config.socialProfiles.youtube.enabled && config.socialProfiles.youtube.url,
  );

  config.socialProfiles.tiktok.url = String(config.socialProfiles.tiktok.url || "").trim();
  config.socialProfiles.tiktok.enabled = Boolean(
    config.socialProfiles.tiktok.enabled && config.socialProfiles.tiktok.url,
  );

  config.socialProfiles.zalo.url = String(config.socialProfiles.zalo.url || "").trim();
  config.socialProfiles.zalo.enabled = Boolean(
    config.socialProfiles.zalo.enabled && config.socialProfiles.zalo.url,
  );

  config.socialProfiles.whatsapp.url = String(
    normalizeWhatsAppUrl(config.socialProfiles.whatsapp.url, contactPhone) || "",
  ).trim();
  config.socialProfiles.whatsapp.enabled = Boolean(
    config.socialProfiles.whatsapp.enabled && config.socialProfiles.whatsapp.url,
  );

  config.socialProfiles.facebook.label = String(
    config.socialProfiles.facebook.label || config.buttons.links.facebook || "Facebook",
  ).trim() || "Facebook";
  config.socialProfiles.youtube.label = String(
    config.socialProfiles.youtube.label || config.buttons.links.youtube || "YouTube",
  ).trim() || "YouTube";
  config.socialProfiles.tiktok.label = String(
    config.socialProfiles.tiktok.label || config.buttons.links.tiktok || "TikTok",
  ).trim() || "TikTok";
  config.socialProfiles.zalo.label = String(
    config.socialProfiles.zalo.label || config.buttons.links.zalo || "Zalo",
  ).trim() || "Zalo";
  config.socialProfiles.whatsapp.label = String(
    config.socialProfiles.whatsapp.label || config.buttons.dock.whatsapp || "WhatsApp",
  ).trim() || "WhatsApp";

  ["vi", "en"].forEach((locale) => {
    const localeConfig = config.biography?.locales?.[locale];

    if (!localeConfig) {
      return;
    }

    const nameLines = splitDisplayTwoLines(localeConfig.name || "");
    localeConfig.name = nameLines.line1;
    localeConfig.nameLine2 = String(localeConfig.nameLine2 || "").normalize("NFC").trim() || nameLines.line2;
  });

  config.links = Array.isArray(rawConfig?.links) && rawConfig.links.length
    ? rawConfig.links.slice()
    : buildDefaultLinks(config);

  return config;
}

const landingConfig = normalizeLandingConfig(
  mergeDeep(window.LANDING_CONFIG || {}, loadCmsPreviewConfig() || {}),
);

const iconMarkup = {
  map: `
    <svg viewBox="0 0 64 64" role="presentation" aria-hidden="true">
      <path d="M32 59c9.8-9.2 17-18.8 17-30C49 17.1 41.4 10 32 10S15 17.1 15 29c0 11.2 7.2 20.8 17 30Z" fill="#34a853"/>
      <path d="M24.4 12.8C18.6 15.6 15 21.4 15 29c0 4.5 1.2 8.8 3.5 12.8l13.5-13.5-7.6-15.5Z" fill="#4285f4"/>
      <path d="M32 59c9.8-9.2 17-18.8 17-30 0-5.3-1.5-9.9-4.2-13.4L32 28.3 45 49.4A69 69 0 0 0 32 59Z" fill="#fbbc04"/>
      <path d="M24.4 12.8 32 28.3l12.8-12.7C41.7 12 37.4 10 32 10c-2.7 0-5.2.5-7.6 1.4Z" fill="#ea4335"/>
      <circle cx="32" cy="29" r="7.9" fill="#ffffff"/>
    </svg>
  `,
  facebook: `
    <svg viewBox="0 0 64 64" role="presentation" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="#1877f2"/>
      <path
        d="M35.3 53V35.8h5.8l.9-6.8h-6.7V24c0-2 .6-3.4 3.4-3.4h3.6v-6c-.6-.1-2.7-.3-5.2-.3-5.2 0-8.7 3.1-8.7 8.9v5.1h-5.8v6.8h5.8V53h6.9Z"
        fill="#ffffff"
      />
    </svg>
  `,
  zalo: `
    <img src="./logo%20zalo.jpg" alt="" />
  `,
  hotline: `
    <img src="./icon-hotline.gif" alt="" />
  `,
  doctor: `
    <img src="./icon%20doctor.png" alt="" />
  `,
  youtube: `
    <svg viewBox="0 0 64 64" role="presentation" aria-hidden="true">
      <path
        d="M53.8 21.4a6.8 6.8 0 0 0-4.8-4.8C44.8 15.4 32 15.4 32 15.4s-12.8 0-17 .9a6.8 6.8 0 0 0-4.8 4.8c-.9 4.2-.9 10.6-.9 10.6s0 6.4.9 10.6a6.8 6.8 0 0 0 4.8 4.8c4.2.9 17 .9 17 .9s12.8 0 17-.9a6.8 6.8 0 0 0 4.8-4.8c.9-4.2.9-10.6.9-10.6s0-6.4-.9-10.6Z"
        fill="#ff0000"
      />
      <path d="m27 41.3 14.5-9.3L27 22.7v18.6Z" fill="#ffffff" />
    </svg>
  `,
  tiktok: `
    <svg viewBox="0 0 64 64" role="presentation" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="#0f172a"/>
      <path d="M37.7 17c1.4 3.3 3.8 5 7.1 5.3v4.8a12 12 0 0 1-7.1-2.2v11.4a10.2 10.2 0 1 1-8.1-10v5a5.1 5.1 0 1 0 3 4.7V17h5.1Z" fill="#ffffff"/>
      <path d="M37.7 17c.7 1.7 1.6 2.9 2.7 3.8v4.4a12 12 0 0 1-2.7-.4V17Z" fill="#25f4ee"/>
      <path d="M32.6 17v19a5.1 5.1 0 1 1-3-4.7v-4.5a10.2 10.2 0 1 0 8.1 10V24.9a12 12 0 0 0 7.1 2.2v-4.8c-3.3-.3-5.7-2-7.1-5.3h-5.1Z" fill="#ff3366" opacity=".68"/>
    </svg>
  `,
  whatsapp: `
    <svg viewBox="0 0 64 64" role="presentation" aria-hidden="true">
      <circle cx="32" cy="32" r="28" fill="#25d366"/>
      <path d="M32 17.5c-8 0-14.5 6.2-14.5 14 0 2.8.9 5.5 2.5 7.8l-1.8 7.2 7.5-1.9c2.1 1.4 4.6 2.2 7.2 2.2 8 0 14.5-6.2 14.5-14s-6.5-14-14.4-14Z" fill="#ffffff"/>
      <path d="M40.9 36.1c-.4-.2-2.1-1-2.4-1.1-.3-.1-.5-.2-.8.2s-.9 1.1-1.1 1.4-.4.3-.7.1c-2-.9-3.2-1.7-4.5-3.8-.3-.4 0-.6.2-.8.2-.2.4-.5.7-.7.2-.3.3-.4.4-.7.1-.3.1-.5 0-.7-.1-.2-.8-1.9-1.1-2.6-.3-.7-.6-.6-.8-.6h-.7c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.8s1.2 3.3 1.4 3.5c.2.2 2.3 3.5 5.5 4.9 3.2 1.4 3.2.9 3.8.9.6-.1 2.1-.8 2.4-1.5.3-.8.3-1.4.2-1.5 0-.1-.3-.2-.7-.4Z" fill="#25d366"/>
    </svg>
  `,
  tail: `
    <svg viewBox="0 0 24 24" role="presentation" aria-hidden="true">
      <circle cx="12" cy="5" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="12" cy="19" r="1.9" />
    </svg>
  `,
};

const accentStyles = {
  map: {
    surface: "rgba(100, 191, 137, 0.16)",
    color: "#347657",
  },
  facebook: {
    surface: "rgba(24, 119, 242, 0.12)",
    color: "#1877f2",
  },
  zalo: {
    surface: "rgba(0, 112, 255, 0.12)",
    color: "#0a67ff",
  },
  hotline: {
    surface: "rgba(37, 165, 95, 0.14)",
    color: "#25a55f",
  },
  doctor: {
    surface: "rgba(53, 126, 182, 0.14)",
    color: "#357eb6",
  },
  youtube: {
    surface: "rgba(255, 0, 0, 0.12)",
    color: "#ff0000",
  },
  tiktok: {
    surface: "rgba(16, 24, 40, 0.12)",
    color: "#111827",
  },
  whatsapp: {
    surface: "rgba(37, 211, 102, 0.14)",
    color: "#1f9f4f",
  },
};

const selectors = {
  heroLogoFlip: document.querySelector("#heroLogoFlip"),
  heroLogoFront: document.querySelector("#heroLogoFront"),
  heroLogoBack: document.querySelector("#heroLogoBack"),
  heroTitle: document.querySelector("#heroTitle"),
  heroSubtitle: document.querySelector("#heroSubtitle"),
  heroDepartment: document.querySelector("#heroDepartment"),
  heroDepartmentLine2: document.querySelector("#heroDepartmentLine2"),
  linksList: document.querySelector("#linksList"),
  bioModal: document.querySelector("#bioModal"),
  bioEyebrow: document.querySelector("#bioEyebrow"),
  bioImage: document.querySelector("#bioImage"),
  bioTitle: document.querySelector("#bioModalTitle"),
  bioContent: document.querySelector("#bioContent"),
  bioCloseButton: document.querySelector("#bioCloseButton"),
  bioScrollTopButton: document.querySelector("#bioScrollTopButton"),
  phoneLink: document.querySelector("#phoneLink"),
  zaloLink: document.querySelector("#zaloLink"),
  whatsappLink: document.querySelector("#whatsappLink"),
  shareButton: document.querySelector("#shareButton"),
  shareButtonLabel: document.querySelector("#shareButtonLabel"),
  saveContactButton: document.querySelector("#saveContactButton"),
  saveContactButtonLabel: document.querySelector("#saveContactButtonLabel"),
  emailButton: document.querySelector("#emailButton"),
  emailButtonLabel: document.querySelector("#emailButtonLabel"),
  phoneLinkLabel: document.querySelector("#phoneLinkLabel"),
  zaloLinkLabel: document.querySelector("#zaloLinkLabel"),
  whatsappLinkLabel: document.querySelector("#whatsappLinkLabel"),
  toast: document.querySelector("#toast"),
  noticeModal: document.querySelector("#noticeModal"),
  noticeTitle: document.querySelector("#noticeModalTitle"),
  noticeText: document.querySelector("#noticeModalText"),
  noticeHint: document.querySelector("#noticeModalHint"),
  noticeCloseButton: document.querySelector("#noticeCloseButton"),
  noticeCopyButton: document.querySelector("#noticeCopyButton"),
  noticeConfirmButton: document.querySelector("#noticeConfirmButton"),
};

let toastTimer;
let activeBioLocale = "vi";
let heroLogoFlipTimer;
let heroLogoFlipKickoffTimer;
let isHeroLogoFlipped = false;
const HERO_LOGO_HOLD_MS = 5000;

function showToast(message) {
  clearTimeout(toastTimer);
  selectors.toast.textContent = message;
  selectors.toast.classList.add("is-visible");

  toastTimer = window.setTimeout(() => {
    selectors.toast.classList.remove("is-visible");
  }, 2200);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMultilineText(value) {
  return escapeHtml(String(value || "").replace(/\r\n?/g, "\n")).replace(/\n/g, "<br />");
}

function formatTitleByWordRows(value, wordsPerLine = 5) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);

  if (!words.length) {
    return "";
  }

  if (!Number.isInteger(wordsPerLine) || wordsPerLine < 1 || words.length <= wordsPerLine) {
    return words.join(" ");
  }

  const firstLineWords = words.slice(0, wordsPerLine);
  const secondLineWords = words.slice(wordsPerLine);
  const lastWordOnFirstLine = String(firstLineWords[firstLineWords.length - 1] || "").toLowerCase();
  const isConnectorLastWord = lastWordOnFirstLine === "&" || lastWordOnFirstLine === "và" || lastWordOnFirstLine === "va";

  if (isConnectorLastWord && secondLineWords.length) {
    secondLineWords.unshift(firstLineWords.pop());
  }

  return `${firstLineWords.join(" ")}\n${secondLineWords.join(" ")}`;
}

function formatSubtitleRows(value) {
  const text = String(value || "").normalize("NFC").trim();

  if (!text) {
    return "";
  }

  const splitTokens = [
    "Đại học Quốc gia Hà Nội - Cơ sở Linh Đàm",
    "ĐHQGHN - Cơ sở Linh Đàm",
  ];

  for (const token of splitTokens) {
    const marker = ` - ${token}`;
    const markerIndex = text.indexOf(marker);

    if (markerIndex > 0) {
      const head = text.slice(0, markerIndex).trim();
      return `${head}\n${token}`;
    }

    const tokenIndex = text.indexOf(token);

    if (tokenIndex > 0) {
      const head = text.slice(0, tokenIndex).replace(/-\s*$/, "").trim();
      return `${head}\n${token}`;
    }
  }

  return text;
}

function formatCompactSocialLabel(value) {
  const text = String(value || "")
    .normalize("NFC")
    .replace(/\s+/g, " ")
    .trim();

  if (!text || text.includes("\n") || text.length <= 18) {
    return text;
  }

  const slashParts = text
    .split(/\s*\/\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (slashParts.length > 1) {
    let bestSplit = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let index = 1; index < slashParts.length; index += 1) {
      const line1 = slashParts.slice(0, index).join(" / ");
      const line2 = slashParts.slice(index).join(" / ");

      if (line1.length < 6 || line2.length < 4) {
        continue;
      }

      const score = Math.abs(line1.length - line2.length);

      if (score < bestScore) {
        bestScore = score;
        bestSplit = `${line1}\n${line2}`;
      }
    }

    if (bestSplit) {
      return bestSplit;
    }
  }

  const words = text.split(" ").filter(Boolean);

  if (words.length < 4) {
    return text;
  }

  let bestSplit = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let index = 1; index < words.length; index += 1) {
    const previousWord = String(words[index - 1] || "").toLowerCase();
    const nextWord = String(words[index] || "").toLowerCase();

    if (["/", "-", "|", "&", "và", "va"].includes(previousWord) || ["/", "-", "|"].includes(nextWord)) {
      continue;
    }

    const line1 = words.slice(0, index).join(" ");
    const line2 = words.slice(index).join(" ");

    if (line1.length < 6 || line2.length < 4) {
      continue;
    }

    const score = Math.abs(line1.length - line2.length);

    if (score < bestScore) {
      bestScore = score;
      bestSplit = `${line1}\n${line2}`;
    }
  }

  return bestSplit || text;
}

function isPlusPrefixedBioItem(value) {
  return /^\+\s*/.test(String(value || "").trim());
}

function isLevel3BioHeading(value) {
  return /^###(?!#)\s*/.test(String(value || "").trim());
}

function getLevel3BioHeadingText(value) {
  return String(value || "").trim().replace(/^###(?!#)\s*/, "");
}

function splitBioItemGroups(items) {
  const groups = [];
  let current = {
    subtitle: "",
    items: [],
  };

  function pushCurrentGroup() {
    if (!current.subtitle && !current.items.length) {
      return;
    }

    groups.push({
      subtitle: current.subtitle,
      items: current.items.slice(),
    });
  }

  (items || []).forEach((rawItem) => {
    const item = String(rawItem || "").trim();

    if (!item) {
      return;
    }

    if (isLevel3BioHeading(item)) {
      pushCurrentGroup();
      current = {
        subtitle: getLevel3BioHeadingText(item),
        items: [],
      };
      return;
    }

    current.items.push(item);
  });

  pushCurrentGroup();
  return groups;
}

function renderBioList(items) {
  const listItems = (items || [])
    .map((item) => {
      const itemClass = isPlusPrefixedBioItem(item)
        ? "bio-block__list-item bio-block__list-item--plus"
        : "bio-block__list-item";

      return `<li class="${itemClass}">${renderMultilineText(item)}</li>`;
    })
    .join("");

  if (!listItems) {
    return "";
  }

  return `
    <ul class="bio-block__list">
      ${listItems}
    </ul>
  `;
}

function renderBioItemsWithSubtitles(items) {
  const groups = splitBioItemGroups(items);

  if (!groups.length) {
    return "";
  }

  return groups
    .map((group) => {
      const subtitleText = String(group.subtitle || "").trim();
      const groupClassName = subtitleText
        ? "bio-block__subgroup bio-block__subgroup--with-subtitle"
        : "bio-block__subgroup";
      const subtitleHtml = subtitleText
        ? `<h4 class="bio-block__subtitle">${escapeHtml(subtitleText)}</h4>`
        : "";
      const listHtml = renderBioList(group.items);

      return `
        <div class="${groupClassName}">
          ${subtitleHtml}
          ${listHtml}
        </div>
      `;
    })
    .join("");
}

function externalAttrs(href) {
  return href.startsWith("http")
    ? ' target="_blank" rel="noreferrer"'
    : "";
}

function assignHref(element, href) {
  element.href = href;

  if (href.startsWith("http")) {
    element.target = "_blank";
    element.rel = "noreferrer";
    return;
  }

  element.removeAttribute("target");
  element.removeAttribute("rel");
}

function toContactFilename(value) {
  return String(value || "contact")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "contact";
}

function buildContactCardUrl() {
  const params = new URLSearchParams({
    phone: landingConfig.phone,
    filename: toContactFilename(landingConfig.brandShort || landingConfig.title || "contact"),
  });

  if (landingConfig.email) {
    params.set("email", landingConfig.email);
  }

  return `/api/contact.vcf?${params.toString()}`;
}

function buildEmailUrl() {
  if (!landingConfig.email) {
    return "";
  }

  const params = new URLSearchParams({
    subject: landingConfig.title || "Liên hệ",
  });

  return `mailto:${landingConfig.email}?${params.toString()}`;
}

function isIosDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isZaloIosWebView() {
  return isIosDevice() && /\bZalo\b/i.test(navigator.userAgent);
}

async function copyCompanyPhone() {
  if (!navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(landingConfig.phone);
    return true;
  } catch (error) {
    return false;
  }
}

function openNoticeModal({ title, text, hint = "" }) {
  selectors.noticeTitle.textContent = title;
  selectors.noticeText.textContent = text;
  selectors.noticeHint.textContent = hint;
  selectors.noticeHint.hidden = !hint;
  selectors.noticeModal.classList.add("is-open");
  selectors.noticeModal.setAttribute("aria-hidden", "false");
}

function closeNoticeModal() {
  selectors.noticeModal.classList.remove("is-open");
  selectors.noticeModal.setAttribute("aria-hidden", "true");
}

async function openSaveContactHelpModal() {
  const copied = await copyCompanyPhone();
  const hint = copied
    ? `Số công ty đã được copy sẵn: ${landingConfig.phone}`
    : `Số công ty: ${landingConfig.phone}`;

  openNoticeModal({
    title: "Mở bằng Safari để lưu vào Danh bạ",
    text: 'Zalo trên iPhone không mở file danh bạ .vcf ổn định. Hãy bấm menu chia sẻ hoặc dấu ba chấm trong Zalo, chọn "Mở bằng Safari", rồi bấm lại nút "Lưu danh bạ".',
    hint,
  });
}

function getBioLocaleContent(locale = activeBioLocale) {
  return landingConfig.biography.locales[locale] || landingConfig.biography.locales.vi;
}

function getBioLocaleLabels(locale = activeBioLocale) {
  return landingConfig.biography.labels[locale] || landingConfig.biography.labels.vi;
}

function resolveHeroBrandingFaces(locale = activeBioLocale) {
  const fallbackLogo = landingConfig.branding.defaultLogo || {};
  const viLogo = landingConfig.branding.locales?.vi || {};
  const enLogo = landingConfig.branding.locales?.en || {};
  const activeLogo = landingConfig.branding.locales?.[locale] || {};

  return {
    front: {
      src: viLogo.src || fallbackLogo.src || enLogo.src || "",
      alt: viLogo.alt || fallbackLogo.alt || landingConfig.title || "Logo",
    },
    back: {
      src: enLogo.src || fallbackLogo.src || viLogo.src || "",
      alt: enLogo.alt || fallbackLogo.alt || landingConfig.title || "Logo",
    },
    activeAlt: activeLogo.alt || fallbackLogo.alt || landingConfig.title || "Logo",
  };
}

function stopHeroLogoFlip() {
  if (heroLogoFlipTimer) {
    window.clearInterval(heroLogoFlipTimer);
    heroLogoFlipTimer = null;
  }

  if (heroLogoFlipKickoffTimer) {
    window.clearTimeout(heroLogoFlipKickoffTimer);
    heroLogoFlipKickoffTimer = null;
  }

  isHeroLogoFlipped = false;

  if (selectors.heroLogoFlip) {
    selectors.heroLogoFlip.classList.remove("is-flipped");
  }
}

function shouldFlipHeroLogo() {
  if (!selectors.heroLogoFront || !selectors.heroLogoBack) {
    return false;
  }

  const frontSrc = String(selectors.heroLogoFront.getAttribute("src") || "").trim();
  const backSrc = String(selectors.heroLogoBack.getAttribute("src") || "").trim();

  if (!frontSrc || !backSrc) {
    return false;
  }

  return frontSrc !== backSrc;
}

function startHeroLogoFlip() {
  stopHeroLogoFlip();

  if (!selectors.heroLogoFlip || !shouldFlipHeroLogo()) {
    return;
  }

  const toggleFlipState = () => {
    isHeroLogoFlipped = !isHeroLogoFlipped;
    selectors.heroLogoFlip.classList.toggle("is-flipped", isHeroLogoFlipped);
  };

  heroLogoFlipKickoffTimer = window.setTimeout(toggleFlipState, HERO_LOGO_HOLD_MS);
  heroLogoFlipTimer = window.setInterval(toggleFlipState, HERO_LOGO_HOLD_MS);
}

function applyLocalizedBranding(locale = activeBioLocale) {
  const heroBranding = resolveHeroBrandingFaces(locale);

  if (selectors.heroLogoFront) {
    selectors.heroLogoFront.src = heroBranding.front.src;
  }

  if (selectors.heroLogoBack) {
    selectors.heroLogoBack.src = heroBranding.back.src;
  }

  if (selectors.heroLogoFlip) {
    selectors.heroLogoFlip.setAttribute("aria-label", heroBranding.activeAlt);
  }

  startHeroLogoFlip();
}

function setBioLocale(locale) {
  activeBioLocale = landingConfig.biography.locales[locale] ? locale : "vi";
  applyLocalizedBranding(activeBioLocale);
  renderBiography();
}

function getBioLocaleOverride() {
  const locale = new URLSearchParams(window.location.search).get("bioLocale");

  if (!locale) {
    return null;
  }

  return landingConfig.biography.locales[locale] ? locale : null;
}

function resolveBioLocaleByCountry(countryCode) {
  return countryCode && countryCode.toUpperCase() !== "VN" ? "en" : "vi";
}

async function detectBioLocale() {
  const overrideLocale = getBioLocaleOverride();

  if (overrideLocale) {
    setBioLocale(overrideLocale);
    return;
  }

  try {
    const response = await fetch("/api/geo", {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Unable to resolve visitor country");
    }

    const { country } = await response.json();
    setBioLocale(resolveBioLocaleByCountry(country));
  } catch (error) {
    setBioLocale("vi");
  }
}

const socialAccents = new Set(["facebook", "youtube", "tiktok", "zalo"]);

function isSocialLink(link) {
  return socialAccents.has(String(link?.accent || "").toLowerCase());
}

function renderLinkCard(link, options = {}) {
  const accent = accentStyles[link.accent] || accentStyles.map;
  const actionAttr = link.action ? ` data-action="${link.action}"` : "";
  const rawTitle = String(link.title || "").normalize("NFC").trim();
  const title = escapeHtml(rawTitle);
  const compactTitle = escapeHtml(formatCompactSocialLabel(rawTitle));
  const cardClassName = options.compactSocial ? "link-card link-card-social" : "link-card";

  if (options.compactSocial) {
    if (options.showCompactLabel) {
      return `
        <a class="${cardClassName} link-card-social--with-label" href="${escapeHtml(link.href)}"${externalAttrs(link.href)} aria-label="${title}"${actionAttr}>
          <span
            class="link-card-icon"
            style="--icon-surface:${accent.surface}; --icon-color:${accent.color};"
            aria-hidden="true"
          >
            ${iconMarkup[link.icon]}
          </span>
          <strong class="link-card-social-label">${compactTitle}</strong>
        </a>
      `;
    }

    return `
      <a class="${cardClassName} link-card-social--icon-only" href="${escapeHtml(link.href)}"${externalAttrs(link.href)} aria-label="${title}"${actionAttr}>
        <span
          class="link-card-icon"
          style="--icon-surface:${accent.surface}; --icon-color:${accent.color};"
          aria-hidden="true"
        >
          ${iconMarkup[link.icon]}
        </span>
        <span class="visually-hidden">${title}</span>
      </a>
    `;
  }

  const titleHtml = `<strong class="link-card-title">${title}</strong>`;

  return `
    <a class="${cardClassName}" href="${escapeHtml(link.href)}"${externalAttrs(link.href)} aria-label="${escapeHtml(link.title)}"${actionAttr}>
      <span
        class="link-card-icon"
        style="--icon-surface:${accent.surface}; --icon-color:${accent.color};"
        aria-hidden="true"
      >
        ${iconMarkup[link.icon]}
      </span>
      <span class="link-card-copy">
        ${titleHtml}
      </span>
      <span class="link-card-tail" aria-hidden="true">${iconMarkup.tail}</span>
    </a>
  `;
}

function renderSocialGroup(links) {
  if (!links.length) {
    return "";
  }

  const chunks = [];

  for (let index = 0; index < links.length; index += 3) {
    chunks.push(links.slice(index, index + 3));
  }

  return chunks
    .map((chunk) => {
      if (chunk.length === 1) {
        return `
          <div class="social-links-grid social-links-grid--1">
            ${renderLinkCard(chunk[0])}
          </div>
        `;
      }

      return `
        <div class="social-links-grid social-links-grid--${chunk.length}">
          ${chunk.map((link) => renderLinkCard(link, {
            compactSocial: true,
            showCompactLabel: true,
          })).join("")}
        </div>
      `;
    })
    .join("");
}

function renderLinks() {
  const allLinks = landingConfig.links.filter((link) => link?.href);
  const chunks = [];
  let socialLinks = [];

  function flushSocialLinks() {
    if (!socialLinks.length) {
      return;
    }

    chunks.push(renderSocialGroup(socialLinks));
    socialLinks = [];
  }

  allLinks.forEach((link) => {
    if (isSocialLink(link)) {
      socialLinks.push(link);
      return;
    }

    flushSocialLinks();
    chunks.push(renderLinkCard(link));
  });

  flushSocialLinks();
  selectors.linksList.innerHTML = chunks.join("");
}

function renderBiography() {
  const biography = getBioLocaleContent();
  const labels = getBioLocaleLabels();

  selectors.bioModal.dataset.locale = activeBioLocale;
  selectors.bioEyebrow.textContent = labels.eyebrow;
  selectors.bioCloseButton.setAttribute("aria-label", labels.close);
  selectors.bioScrollTopButton.setAttribute("aria-label", labels.scrollTop);
  selectors.bioImage.src = landingConfig.biography.imageSrc;
  selectors.bioImage.alt = biography.imageAlt;
  selectors.bioTitle.textContent = composeDisplayTwoLines(biography.name, biography.nameLine2);
  selectors.bioContent.innerHTML = (biography.sections || [])
    .map((section) => {
      let content = `<p class="bio-block__text">${renderMultilineText(section.text || "")}</p>`;

      if (Array.isArray(section.items) && section.items.length) {
        content = renderBioItemsWithSubtitles(section.items);
      }

      return `
        <section class="bio-block">
          <h3 class="bio-block__title">${escapeHtml(section.title)}</h3>
          ${content}
        </section>
      `;
    })
    .join("");
}

function applyDocumentMetadata() {
  if (landingConfig.title) {
    document.title = landingConfig.title;
  }

  const descriptionTag = document.querySelector('meta[name="description"]');

  if (descriptionTag) {
    descriptionTag.setAttribute(
      "content",
      `${landingConfig.title} - ${landingConfig.subtitle}`.trim(),
    );
  }

  const themeColorTag = document.querySelector('meta[name="theme-color"]');

  if (themeColorTag) {
    themeColorTag.setAttribute("content", landingConfig.theme.backgroundColor);
  }
}

function applyThemeVariables() {
  document.documentElement.style.setProperty("--background", landingConfig.theme.backgroundColor);
}

function bindStaticContent() {
  const buttonLabels = mergeDeep(getDefaultButtonLabels(), landingConfig.buttons || {});
  const departmentLine1 = String(landingConfig.departmentInfo || "").normalize("NFC").trim();
  const departmentLine2 = String(landingConfig.departmentInfoLine2 || "").normalize("NFC").trim();
  const subtitle = formatSubtitleRows(landingConfig.subtitle || "");
  const titleLine1 = String(landingConfig.title || "").normalize("NFC").trim();
  const titleLine2 = String(landingConfig.titleLine2 || "").normalize("NFC").trim();
  const heroTitle = titleLine2
    ? composeDisplayTwoLines(titleLine1, titleLine2)
    : formatTitleByWordRows(titleLine1, 5);

  selectors.heroTitle.textContent = heroTitle;
  selectors.heroTitle.hidden = !heroTitle;
  selectors.heroDepartment.textContent = departmentLine1;
  selectors.heroDepartment.hidden = !departmentLine1;
  if (selectors.heroDepartmentLine2) {
    selectors.heroDepartmentLine2.textContent = departmentLine2;
    selectors.heroDepartmentLine2.hidden = !departmentLine2;
  }
  selectors.heroSubtitle.textContent = subtitle;
  selectors.heroSubtitle.hidden = !subtitle;
  applyThemeVariables();
  applyLocalizedBranding(activeBioLocale);
  applyDocumentMetadata();

  assignHref(selectors.phoneLink, `tel:${landingConfig.phone}`);
  assignHref(selectors.zaloLink, landingConfig.social.zalo);
  if (selectors.whatsappLink) {
    const whatsappProfile = landingConfig.socialProfiles?.whatsapp || {};
    const whatsappHref = normalizeWhatsAppUrl(whatsappProfile.url, landingConfig.phone);
    const showWhatsapp = Boolean(whatsappProfile.enabled && whatsappHref);

    selectors.whatsappLink.hidden = !showWhatsapp;

    if (showWhatsapp) {
      assignHref(selectors.whatsappLink, whatsappHref);
    }
  }

  if (selectors.shareButtonLabel) {
    selectors.shareButtonLabel.textContent = buttonLabels.support.share;
  }

  if (selectors.saveContactButtonLabel) {
    selectors.saveContactButtonLabel.textContent = buttonLabels.support.saveContact;
  }

  if (selectors.emailButtonLabel) {
    selectors.emailButtonLabel.textContent = buttonLabels.support.email;
  }

  if (selectors.phoneLinkLabel) {
    selectors.phoneLinkLabel.textContent = buttonLabels.dock.phone;
  }

  if (selectors.zaloLinkLabel) {
    selectors.zaloLinkLabel.textContent = buttonLabels.dock.zalo;
  }

  if (selectors.whatsappLinkLabel) {
    selectors.whatsappLinkLabel.textContent = buttonLabels.dock.whatsapp;
  }

  if (selectors.emailButton) {
    selectors.emailButton.hidden = !landingConfig.email;
    selectors.emailButton.disabled = !landingConfig.email;
  }
}

function openBioModal() {
  selectors.bioModal.classList.add("is-open");
  selectors.bioModal.setAttribute("aria-hidden", "false");
}

function closeBioModal() {
  selectors.bioModal.classList.remove("is-open");
  selectors.bioModal.setAttribute("aria-hidden", "true");
}

function scrollBioToTop() {
  const bioSheet = selectors.bioModal.querySelector(".bio-modal__sheet");
  bioSheet.scrollTo({ top: 0, behavior: "smooth" });
}

async function handleShare() {
  const shareData = {
    title: landingConfig.title,
    text: `${landingConfig.title} - ${landingConfig.subtitle}`,
    url: window.location.href,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      showToast("Đã mở chia sẻ hệ thống");
      return;
    }

    await navigator.clipboard.writeText(shareData.url);
    showToast("Đã copy liên kết landing page");
  } catch (error) {
    showToast("Không thể chia sẻ lúc này");
  }
}

async function handleSaveContact() {
  try {
    if (isZaloIosWebView()) {
      await openSaveContactHelpModal();
      return;
    }

    window.location.assign(buildContactCardUrl());
  } catch (error) {
    showToast("Không thể tạo danh bạ lúc này");
  }
}

function handleEmail() {
  const emailUrl = buildEmailUrl();

  if (!emailUrl) {
    showToast("Chưa có email để liên hệ");
    return;
  }

  window.location.href = emailUrl;
}

function bindInteractions() {
  selectors.shareButton.addEventListener("click", handleShare);
  selectors.saveContactButton.addEventListener("click", handleSaveContact);
  if (selectors.emailButton) {
    selectors.emailButton.addEventListener("click", handleEmail);
  }
  selectors.noticeCloseButton.addEventListener("click", closeNoticeModal);
  selectors.noticeConfirmButton.addEventListener("click", closeNoticeModal);
  selectors.noticeCopyButton.addEventListener("click", async () => {
    const copied = await copyCompanyPhone();
    showToast(copied ? "Đã copy số công ty" : "Không thể copy số lúc này");
  });
  selectors.noticeModal.addEventListener("click", (event) => {
    if (event.target.matches("[data-notice-close]")) {
      closeNoticeModal();
    }
  });
  selectors.linksList.addEventListener("click", (event) => {
    const bioTrigger = event.target.closest('[data-action="open-bio"]');

    if (!bioTrigger) {
      return;
    }

    event.preventDefault();
    openBioModal();
  });
  selectors.bioCloseButton.addEventListener("click", closeBioModal);
  selectors.bioScrollTopButton.addEventListener("click", scrollBioToTop);
  selectors.bioModal.addEventListener("click", (event) => {
    if (event.target.matches("[data-bio-close]")) {
      closeBioModal();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && selectors.bioModal.classList.contains("is-open")) {
      closeBioModal();
      return;
    }

    if (event.key === "Escape" && selectors.noticeModal.classList.contains("is-open")) {
      closeNoticeModal();
    }
  });
}

bindStaticContent();
renderLinks();
renderBiography();
bindInteractions();
detectBioLocale();

if (window.location.hash === "#bio-modal") {
  openBioModal();
}

