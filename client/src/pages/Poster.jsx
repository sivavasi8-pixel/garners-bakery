import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { AdminPage } from "../components/admin/AdminUI";

// Same labels Order.jsx shows customers, so the poster's category headings
// match what people see when they actually open the app to order.
const CATEGORY_LABELS = {
  breads: "Bread",
  buns: "Buns",
  pastries: "Pastries",
  cookies: "Cookies",
  cakes: "Cakes"
};
const CATEGORY_ORDER = ["breads", "buns", "pastries", "cookies", "cakes"];

const POSTER_W = 1080;
const PHONE = "7812813248";
const ADDRESS = "Whitefield, Kannamangala";

const GREEN = "#1f3d2e";
const GOLD = "#b8925a";
const CHARCOAL = "#26241f";
const CREAM = "#faf6ec";
const BORDER = "#ddceaa";
const LEADER = "#c9bfa0";

// Simple single-color vector glyphs — emoji render in the OS's color font and
// clash with the brand's monochrome green, so these draw the phone/pin shapes
// directly instead.
const drawPhoneIcon = (ctx, cx, cy, s, color) => {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  // A simple mobile-phone silhouette — body + a small home button — reads
  // clearly as "phone" even at icon size, unlike an abstract rotated bar.
  roundRectPath(ctx, -s * 0.32, -s * 0.5, s * 0.64, s, s * 0.14);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.beginPath();
  ctx.arc(0, s * 0.32, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawPinIcon = (ctx, cx, cy, s, color) => {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.15, s * 0.4, Math.PI * 0.15, Math.PI * 0.85, true);
  ctx.lineTo(cx, cy + s * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.beginPath();
  ctx.arc(cx, cy - s * 0.15, s * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const roundRectPath = (ctx, x, y, w, h, r) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// Loads a same-origin menu photo for the canvas; resolves null (never rejects)
// so one missing/broken photo can't block the whole poster from rendering.
const loadImage = (url) =>
  new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });

// Draws `img` cropped to cover a w x h rounded-corner box — the canvas
// equivalent of CSS's object-fit: cover, so a portrait or landscape photo
// always fills its slot without stretching.
const drawImageCover = (ctx, img, x, y, w, h, r) => {
  const srcRatio = img.width / img.height;
  const dstRatio = w / h;
  let sx, sy, sw, sh;
  if (srcRatio > dstRatio) {
    sh = img.height;
    sw = sh * dstRatio;
    sx = (img.width - sw) / 2;
    sy = 0;
  } else {
    sw = img.width;
    sh = sw / dstRatio;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
};

const ROW_H = 34;
const BOX_PAD_X = 20;
const BOX_PAD_TOP = 40; // room for the pill badge overlapping the top border
const BOX_PAD_BOTTOM = 18;
const IMG_W_RATIO = 0.36;
const IMG_GAP = 14;

// Height a category box will need, before it's actually drawn — used both to
// balance items across the two columns and to size the canvas up front.
const boxHeight = (group) => BOX_PAD_TOP + group.items.length * ROW_H + BOX_PAD_BOTTOM;

function drawCategoryBox(ctx, x, y, w, group, img) {
  const h = boxHeight(group);
  const hasImg = !!img;
  const imgW = hasImg ? Math.round(w * IMG_W_RATIO) : 0;
  const textW = hasImg ? w - imgW - IMG_GAP - BOX_PAD_X * 2 : w - BOX_PAD_X * 2;

  // Box border — a plain rounded rectangle rather than a filled card, so
  // several sitting side by side still read as one warm sheet of paper.
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, x, y, w, h, 14);
  ctx.stroke();

  if (hasImg) {
    drawImageCover(ctx, img, x + w - BOX_PAD_X - imgW, y + BOX_PAD_TOP - 6, imgW, h - BOX_PAD_TOP - BOX_PAD_BOTTOM + 6, 10);
  }

  // Category pill — sits astride the box's top border, tilted a few degrees
  // like a hand-torn label, the one deliberately un-tidy touch in the layout.
  ctx.font = "700 22px Inter, sans-serif";
  const label = group.label.toUpperCase();
  const labelW = ctx.measureText(label).width;
  const pillW = labelW + 34;
  const pillH = 38;
  const pillCx = x + 18 + pillW / 2;
  const pillCy = y;
  ctx.save();
  ctx.translate(pillCx, pillCy);
  ctx.rotate(-0.025);
  ctx.fillStyle = GREEN;
  roundRectPath(ctx, -pillW / 2, -pillH / 2, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 1, 1);
  ctx.restore();
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Item rows — name, a dotted leader, then the price, confined to textW so
  // a photo on the right never gets text drawn over it. The name's max width
  // is capped to what's left after the price, so a long item name is scaled
  // down (fillText's built-in behavior) rather than overlapping the price.
  let rowY = y + BOX_PAD_TOP + 22;
  for (const item of group.items) {
    const priceText = item.price ? `Rs ${item.price}` : "TBD";
    ctx.font = "700 22px Inter, sans-serif";
    const priceW = ctx.measureText(priceText).width;
    ctx.fillStyle = CHARCOAL;
    ctx.fillText(priceText, x + BOX_PAD_X + textW - priceW, rowY);

    const nameMaxW = textW - priceW - 20;
    ctx.font = "500 22px Inter, sans-serif";
    const nameActualW = Math.min(ctx.measureText(item.name).width, nameMaxW);
    ctx.fillText(item.name, x + BOX_PAD_X, rowY, nameMaxW);

    ctx.strokeStyle = LEADER;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.moveTo(x + BOX_PAD_X + nameActualW + 10, rowY - 7);
    ctx.lineTo(x + BOX_PAD_X + textW - priceW - 10, rowY - 7);
    ctx.stroke();
    ctx.setLineDash([]);

    rowY += ROW_H;
  }

  return h;
}

// Renders the poster onto a canvas at a fixed 1080px width, growing its height
// to fit however many in-stock items there are today — this is what used to be
// designed by hand in an external tool every morning.
function drawPoster(canvas, { groups, images, dateLabel }) {
  const padX = 64;
  const colGap = 28;
  const colW = (POSTER_W - padX * 2 - colGap) / 2;
  const boxGap = 22;
  const headerH = 280;
  const footerH = 110;

  // Greedily balance categories across two columns by their (known-in-advance)
  // box height, so neither column ends up dramatically taller than the other.
  const left = [];
  const right = [];
  let leftH = 0;
  let rightH = 0;
  for (const g of groups) {
    const h = boxHeight(g);
    if (leftH <= rightH) {
      left.push(g);
      leftH += h + boxGap;
    } else {
      right.push(g);
      rightH += h + boxGap;
    }
  }
  const bodyH = Math.max(leftH, rightH, 0);
  const height = headerH + bodyH + footerH;

  canvas.width = POSTER_W;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, POSTER_W, height);

  // Header — centered brand mark + a tilted "highlight" pill standing in for
  // the hand-painted brush stroke behind "Today's Bakes" on the real posters.
  ctx.textAlign = "center";
  ctx.fillStyle = GREEN;
  ctx.font = "700 58px Fraunces, Georgia, serif";
  ctx.fillText("GARNERS CAKES", POSTER_W / 2, 78);

  ctx.font = "600 15px Inter, sans-serif";
  ctx.fillStyle = GOLD;
  const tagline = "B A K E D   I N   P U R E   B U T T E R";
  const tagW = ctx.measureText(tagline).width;
  ctx.fillText(tagline, POSTER_W / 2, 110);
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(POSTER_W / 2 - tagW / 2 - 46, 106);
  ctx.lineTo(POSTER_W / 2 - tagW / 2 - 14, 106);
  ctx.moveTo(POSTER_W / 2 + tagW / 2 + 14, 106);
  ctx.lineTo(POSTER_W / 2 + tagW / 2 + 46, 106);
  ctx.stroke();

  ctx.save();
  ctx.translate(POSTER_W / 2, 178);
  ctx.rotate(-0.02);
  ctx.font = "700 46px Fraunces, Georgia, serif";
  const bannerText = "Today's Bakes";
  const bannerTextW = ctx.measureText(bannerText).width;
  const bannerW = bannerTextW + 90;
  const bannerH = 62;
  ctx.fillStyle = GREEN;
  roundRectPath(ctx, -bannerW / 2, -bannerH / 2, bannerW, bannerH, bannerH / 2);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(bannerText, 0, 3);
  ctx.restore();

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = "500 22px Inter, sans-serif";
  ctx.fillStyle = CHARCOAL;
  ctx.fillText(dateLabel, POSTER_W / 2, 232);
  ctx.textAlign = "left";

  // Body — two balanced columns of bordered category boxes.
  let ly = headerH;
  for (const g of left) {
    ly += drawCategoryBox(ctx, padX, ly, colW, g, images[g.label]) + boxGap;
  }
  let ry = headerH;
  for (const g of right) {
    ry += drawCategoryBox(ctx, padX + colW + colGap, ry, colW, g, images[g.label]) + boxGap;
  }

  // Footer — a thin rule, then contact details on the same cream ground as
  // the real posters (no heavy color bar).
  const footerY = headerH + bodyH + 20;
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(padX, footerY);
  ctx.lineTo(POSTER_W - padX, footerY);
  ctx.stroke();

  ctx.font = "600 24px Inter, sans-serif";
  ctx.fillStyle = GREEN;
  const iconGap = 30; // icon glyph + gap before its text
  const phoneW = ctx.measureText(PHONE).width;
  const addrW = ctx.measureText(ADDRESS).width;
  const dividerGap = 28;
  const totalW = iconGap + addrW + dividerGap + 1 + dividerGap + iconGap + phoneW;
  const startX = POSTER_W / 2 - totalW / 2;
  const textY = footerY + 50;

  drawPinIcon(ctx, startX + 10, textY - 8, 22, GREEN);
  ctx.fillText(ADDRESS, startX + iconGap, textY);

  const dividerX = startX + iconGap + addrW + dividerGap;
  ctx.strokeStyle = BORDER;
  ctx.beginPath();
  ctx.moveTo(dividerX, footerY + 30);
  ctx.lineTo(dividerX, footerY + 50);
  ctx.stroke();

  const phoneIconCx = dividerX + dividerGap + 8;
  drawPhoneIcon(ctx, phoneIconCx, textY - 8, 20, GREEN);
  ctx.fillText(PHONE, phoneIconCx + 16, textY);
}

export default function Poster() {
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState(null);
  const [includeSpecialsOnly, setIncludeSpecialsOnly] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    api.getMenu().then((d) => setMenu(d.items)).catch((e) => setError(e.message));
  }, []);

  const groups = useMemo(() => {
    if (!menu) return [];
    const inStock = menu.filter((m) => m.inStock && m.price && m.category !== "custom" && m.category !== "special");
    const source = includeSpecialsOnly ? inStock.filter((m) => m.isSpecial) : inStock;
    const present = CATEGORY_ORDER.filter((c) => source.some((m) => m.category === c));
    source.forEach((m) => { if (!present.includes(m.category)) present.push(m.category); });
    return present.map((c) => ({
      label: CATEGORY_LABELS[c] || c.charAt(0).toUpperCase() + c.slice(1),
      items: source.filter((m) => m.category === c)
    }));
  }, [menu, includeSpecialsOnly]);

  const dateLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long"
  });

  useEffect(() => {
    if (!canvasRef.current || groups.length === 0) return;
    let cancelled = false;
    // One representative photo per category (its first item that actually has
    // one) — loaded before drawing so the canvas never has to redraw mid-paint.
    const imageEntries = groups.map((g) => [g.label, g.items.find((i) => i.imageUrl)?.imageUrl || null]);
    Promise.all([document.fonts.ready, ...imageEntries.map(([, url]) => loadImage(url))]).then(([, ...imgs]) => {
      if (cancelled || !canvasRef.current) return;
      const images = {};
      imageEntries.forEach(([label], i) => { images[label] = imgs[i]; });
      drawPoster(canvasRef.current, { groups, images, dateLabel });
    });
    return () => { cancelled = true; };
  }, [groups, dateLabel]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `garners-todays-bakes-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  if (error) return <p style={{ padding: 28, color: "var(--a-danger-text)" }}>Couldn't load menu: {error}</p>;

  return (
    <AdminPage
      eyebrow="Marketing"
      title="Today's Bakes poster"
      actions={
        <button className="admin-btn-primary" style={{ width: "auto", padding: "8px 16px" }} onClick={handleDownload} disabled={groups.length === 0}>
          Download PNG
        </button>
      }
    >
      <p style={{ fontSize: 13, color: "var(--a-text-secondary)", marginBottom: 16, maxWidth: 640 }}>
        Auto-built from today's in-stock menu — no more redesigning this by hand every morning.
        Download it and post it to your WhatsApp group the same way as before.
      </p>

      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 18 }}>
        <input type="checkbox" checked={includeSpecialsOnly} onChange={(e) => setIncludeSpecialsOnly(e.target.checked)} />
        Only include today's specials
      </label>

      {!menu ? (
        <p style={{ fontSize: 13, color: "var(--a-text-secondary)" }}>Loading menu…</p>
      ) : groups.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--a-text-secondary)" }}>
          Nothing in stock to show{includeSpecialsOnly ? " as a special" : ""} right now — mark some items in stock on the Menu page first.
        </p>
      ) : (
        <div style={{ maxWidth: 560, border: "1px solid var(--a-border)", borderRadius: "var(--a-radius)", overflow: "hidden", boxShadow: "0 6px 20px -10px rgba(0,0,0,0.25)" }}>
          <canvas ref={canvasRef} style={{ width: "100%", display: "block" }} />
        </div>
      )}
    </AdminPage>
  );
}
