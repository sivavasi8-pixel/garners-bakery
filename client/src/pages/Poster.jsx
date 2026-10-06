import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { AdminPage } from "../components/admin/AdminUI";
import { makeQr } from "../qr";

// Same labels Order.jsx shows customers, so the poster's category headings
// match what people see when they actually open the app to order.
const CATEGORY_LABELS = {
  special: "Today's Special",
  breads: "Bread",
  buns: "Buns",
  pastries: "Pastries",
  cookies: "Cookies",
  cakes: "Cakes"
};
const CATEGORY_ORDER = ["special", "breads", "buns", "pastries", "cookies", "cakes"];

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
// A real uploaded photo gets genuine hero treatment — a wide banner across the
// top of its category's box — rather than a small thumbnail squeezed beside
// the list, which made a real product photo look like an afterthought.
const IMG_BANNER_H = 190;
const IMG_GAP_BOTTOM = 18;

// Height a category box will need, before it's actually drawn — used both to
// balance items across the two columns and to size the canvas up front.
const boxHeight = (group, hasImg) =>
  BOX_PAD_TOP + (hasImg ? IMG_BANNER_H + IMG_GAP_BOTTOM : 0) + group.items.length * ROW_H + BOX_PAD_BOTTOM;

const fitText = (ctx, text, maxW) => {
  for (const size of [22, 20, 18]) {
    ctx.font = `500 ${size}px Inter, sans-serif`;
    if (ctx.measureText(text).width <= maxW) return { text, font: ctx.font };
  }
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return { text: `${t.trimEnd()}…`, font: ctx.font };
};

function drawCategoryBox(ctx, x, y, w, group, img) {
  const hasImg = !!img;
  const h = boxHeight(group, hasImg);
  const textW = w - BOX_PAD_X * 2;

  // Box border — a plain rounded rectangle rather than a filled card, so
  // several sitting side by side still read as one warm sheet of paper.
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, x, y, w, h, 14);
  ctx.stroke();

  // A real product photo as a wide hero banner across the top of its box —
  // the same visual weight a photo gets on the hand-designed posters — rather
  // than a small thumbnail that made it look incidental.
  if (hasImg) {
    const imgY = y + BOX_PAD_TOP - 6;
    drawImageCover(ctx, img, x + BOX_PAD_X, imgY, w - BOX_PAD_X * 2, IMG_BANNER_H, 10);
  }

  // Category pill — sits astride the box's top border, drawn level (no tilt —
  // an earlier slant read as crooked rather than intentional).
  ctx.font = "700 22px Inter, sans-serif";
  const label = group.label.toUpperCase();
  const labelW = ctx.measureText(label).width;
  const pillW = labelW + 34;
  const pillH = 38;
  const pillCx = x + 18 + pillW / 2;
  const pillCy = y;
  ctx.fillStyle = GREEN;
  roundRectPath(ctx, pillCx - pillW / 2, pillCy - pillH / 2, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, pillCx + 1, pillCy + 1);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Item rows — name, a dotted leader, then the price, starting below the hero
  // photo (if any). The name's max width is capped to what's left after the
  // price, so a long item name steps down a size rather than overlapping it.
  let rowY = y + BOX_PAD_TOP + (hasImg ? IMG_BANNER_H + IMG_GAP_BOTTOM : 0) + 22;
  for (const item of group.items) {
    const priceText = item.price ? `Rs ${item.price}` : "TBD";
    ctx.font = "700 22px Inter, sans-serif";
    const priceW = ctx.measureText(priceText).width;
    ctx.fillStyle = CHARCOAL;
    ctx.fillText(priceText, x + BOX_PAD_X + textW - priceW, rowY);

    // A long name first steps down to a slightly smaller size, then is trimmed
    // with "…" — never squashed sideways, which made it hard to read.
    const nameMaxW = textW - priceW - 20;
    const fitted = fitText(ctx, item.name, nameMaxW);
    ctx.font = fitted.font;
    const nameActualW = ctx.measureText(fitted.text).width;
    ctx.fillText(fitted.text, x + BOX_PAD_X, rowY);

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

// Draws a QR code (see ../qr.js) as crisp squares on a white rounded tile —
// the white margin is the "quiet zone" scanners need around the code.
function drawQr(ctx, qr, x, y, box) {
  ctx.fillStyle = "#ffffff";
  roundRectPath(ctx, x, y, box, box, 12);
  ctx.fill();
  ctx.strokeStyle = BORDER;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const quiet = 4;
  const cell = Math.floor(box / (qr.size + quiet * 2));
  const offset = Math.round((box - cell * qr.size) / 2);
  ctx.fillStyle = CHARCOAL;
  for (let r = 0; r < qr.size; r++) {
    for (let c = 0; c < qr.size; c++) {
      if (qr.isDark(c, r)) ctx.fillRect(x + offset + c * cell, y + offset + r * cell, cell, cell);
    }
  }
}

// Big enough to stay scannable even if WhatsApp shrinks the picture.
const QR_BOX = 240;

// Renders the poster onto a canvas at a fixed 1080px width, growing its height
// to fit however many items are on today's list — this is what used to be
// designed by hand in an external tool every morning.
function drawPoster(canvas, { groups, images, dateLabel, orderUrl, qr }) {
  const padX = 64;
  const colGap = 28;
  const colW = (POSTER_W - padX * 2 - colGap) / 2;
  const boxGap = 22;
  const headerH = 280;
  const footerH = qr ? QR_BOX + 90 : 110;

  // Greedily balance categories across two columns by their (known-in-advance)
  // box height, so neither column ends up dramatically taller than the other.
  const left = [];
  const right = [];
  let leftH = 0;
  let rightH = 0;
  for (const g of groups) {
    const h = boxHeight(g, !!images[g.label]);
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

  ctx.font = "700 46px Fraunces, Georgia, serif";
  const bannerText = "Today's Bakes";
  const bannerTextW = ctx.measureText(bannerText).width;
  const bannerW = bannerTextW + 90;
  const bannerH = 62;
  const bannerCx = POSTER_W / 2;
  const bannerCy = 178;
  ctx.fillStyle = GREEN;
  roundRectPath(ctx, bannerCx - bannerW / 2, bannerCy - bannerH / 2, bannerW, bannerH, bannerH / 2);
  ctx.fill();
  ctx.fillStyle = CREAM;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(bannerText, bannerCx, bannerCy + 3);

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

  if (qr) {
    // QR on the left, "order online" + contact lines beside it.
    const qrY = footerY + 32;
    drawQr(ctx, qr, padX, qrY, QR_BOX);
    const tx = padX + QR_BOX + 40;
    const top = qrY + 22;
    ctx.fillStyle = GREEN;
    ctx.font = "700 44px Fraunces, Georgia, serif";
    ctx.fillText("Order online", tx, top + 44);
    ctx.font = "500 22px Inter, sans-serif";
    ctx.fillStyle = CHARCOAL;
    ctx.fillText("Scan the code, or open:", tx, top + 84);
    ctx.font = "700 24px Inter, sans-serif";
    ctx.fillStyle = GREEN;
    const shortUrl = orderUrl.replace(/^https?:\/\//, "");
    const urlFit = fitText(ctx, shortUrl, POSTER_W - padX - tx);
    ctx.font = urlFit.font.replace("500", "700");
    ctx.fillText(urlFit.text, tx, top + 118);

    ctx.font = "600 22px Inter, sans-serif";
    drawPinIcon(ctx, tx + 10, top + 164, 20, GREEN);
    ctx.fillText(ADDRESS, tx + 30, top + 172);
    const addrEnd = tx + 30 + ctx.measureText(ADDRESS).width;
    drawPhoneIcon(ctx, addrEnd + 40, top + 164, 18, GREEN);
    ctx.fillText(PHONE, addrEnd + 56, top + 172);
    return;
  }

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

// Which items the person unticked today — remembered on this device until
// tomorrow, so re-opening the page doesn't undo their choices. A convenience
// only: if storage is blocked, everything simply starts ticked.
const todayKey = () => `garners_poster_hidden_${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}`;
const loadHidden = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(todayKey()) || "[]"));
  } catch {
    return new Set();
  }
};
const saveHidden = (set) => {
  try {
    localStorage.setItem(todayKey(), JSON.stringify([...set]));
  } catch {
    // storage blocked — choices last for this visit only
  }
};

const isSpecialItem = (m) => m.category === "special" || m.isSpecial;
const fileName = () => `garners-todays-bakes-${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })}.png`;

// The WhatsApp message that goes with the picture: a short list (for people
// who read the text, or whose phone didn't load the image) plus the order link.
const buildMessage = (groups, orderUrl) => {
  const lines = ["Today's bakes at GARNERS Cakes & Breads", ""];
  for (const g of groups) {
    lines.push(`*${g.label}*`);
    g.items.forEach((i) => lines.push(`• ${i.name}${i.price ? ` — ₹${i.price}` : ""}`));
    lines.push("");
  }
  lines.push(`Order online: ${orderUrl}`);
  lines.push(`Call: ${PHONE}`);
  return lines.join("\n");
};

export default function Poster() {
  const [menu, setMenu] = useState(null);
  const [error, setError] = useState(null);
  const [hidden, setHidden] = useState(loadHidden);
  const [showQr, setShowQr] = useState(true);
  const [message, setMessage] = useState("");
  const [messageEdited, setMessageEdited] = useState(false);
  const [status, setStatus] = useState(null);
  const canvasRef = useRef(null);
  const fileRef = useRef(null);
  const orderUrl = `${window.location.origin}/order`;
  const canShareFiles = typeof navigator !== "undefined" && typeof navigator.canShare === "function";

  useEffect(() => {
    api.getMenu().then((d) => setMenu(d.items)).catch((e) => setError(e.message));
  }, []);

  // Everything that could go on today's poster: in stock, priced, not made-to-order.
  const available = useMemo(
    () => (menu || []).filter((m) => m.inStock && m.price && m.category !== "custom"),
    [menu]
  );

  const groups = useMemo(() => {
    const source = available.filter((m) => !hidden.has(m.id));
    const present = CATEGORY_ORDER.filter((c) => source.some((m) => m.category === c));
    source.forEach((m) => { if (!present.includes(m.category)) present.push(m.category); });
    return present.map((c) => ({
      label: CATEGORY_LABELS[c] || c.charAt(0).toUpperCase() + c.slice(1),
      items: source.filter((m) => m.category === c)
    }));
  }, [available, hidden]);

  // Picker groups list every available item (ticked or not), in poster order.
  const pickerGroups = useMemo(() => {
    const present = CATEGORY_ORDER.filter((c) => available.some((m) => m.category === c));
    available.forEach((m) => { if (!present.includes(m.category)) present.push(m.category); });
    return present.map((c) => ({
      id: c,
      label: CATEGORY_LABELS[c] || c.charAt(0).toUpperCase() + c.slice(1),
      items: available.filter((m) => m.category === c)
    }));
  }, [available]);

  const updateHidden = (next) => {
    setHidden(next);
    saveHidden(next);
    setStatus(null);
  };
  const toggleItem = (id) => {
    const next = new Set(hidden);
    next.has(id) ? next.delete(id) : next.add(id);
    updateHidden(next);
  };
  const selectAll = () => updateHidden(new Set());
  const selectNone = () => updateHidden(new Set(available.map((m) => m.id)));
  const specialsOnly = () => updateHidden(new Set(available.filter((m) => !isSpecialItem(m)).map((m) => m.id)));

  const dateLabel = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata"
  });

  const qr = useMemo(() => (showQr ? makeQr(orderUrl) : null), [showQr, orderUrl]);

  // Keep the message in step with the list until someone edits it by hand.
  useEffect(() => {
    if (!messageEdited) setMessage(buildMessage(groups, orderUrl));
  }, [groups, orderUrl, messageEdited]);

  useEffect(() => {
    fileRef.current = null;
    if (!canvasRef.current || groups.length === 0) return;
    let cancelled = false;
    // One representative photo per category — now drawn as a real hero banner,
    // so it's worth picking the best candidate rather than just the first item
    // in list order: a special/popular item is more likely to have a photo the
    // owner actually chose to showcase, not just whatever happened to be shot first.
    const bestPhoto = (items) => {
      const withPhoto = items.filter((i) => i.imageUrl);
      const featured = withPhoto.find((i) => isSpecialItem(i) || i.isPopular);
      return (featured || withPhoto[0])?.imageUrl || null;
    };
    const imageEntries = groups.map((g) => [g.label, bestPhoto(g.items)]);
    Promise.all([document.fonts.ready, ...imageEntries.map(([, url]) => loadImage(url))]).then(([, ...imgs]) => {
      if (cancelled || !canvasRef.current) return;
      const images = {};
      imageEntries.forEach(([label], i) => { images[label] = imgs[i]; });
      drawPoster(canvasRef.current, { groups, images, dateLabel, orderUrl, qr });
      // Prepare the image file now, so the Share button can hand it over the
      // instant it's tapped (phones only allow sharing straight from a tap).
      canvasRef.current.toBlob((blob) => {
        if (!cancelled && blob) fileRef.current = new File([blob], fileName(), { type: "image/png" });
      }, "image/png");
    });
    return () => { cancelled = true; };
  }, [groups, dateLabel, orderUrl, qr]);

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setStatus("Message copied — paste it into WhatsApp with the picture.");
    } catch {
      setStatus("Couldn't copy automatically — select the message below and copy it.");
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName();
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  // Phone: opens the share sheet with the picture (and message) attached —
  // pick WhatsApp, then the group. Computers without file sharing get the
  // picture downloaded and the message copied instead.
  const handleShare = async () => {
    const file = fileRef.current;
    if (file && canShareFiles && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: message });
        setStatus("Shared.");
      } catch (err) {
        if (err?.name !== "AbortError") setStatus("Sharing didn't work here — use Download and Copy message instead.");
      }
      return;
    }
    handleDownload();
    await copyMessage();
    setStatus("Picture downloaded and message copied — attach the picture in WhatsApp and paste the message.");
  };

  if (error) return <AdminPage title="Today's poster"><p style={{ color: "var(--a-danger-text)" }}>Couldn't load the menu: {error}. Refresh to try again.</p></AdminPage>;

  const shownCount = available.length - available.filter((m) => hidden.has(m.id)).length;

  return (
    <AdminPage
      eyebrow={dateLabel}
      title="Today's poster"
      actions={
        <>
          <button type="button" className="a-btn quiet" onClick={handleDownload} disabled={groups.length === 0}>
            <i className="ti ti-download" aria-hidden="true" /> Download
          </button>
          <button type="button" className="a-btn primary" onClick={handleShare} disabled={groups.length === 0}>
            <i className="ti ti-brand-whatsapp" aria-hidden="true" /> Share to WhatsApp
          </button>
        </>
      }
    >
      {status && <p className="poster-status" role="status">{status}</p>}

      {!menu ? (
        <p className="poster-muted">Loading the menu…</p>
      ) : available.length === 0 ? (
        <p className="poster-muted">Nothing is in stock right now. Mark items available on the Menu or POS page first, then come back here.</p>
      ) : (
        <div className="poster-layout">
          <div className="poster-controls">
            <section className="poster-panel" aria-labelledby="pick-heading">
              <div className="poster-panel-head">
                <h2 id="pick-heading">What's on today's poster</h2>
                <span className="poster-count">{shownCount} of {available.length}</span>
              </div>
              <div className="poster-quick">
                <button type="button" className="admin-btn-xs" onClick={selectAll}>Everything in stock</button>
                <button type="button" className="admin-btn-xs" onClick={specialsOnly}>Only specials</button>
                <button type="button" className="admin-btn-xs" onClick={selectNone}>Clear</button>
              </div>
              {pickerGroups.map((g) => (
                <fieldset key={g.id} className="pick-group">
                  <legend>{g.label}</legend>
                  {g.items.map((m) => (
                    <label key={m.id} className="pick-item">
                      <input type="checkbox" checked={!hidden.has(m.id)} onChange={() => toggleItem(m.id)} />
                      <span className="pick-name">{m.name}{m.isSpecial && m.category !== "special" ? <span className="pick-tag">Special</span> : null}</span>
                      <span className="pick-price">₹{m.price}</span>
                    </label>
                  ))}
                </fieldset>
              ))}
              <p className="poster-muted small">Only items marked in stock appear here. Your ticks are remembered on this device for today.</p>
            </section>

            <section className="poster-panel" aria-labelledby="share-heading">
              <h2 id="share-heading">Order link</h2>
              <label className="pick-item">
                <input type="checkbox" checked={showQr} onChange={(e) => setShowQr(e.target.checked)} />
                <span className="pick-name">Put an "Order online" QR code on the poster</span>
              </label>
              <p className="poster-link">{orderUrl}</p>
            </section>

            <section className="poster-panel" aria-labelledby="msg-heading">
              <div className="poster-panel-head">
                <h2 id="msg-heading">Message to send with it</h2>
                {messageEdited && (
                  <button type="button" className="admin-link-btn" onClick={() => setMessageEdited(false)}>Reset</button>
                )}
              </div>
              <textarea
                id="poster-message"
                className="poster-message"
                rows={8}
                value={message}
                onChange={(e) => { setMessage(e.target.value); setMessageEdited(true); }}
                aria-label="WhatsApp message"
              />
              <button type="button" className="a-btn quiet" onClick={copyMessage}>
                <i className="ti ti-copy" aria-hidden="true" /> Copy message
              </button>
            </section>
          </div>

          <div className="poster-preview">
            {groups.length === 0 ? (
              <p className="poster-muted">Tick at least one item to build the poster.</p>
            ) : (
              <canvas ref={canvasRef} className="poster-canvas" aria-label="Today's Bakes poster preview" role="img" />
            )}
          </div>
        </div>
      )}

      <style>{`
        .poster-status {
          margin: 0 0 16px; padding: 12px 14px; border-radius: 12px;
          background: var(--a-success-bg); color: var(--a-success-text); font-weight: 600;
        }
        .poster-muted { color: var(--a-text-secondary); margin: 0; }
        .poster-muted.small { font-size: 13px; }
        .poster-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 20px; align-items: start; }
        @media (min-width: 1000px) { .poster-layout { grid-template-columns: minmax(0, 420px) minmax(0, 1fr); } }
        .poster-controls { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
        .poster-panel {
          background: var(--a-panel); border: 1px solid var(--a-border); border-radius: var(--a-radius-lg);
          padding: 16px 18px; display: flex; flex-direction: column; gap: 12px;
        }
        .poster-panel h2 { margin: 0; font: 700 16px var(--font-body); }
        .poster-panel-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
        .poster-count { font-size: 13px; font-weight: 600; color: var(--a-text-secondary); }
        .poster-quick { display: flex; gap: 8px; flex-wrap: wrap; }
        .pick-group { border: 0; margin: 0; padding: 0; display: flex; flex-direction: column; }
        .pick-group legend { padding: 0; margin-bottom: 4px; font-size: 12.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--a-text-secondary); }
        .pick-item { display: flex; align-items: center; gap: 12px; min-height: 44px; cursor: pointer; border-bottom: 1px solid var(--a-border-soft); }
        .pick-item:last-child { border-bottom: none; }
        .pick-item input { width: 20px; height: 20px; accent-color: var(--a-green); margin: 0; flex-shrink: 0; }
        .pick-name { flex: 1; min-width: 0; font-weight: 600; }
        .pick-tag { margin-left: 8px; font-size: 11.5px; font-weight: 700; color: #6b4a32; background: #f3e9d7; border-radius: 6px; padding: 2px 6px; }
        .pick-price { color: var(--a-text-secondary); font-weight: 600; }
        .poster-link { margin: 0; font-size: 13px; color: var(--a-text-secondary); overflow-wrap: anywhere; }
        .poster-message {
          width: 100%; box-sizing: border-box; border: 1px solid var(--a-border); border-radius: 12px; padding: 12px 14px;
          font: 400 14px/1.5 var(--font-body); color: var(--a-text-primary); resize: vertical;
        }
        .poster-message:focus { outline: none; border-color: var(--a-green); }
        .admin-link-btn { border: none; background: none; color: var(--a-green); cursor: pointer; font-size: 13px; font-weight: 600; padding: 8px 0; }
        .poster-preview { min-width: 0; }
        @media (min-width: 1000px) { .poster-preview { position: sticky; top: 20px; } }
        .poster-canvas {
          width: 100%; max-width: 560px; display: block; border: 1px solid var(--a-border);
          border-radius: var(--a-radius); box-shadow: 0 6px 20px -10px rgba(0,0,0,0.25);
        }
      `}</style>
    </AdminPage>
  );
}
