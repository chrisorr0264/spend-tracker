// src/App.jsx
import React, { useEffect, useState } from "react";
import { primeCSRF, login, logout, getSummary, listExpenses, listSettlements, whoami, addExpense, addSettlement } from "./api";
import ExpenseForm from "./components/ExpenseForm";
import Modal from "./components/Modal";
import { currency, TextInput, NumberInput, Button, Card, CurrencySelect, PaidByPicker } from "./sharedControls";

function Tabs({ value, onChange, items }) {
  return (
    <div>
      <div className="flex gap-2 mb-3">
        {items.map(t => (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={`px-3 py-1.5 rounded-full border ${value === t.value ? "bg-gray-900 text-white" : "bg-white hover:bg-gray-50"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{items.find(t => t.value === value)?.content}</div>
    </div>
  );
}

function LoginPanel({ onLoggedIn }) {
  const [u, setU] = useState("admin");
  const [p, setP] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const doLogin = async (e) => {
    e.preventDefault();
    setErr(""); setBusy(true);
    try {
      await primeCSRF();
      await login(u, p);
      onLoggedIn();
    } catch (e) {
      setErr(e.message || "Login failed");
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <h2 className="text-xl font-semibold mb-2">Sign in</h2>
      <form onSubmit={doLogin} className="space-y-3">
        <div>
          <label className="text-sm">Username</label>
          <TextInput value={u} onChange={(e)=>setU(e.target.value)} autoComplete="username" />
        </div>
        <div>
          <label className="text-sm">Password</label>
          <TextInput type="password" value={p} onChange={(e)=>setP(e.target.value)} autoComplete="current-password" />
        </div>
        {err && <div className="text-sm text-red-600">{err}</div>}
        <div className="flex gap-2">
          <Button disabled={busy} type="submit">{busy? "Signing in…" : "Sign in"}</Button>
          <Button type="button" onClick={async()=>{ await primeCSRF(); alert("CSRF primed"); }}>Prime CSRF</Button>
        </div>
      </form>
    </Card>
  );
}

function SummaryCard({ data }) {
  return (
    <Card>
      <h2 className="text-lg font-semibold mb-2">Summary</h2>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between"><span>Bev owes Household (from expenses)</span><span className="font-semibold">{currency(data?.bev_owes_from_expenses)}</span></div>
        <div className="flex justify-between"><span>Household owes Bev (from expenses)</span><span className="font-semibold">{currency(data?.household_owes_from_expenses)}</span></div>
        <div className="flex justify-between"><span>Settlements: Bev → Household</span><span className="font-semibold">{currency(data?.settlements_bev_to_household)}</span></div>
        <div className="flex justify-between"><span>Settlements: Household → Bev</span><span className="font-semibold">{currency(data?.settlements_household_to_bev)}</span></div>
      </div>
      <div className="border-t mt-3 pt-3 flex items-center justify-between">
        <div className="text-base font-semibold">NET (positive ⇒ Bev owes Household)</div>
        <div className={`text-lg font-bold ${Number(data?.net) >= 0 ? "text-green-700":"text-rose-700"}`}>{currency(data?.net)}</div>
      </div>
    </Card>
  );
}

// (Your AddExpense and AddSettlement components from before remain unchanged)

export default function App() {
  const [authed, setAuthed] = useState(document.cookie.includes("sessionid="));
  const [me, setMe] = useState(null);
  const [summary, setSummary] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [tab, setTab] = useState("summary");
  const [editingId, setEditingId] = useState(null); // <-- inside component

  useEffect(() => {
    (async () => {
      try {
        await primeCSRF();
        console.log("CSRF cookie primed");
      } catch (err) {
        console.warn("CSRF prime failed:", err);
      }
    })();
  }, []);

  const refreshAll = async () => {
    try {
      const [s, e, st] = await Promise.all([getSummary(), listExpenses(), listSettlements()]);
      setSummary(s.data);
      setExpenses(e.data);
      setSettlements(st.data);
    } catch (e) {
      console.warn("Refresh failed (likely not logged in):", e?.response?.status);
    }
  };

  useEffect(() => { if (authed) refreshAll(); }, [authed]);

  useEffect(() => {
    if (!authed) return;
    (async () => {
      try {
        const data = await whoami();
        setMe(data);
      } catch {
        setMe(null);
      }
    })();
  }, [authed]);

  const isStaff = !!me?.is_staff;

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <h1 className="text-2xl font-bold mb-4">Thailand Spend Tracker</h1>
        <LoginPanel onLoggedIn={() => setAuthed(true)} />
        <div className="mt-4 text-sm text-gray-600">Step 1: Sign in with your Django admin user. The app uses session cookies.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Thailand Spend Tracker</h1>
        <div className="flex items-center gap-2">
          <Button onClick={refreshAll}>Refresh</Button>
          <Button onClick={async () => {
            try { await logout(); } finally {
              setMe(null);
              setAuthed(false);
              setTab("summary");
            }
          }}>Logout</Button>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          {
            value: "summary",
            label: "Summary",
            content: (
              <div className="grid gap-4">
                <SummaryCard data={summary} />
                <Card>
                  <h3 className="font-semibold mb-2">Expenses</h3>
                  {expenses?.length ? (
                    <div className="space-y-2">
                      {expenses.map((e)=> (
                        <div key={e.id} className="text-sm border rounded-lg p-3 bg-white">
                          <div className="flex justify-between items-start">
                            <div className="font-medium">{e.description}</div>
                            <div className="flex items-center gap-2">
                              <div>{new Date(e.date).toISOString().slice(0,10)}</div>
                              {isStaff && (
                                <button
                                  className="px-2 py-1 rounded border text-xs hover:bg-gray-50"
                                  onClick={() => setEditingId(e.id)}
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="text-gray-600">
                            {e.category} · {e.currency} {e.amount} @ FX {e.fx_to_cad}
                          </div>
                          <div className="text-gray-700">
                            Household {currency(e.share_household_cad)} · Bev {currency(e.share_bev_cad)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-sm text-gray-500">No expenses yet.</div>}
                </Card>
                <Card>
                  <h3 className="font-semibold mb-2">Settlements</h3>
                  {settlements?.length ? (
                    <div className="space-y-2">
                      {settlements.map((s)=> (
                        <div key={s.id} className="text-sm border rounded-lg p-3 bg-white">
                          <div className="flex justify-between">
                            <div className="font-medium">{s.from_party_name} → {s.to_party_name}</div>
                            <div>{new Date(s.date).toISOString().slice(0,10)}</div>
                          </div>
                          <div className="text-gray-700">Amount {currency(s.amount_cad)} · {s.notes}</div>
                        </div>
                      ))}
                    </div>
                  ) : <div className="text-sm text-gray-500">No settlements yet.</div>}
                </Card>
              </div>
            )
          },
          ...(isStaff ? [{
            value: "add-expense",
            label: "Add Expense",
            content: (
              // you can keep your existing AddExpense component if you prefer
              <ExpenseForm mode="create" isStaff={isStaff} onSaved={refreshAll} />
            )
          },
          {
            value: "add-settlement",
            label: "Add Settlement",
            content: (
              // keep your existing AddSettlement component if desired
              <div>
                {/* Your existing AddSettlement component here */}
              </div>
            )
          }] : [])
        ]}
      />

      <Modal open={!!editingId} onClose={() => setEditingId(null)}>
        {editingId && (
          <ExpenseForm
            mode="edit"
            expenseId={editingId}
            isStaff={isStaff}
            onSaved={async () => { setEditingId(null); await refreshAll(); }}
            onCancel={() => setEditingId(null)}
          />
        )}
      </Modal>

      <div className="fixed bottom-3 left-0 right-0 px-4">
        <div className="rounded-2xl shadow-md border bg-white p-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">Current Net (Bev → Household)</div>
          <div className={`text-lg font-bold ${Number(summary?.net) >= 0 ? "text-green-700" : "text-rose-700"}`}>{currency(summary?.net)}</div>
        </div>
      </div>
    </div>
  );
}
