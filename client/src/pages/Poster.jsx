import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";
import { AdminPage } from "../components/admin/AdminUI";

// Same labels Order.jsx shows customers, so the poster's category headings
// match what people see when they actually open the app to order.
const CATEGORY_LABELS = {
  breads: "Breads",
  cookies: "Cookies",
  pastries: "Pastries",
  cakes: "Cakes"
};
const CATEGORY_ORDER = ["breads", "cookies", "pastries", "cakes"];

const POSTER_W = 1080;
const PHONE = "7812813248";
const ADDRESS = "Whitefield / Kannamangala, Bengaluru";

// Renders the poster onto a canvas at a fixed 1080px width, growing its height
// to fit however many in-stock items there are today — this is what used to be
// designed by hand in an external tool every morning.
function drawPoster(canvas, { groups, dateLabel }) {
  const rowH = 40;
  const catGapTop = 44; // space above each category heading
  const catToFirstRow = 34; // underline gap (8) + breathing room before the first item (26)
  const headerH = 260;
  const footerH = 190;
  const padX = 70;
  const bodyTopPad = 30;

  let bodyH = bodyTopPad;
  for (const g of groups) {
    bodyH += catGapTop + catToFirstRow + g.items.length * rowH;
  }
  const height = headerH + bodyH + footerH;

  canvas.width = POSTER_W;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  // Header — same brown gradient as the storefront hero.
  const headerGrad = ctx.createLinearGradient(0, 0, POSTER_W, headerH);
  headerGrad.addColorStop(0, "#7a4a26");
  headerGrad.addColorStop(0.6, "#3f2a17");
  headerGrad.addColorStop(1, "#241811");
  ctx.fillStyle = headerGrad;
  ctx.fillRect(0, 0, POSTER_W, headerH);

  ctx.fillStyle = "#faf8f3";
  ctx.textBaseline = "alphabetic";
  ctx.font = "600 30px Inter, sans-serif";
  ctx.fillText("GARNERS Cakes & Breads", padX, 76);

  ctx.font = "700 64px Fraunces, Georgia, serif";
  ctx.fillText("Today's Bakes", padX, 158);

  ctx.font = "400 26px Inter, sans-serif";
  ctx.fillStyle = "rgba(250,248,243,0.85)";
  ctx.fillText(dateLabel, padX, 200);

  ctx.font = "400 22px Inter, sans-serif";
  ctx.fillStyle = "rgba(250,248,243,0.7)";
  ctx.fillText("Order online or via WhatsApp — link in bio", padX, 234);

  // Body — cream background, category headings + item rows.
  ctx.fillStyle = "#faf8f3";
  ctx.fillRect(0, headerH, POSTER_W, bodyH);

  let y = headerH + bodyTopPad;
  for (const g of groups) {
    y += catGapTop;
    ctx.fillStyle = "#b8925a";
    ctx.font = "700 24px Inter, sans-serif";
    ctx.fillText(g.label.toUpperCase(), padX, y);
    ctx.strokeStyle = "#e3ddcf";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padX, y + 14);
    ctx.lineTo(POSTER_W - padX, y + 14);
    ctx.stroke();
    y += catToFirstRow;

    for (const item of g.items) {
      ctx.fillStyle = "#26241f";
      ctx.font = "500 27px Inter, sans-serif";
      ctx.fillText(item.name, padX, y);

      const priceText = item.price ? `Rs ${item.price}` : "Made to order";
      ctx.font = "600 27px Inter, sans-serif";
      const w = ctx.measureText(priceText).width;
      ctx.fillText(priceText, POSTER_W - padX - w, y);

      // Dotted leader between name and price
      ctx.font = "500 27px Inter, sans-serif";
      const nameW = ctx.measureText(item.name).width;
      ctx.strokeStyle = "#c9c2ae";
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(padX + nameW + 14, y - 8);
      ctx.lineTo(POSTER_W - padX - w - 14, y - 8);
      ctx.stroke();
      ctx.setLineDash([]);

      y += rowH;
    }
  }

  // Footer — dark green bar with contact info, matching the app's brand green.
  const footerY = headerH + bodyH;
  ctx.fillStyle = "#1f3d2e";
  ctx.fillRect(0, footerY, POSTER_W, footerH);

  ctx.fillStyle = "#faf8f3";
  ctx.font = "700 26px Inter, sans-serif";
  ctx.fillText(`Call / WhatsApp: ${PHONE}`, padX, footerY + 60);
  ctx.font = "400 22px Inter, sans-serif";
  ctx.fillStyle = "rgba(250,248,243,0.8)";
  ctx.fillText(ADDRESS, padX, footerY + 96);
  ctx.fillText("Free delivery in select zones · Closed Mondays", padX, footerY + 128);
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
    return present.map((c) => ({
      label: CATEGORY_LABELS[c] || c,
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
    // Fraunces/Inter are already loaded by the app shell for its own headings —
    // wait for them so the poster doesn't render one frame in a fallback font.
    document.fonts.ready.then(() => {
      if (canvasRef.current) drawPoster(canvasRef.current, { groups, dateLabel });
    });
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
        <div style={{ maxWidth: 460, border: "1px solid var(--a-border)", borderRadius: "var(--a-radius)", overflow: "hidden", boxShadow: "0 6px 20px -10px rgba(0,0,0,0.25)" }}>
          <canvas ref={canvasRef} style={{ width: "100%", display: "block" }} />
        </div>
      )}
    </AdminPage>
  );
}
