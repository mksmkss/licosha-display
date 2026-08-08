export const ICON_URLS = {
  instagram: `${import.meta.env.BASE_URL}assets/icons/instagram.svg`,
  x: `${import.meta.env.BASE_URL}assets/icons/x.svg`,
  cameraOff: `${import.meta.env.BASE_URL}assets/icons/camera-off.svg`,
} as const;

const svgTextCache = new Map<string, Promise<string>>();

function fetchSvgText(url: string): Promise<string> {
  let cached = svgTextCache.get(url);
  if (!cached) {
    cached = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`Failed to load icon: ${url}`);
      return res.text();
    });
    svgTextCache.set(url, cached);
  }
  return cached;
}

export function loadIconSvg(name: keyof typeof ICON_URLS): Promise<string> {
  return fetchSvgText(ICON_URLS[name]);
}
