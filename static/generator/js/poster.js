// Fills the SVG templates in ../templates/ with the form values, shows them as previews and renders them to PNG.
// The layout itself lives in the templates; see the comment in horizontal.svg for the data-* attributes.

const BASE = new URL("../", document.currentScript.src);
const FONT_URL = new URL("fonts/SometypeMono-Regular.ttf", BASE).href;
const SVG_NS = "http://www.w3.org/2000/svg";

const HORIZONTAL = "horizontal";
const VERTICAL = "vertical";
const COMMON = { name: "common", template: HORIZONTAL, width: 1920, height: 1080 };
const PORTRAIT = { name: "vertical", template: VERTICAL, width: 1080, height: 1920 };

const POSTERS = {
  meetup: {
    photo: new URL("images/art.png", BASE).href,
    formats: [
      COMMON,
      PORTRAIT,
      { name: "facebook", template: HORIZONTAL, width: 2062, height: 1080 }, // 1.91:1 event cover
      { name: "discord", template: HORIZONTAL, width: 2700, height: 1080 }, // 2.5:1 event cover
    ],
    filename: (v) => `gvt-meetup-${v.rawDate}`,
  },
  speaker: {
    photo: new URL("images/seal.png", BASE).href,
    formats: [COMMON, PORTRAIT],
    filename: (v) => `gvt-speaker-${v.rawDate}_${v.name.replace(/[^\p{L}\p{N}_.-]+/gu, "_")}`,
  },
};

const form = document.getElementById("poster-form");
const previews = document.getElementById("poster-previews");
const templates = {};
const photos = {};
let posterType = location.hash === "#speaker" ? "speaker" : "meetup";

async function loadTemplate(name) {
  const url = new URL(`templates/${name}.svg`, BASE);
  const text = await (await fetch(url)).text();
  const svg = new DOMParser().parseFromString(text, "image/svg+xml").documentElement;
  for (const image of svg.querySelectorAll("image[href]")) {
    image.setAttribute("href", new URL(image.getAttribute("href"), url).href);
  }
  return svg;
}

function readValues() {
  const data = new FormData(form);
  const rawDate = data.get("date") || "";
  const [, month, day] = rawDate.split("-");
  return {
    rawDate,
    date: day ? `${day}.${month}` : "",
    time: data.get("time") || "",
    address: data.get("address") || "",
    author: data.get("author") || "",
    name: data.get("name") || "",
    role: data.get("role") || "",
  };
}

// Template layout rules. The SVG must be in the document, because they measure text.
function layout(svg, format, values) {
  const designWidth = svg.viewBox.baseVal.width;
  svg.setAttribute("viewBox", `0 0 ${format.width} ${format.height}`);
  svg.setAttribute("width", format.width);
  svg.setAttribute("height", format.height);

  for (const el of svg.querySelectorAll("[data-show]")) {
    if (el.dataset.show !== posterType) el.remove();
  }
  for (const el of svg.querySelectorAll("[data-field]")) {
    if (el.dataset.field === "photo") el.setAttribute("href", photos[posterType] ?? POSTERS[posterType].photo);
    else el.textContent = values[el.dataset.field];
  }
  for (const el of svg.querySelectorAll("[data-fit]")) {
    const width = el.getComputedTextLength();
    if (width > el.dataset.fit) {
      el.setAttribute("font-size", (parseFloat(getComputedStyle(el).fontSize) * el.dataset.fit) / width);
    }
  }
  for (const row of svg.querySelectorAll("[data-row]")) {
    const gap = Number(row.dataset.row);
    const items = [...row.children];
    const widths = items.map((el) => (el.tagName === "text" ? el.getComputedTextLength() : el.width.baseVal.value));
    const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
    let x = Number(row.dataset.x) - total * ({ middle: 0.5, end: 1 }[row.dataset.align] ?? 0);
    items.forEach((el, i) => {
      el.setAttribute("x", Math.round(x)); // whole pixels keep the separator lines sharp
      x += widths[i] + gap;
    });
  }
  for (const el of svg.querySelectorAll("[data-anchor=right]")) {
    el.setAttribute("transform", `translate(${format.width - designWidth} 0)`);
  }
  for (const el of svg.querySelectorAll("[data-until]")) {
    const target = svg.querySelector(el.dataset.until);
    const toLocal = el.getCTM().inverse().multiply(target.getCTM());
    const box = target.getBBox();
    const targetLeft = box.width || !target.x ? box.x : target.x.baseVal[0].value; // empty text has no box
    const left = new DOMPoint(targetLeft, 0).matrixTransform(toLocal).x;
    el.setAttribute("width", Math.max(0, left - Number(el.dataset.gap) - el.x.baseVal.value));
  }
}

function render() {
  const values = readValues();
  for (const el of form.querySelectorAll("[data-show]")) el.hidden = el.dataset.show !== posterType;
  for (const tab of form.querySelectorAll("[data-tab]")) tab.setAttribute("aria-selected", tab.dataset.tab === posterType);
  cropButton.hidden = !originals[posterType];

  previews.replaceChildren();
  for (const format of POSTERS[posterType].formats) {
    const svg = templates[format.template].cloneNode(true);
    const figure = document.createElement("figure");
    figure.className = `poster-preview ${format.template}`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `${format.name} · ${format.width}×${format.height}`;
    button.title = "Download PNG";
    button.addEventListener("click", () => download(svg, format, values));
    figure.append(svg, button);
    previews.append(figure);
    layout(svg, format, values);
  }
}

const dataUrls = new Map();
function toDataUrl(url) {
  if (url.startsWith("data:")) return url;
  if (!dataUrls.has(url)) {
    dataUrls.set(
      url,
      fetch(url)
        .then((response) => response.blob())
        .then(
          (blob) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            }),
        ),
    );
  }
  return dataUrls.get(url);
}

// An SVG drawn as an image cannot load anything, so the font and images go inline as data URLs.
async function renderPng(svg, format) {
  const copy = svg.cloneNode(true);
  for (const image of copy.querySelectorAll("image")) {
    image.setAttribute("href", await toDataUrl(image.getAttribute("href")));
  }
  const style = document.createElementNS(SVG_NS, "style");
  style.textContent = `@font-face { font-family: "Sometype Mono"; src: url(${await toDataUrl(FONT_URL)}); }`;
  copy.prepend(style);

  const blob = new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = format.width;
    canvas.height = format.height;
    canvas.getContext("2d").drawImage(image, 0, 0, format.width, format.height);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function download(svg, format, values) {
  const png = await renderPng(svg, format);
  const link = document.createElement("a");
  link.href = URL.createObjectURL(png);
  link.download = `${POSTERS[posterType].filename(values)}-${format.name}.png`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

async function downloadAll() {
  const values = readValues();
  const svgs = previews.querySelectorAll("svg");
  for (const [i, format] of POSTERS[posterType].formats.entries()) await download(svgs[i], format, values);
}

// The picked file opens in a 1:1 crop dialog. The crop result goes on the posters, at most MAX_PHOTO_SIDE px wide, so that
// the previews do not decode a big photo again and again.
const MAX_PHOTO_SIDE = 2048; // the largest photo slot is 1028 px
const cropDialog = document.getElementById("crop-dialog");
const cropImage = document.getElementById("crop-image");
const cropButton = document.getElementById("crop-button");
const originals = {}; // object URL of the picked file, per poster type
const crops = {}; // last crop box, per poster type
let cropper;

function openCrop(url) {
  cropImage.src = url;
  cropDialog.showModal();
  cropper = new Cropper(cropImage, {
    aspectRatio: 1,
    viewMode: 1,
    autoCropArea: 1,
    background: false,
    data: url === originals[posterType] ? crops[posterType] : undefined,
  });
}

async function closeCrop() {
  const url = cropImage.src;
  const apply = cropDialog.returnValue === "apply" && cropper.ready; // not ready: the image is still loading
  const data = cropper.getData();
  // An exact size: Cropper's maxWidth/maxHeight also scale by the source aspect ratio.
  const side = Math.min(MAX_PHOTO_SIDE, Math.round(data.width));
  const canvas = apply ? cropper.getCroppedCanvas({ width: side, height: side, imageSmoothingQuality: "high" }) : null;
  cropper.destroy();
  cropDialog.returnValue = "";
  if (!apply) {
    if (url !== originals[posterType]) URL.revokeObjectURL(url);
    return;
  }
  if (originals[posterType] && originals[posterType] !== url) URL.revokeObjectURL(originals[posterType]);
  originals[posterType] = url;
  crops[posterType] = data;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (photos[posterType]) {
    URL.revokeObjectURL(photos[posterType]);
    dataUrls.delete(photos[posterType]);
  }
  photos[posterType] = URL.createObjectURL(blob);
  render();
}

// Meetups are on Fridays. Weeks start on Monday.
function nextWeekFriday() {
  const date = new Date();
  const weekday = (date.getDay() + 6) % 7; // Monday = 0
  date.setDate(date.getDate() + 7 - weekday + 4);
  return date.toLocaleDateString("sv"); // sv locale formats as YYYY-MM-DD
}

async function init() {
  form.elements.date.value ||= nextWeekFriday();
  const font = new FontFace("Sometype Mono", `url(${FONT_URL})`);
  document.fonts.add(await font.load());
  [templates[HORIZONTAL], templates[VERTICAL]] = await Promise.all([loadTemplate(HORIZONTAL), loadTemplate(VERTICAL)]);

  form.addEventListener("input", (event) => {
    if (event.target.name === "photo") {
      if (event.target.files[0]) openCrop(URL.createObjectURL(event.target.files[0]));
    } else {
      render();
    }
  });
  form.addEventListener("submit", (event) => event.preventDefault());
  for (const tab of form.querySelectorAll("[data-tab]")) {
    tab.addEventListener("click", () => {
      posterType = tab.dataset.tab;
      history.replaceState(null, "", `#${posterType}`);
      form.elements.photo.value = "";
      render();
    });
  }
  document.getElementById("download-all").addEventListener("click", downloadAll);
  cropButton.addEventListener("click", () => openCrop(originals[posterType]));
  cropDialog.addEventListener("close", closeCrop);
  render();
}

init();
