import { useEffect, useState } from "react";
import { api } from "../api";
import MetricCard from "../components/MetricCard";

const dayLabel = (isoDate) => {
  const d = new Date(`${isoDate}T00:00:00`);
  const isToday = isoDate === new Date().toISOString().slice(0, 10);
  return isToday ? "Today" : d.toLocaleDateString(undefined, { weekday: "short" });
};

const BAR_MAX_HEIGHT = 120;

function RevenueChart({ days }) {
  const [hovered, setHovered] = useState(null);
  const maxRevenue = Math.max(...days.map((d) => d.revenue), 1);
  const peakIndex = days.reduce((best, d, i) => (d.revenue > days[best].revenue ? i : best), 0);
  const weekTotal = days.reduce((sum, d) => sum + d.revenue, 0);

  return (
    <div>
      <p style={{ margin: "0 0 14px", fontSize: "13px", color: "var(--text-secondary)" }}>
        ₹{weekTotal.toLocaleString()} total this week
      </p>

      {/* Single series (revenue) — no legend needed; the section title names what's plotted. */}
      <div style={{ position: "relative" }}>
        {/* max-value gridline */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            borderTop: "1px solid var(--border)",
            fontSize: "11px",
            color: "var(--text-muted)"
          }}
        >
          <span style={{ position: "relative", top: "-16px" }}>₹{maxRevenue.toLocaleString()}</span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "10px",
            height: BAR_MAX_HEIGHT,
            borderBottom: "1px solid var(--border-strong)",
            paddingTop: "18px"
          }}
        >
          {days.map((d, i) => {
            const h = Math.max((d.revenue / maxRevenue) * BAR_MAX_HEIGHT, d.revenue > 0 ? 3 : 1);
            return (
              <div
                key={d.date}
                style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", position: "relative" }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
              >
                {hovered === i && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: h + 8,
                      background: "var(--charcoal)",
                      color: "var(--cream)",
                      fontSize: "11px",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      whiteSpace: "nowrap",
                      zIndex: 1
                    }}
                  >
                    ₹{d.revenue.toLocaleString()} · {d.orders} order{d.orders === 1 ? "" : "s"}
                  </div>
                )}
                {i === peakIndex && d.revenue > 0 && (
                  <span style={{ fontSize: "11px", fontWeight: 500, marginBottom: "4px" }}>
                    ₹{d.revenue.toLocaleString()}
                  </span>
                )}
                <div
                  style={{
                    width: "24px",
                    maxWidth: "60%",
                    height: h,
                    background: "var(--green)",
                    borderRadius: "4px 4px 0 0"
                  }}
                />
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
          {days.map((d) => (
            <span
              key={d.date}
              style={{ flex: 1, textAlign: "center", fontSize: "11px", color: "var(--text-muted)" }}
            >
              {dayLabel(d.date)}
            </span>
          ))}
        </div>
      </div>

      {/* Table view of the same data — keeps every number available without relying on hover. */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "20px", fontSize: "12px" }}>
        <thead>
          <tr style={{ color: "var(--text-secondary)", textAlign: "left" }}>
            <th style={{ fontWeight: 500, padding: "4px 0" }}>Day</th>
            <th style={{ fontWeight: 500, padding: "4px 0", textAlign: "right" }}>Orders</th>
            <th style={{ fontWeight: 500, padding: "4px 0", textAlign: "right" }}>Revenue</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date} style={{ borderTop: "1px solid var(--border)" }}>
              <td style={{ padding: "5px 0" }}>{dayLabel(d.date)}</td>
              <td style={{ padding: "5px 0", textAlign: "right" }}>{d.orders}</td>
              <td style={{ padding: "5px 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                ₹{d.revenue.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BestSellers({ items }) {
  if (items.length === 0) {
    return <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>No orders yet.</p>;
  }
  const maxQty = Math.max(...items.map((i) => i.qty));

  return (
    <div>
      {items.map((item) => (
        <div key={item.name} style={{ marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
            <span>{item.name}</span>
            <span style={{ color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>{item.qty}</span>
          </div>
          <div style={{ background: "var(--surface-2)", borderRadius: "4px", height: "10px" }}>
            <div
              style={{
                width: `${(item.qty / maxQty) * 100}%`,
                height: "100%",
                background: "var(--kraft)",
                borderRadius: "4px"
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const expenseCategories = ["ingredients", "utilities", "rent", "wages", "other"];

function ExpensesPanel({ expenses, onChanged }) {
  const [form, setForm] = useState({ description: "", amount: "", category: "ingredients" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.description || !amount || amount <= 0) return;
    setSaving(true);
    setFormError(null);
    try {
      await api.createExpense({ description: form.description, amount, category: form.category });
      setForm({ description: "", amount: "", category: "ingredients" });
      await onChanged();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteExpense(id);
      await onChanged();
    } catch (err) {
      setFormError(err.message);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: "8px", marginBottom: "14px", flexWrap: "wrap" }} className="no-print">
        <input
          type="text"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          style={{ flex: 2, minWidth: "120px", padding: "7px 9px", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "6px" }}
        />
        <input
          type="number"
          step="0.01"
          placeholder="Amount"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          style={{ width: "90px", padding: "7px 9px", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "6px" }}
        />
        <select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
          style={{ padding: "7px 9px", fontSize: "12px", border: "1px solid var(--border)", borderRadius: "6px" }}
        >
          {expenseCategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving}
          style={{ padding: "7px 14px", fontSize: "12px", background: "var(--green)", color: "var(--cream)", border: "none", borderRadius: "6px" }}
        >
          Add
        </button>
      </form>

      {formError && <p style={{ fontSize: "12px", color: "var(--red)", marginBottom: "10px" }}>{formError}</p>}

      {expenses.length === 0 ? (
        <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>No expenses logged yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <tbody>
            {expenses.map((e) => (
              <tr key={e.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ padding: "6px 0" }}>{e.description}</td>
                <td style={{ padding: "6px 0", color: "var(--text-secondary)" }}>{e.category}</td>
                <td style={{ padding: "6px 0", color: "var(--text-secondary)" }}>{e.incurredAt}</td>
                <td style={{ padding: "6px 0", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>₹{e.amount.toLocaleString()}</td>
                <td style={{ padding: "6px 0 6px 8px", textAlign: "right" }} className="no-print">
                  <button
                    onClick={() => handleDelete(e.id)}
                    style={{ border: "none", background: "none", color: "var(--red)", cursor: "pointer", fontSize: "11px" }}
                  >
                    remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Reports() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = () => api.getReports().then(setData).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, []);

  if (error) return <p style={{ padding: 28, color: "var(--red)" }}>Couldn't load reports: {error}</p>;
  if (!data) return <p style={{ padding: 28, color: "var(--text-secondary)" }}>Loading reports…</p>;

  const exportCSV = () => {
    const lines = ["Day,Orders,Revenue"];
    data.last7Days.forEach((d) => lines.push(`${d.date},${d.orders},${d.revenue}`));
    lines.push("");
    lines.push("Item,Qty sold");
    data.bestSellers.forEach((i) => lines.push(`"${i.name.replace(/"/g, '""')}",${i.qty}`));
    lines.push("");
    lines.push("Expense,Category,Date,Amount");
    data.recentExpenses.forEach((e) =>
      lines.push(`"${e.description.replace(/"/g, '""')}",${e.category},${e.incurredAt},${e.amount}`)
    );
    lines.push("");
    lines.push(`All-time revenue,${data.allTimeRevenue}`);
    lines.push(`All-time expenses,${data.allTimeExpenses}`);
    lines.push(`All-time profit,${data.allTimeProfit}`);

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `garners-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: "28px", maxWidth: "1100px", margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ fontSize: "24px", marginBottom: "4px" }}>Reports</h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
            Revenue and top sellers, all-time and this week.
          </p>
        </div>
        {/* Excel opens CSV directly; "Print" uses the browser's own Save-as-PDF — no extra library needed. */}
        <div className="no-print" style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={exportCSV}
            style={{ padding: "7px 14px", fontSize: "12px", border: "1px solid var(--border-strong)", borderRadius: "8px", background: "var(--surface-1)" }}
          >
            Export CSV
          </button>
          <button
            onClick={() => window.print()}
            style={{ padding: "7px 14px", fontSize: "12px", border: "1px solid var(--border-strong)", borderRadius: "8px", background: "var(--surface-1)" }}
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "14px",
          marginBottom: "28px"
        }}
      >
        <MetricCard label="All-time revenue" value={`₹${data.allTimeRevenue.toLocaleString()}`} />
        <MetricCard label="All-time expenses" value={`₹${data.allTimeExpenses.toLocaleString()}`} />
        <MetricCard
          label="All-time profit"
          value={`₹${data.allTimeProfit.toLocaleString()}`}
          tone={data.allTimeProfit < 0 ? "warning" : "default"}
        />
        <MetricCard label="All-time orders" value={data.allTimeOrders} />
        <MetricCard label="Placed" value={data.ordersByStatus.placed || 0} />
        <MetricCard label="Delivered" value={data.ordersByStatus.delivered || 0} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "20px", marginBottom: "20px" }}>
        <section style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "18px" }}>
          <h2 style={{ fontSize: "16px", marginBottom: "10px" }}>Revenue, last 7 days</h2>
          <RevenueChart days={data.last7Days} />
        </section>

        <section style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "18px" }}>
          <h2 style={{ fontSize: "16px", marginBottom: "14px" }}>Best sellers</h2>
          <BestSellers items={data.bestSellers} />
        </section>
      </div>

      <section style={{ border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "18px" }}>
        <h2 style={{ fontSize: "16px", marginBottom: "4px" }}>Expenses</h2>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "14px" }}>
          This week: ₹{data.expensesLast7Days.toLocaleString()} spent, ₹{data.profitLast7Days.toLocaleString()} profit.
        </p>
        <ExpensesPanel expenses={data.recentExpenses} onChanged={load} />
      </section>
    </div>
  );
}
