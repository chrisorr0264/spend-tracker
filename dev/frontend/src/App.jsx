// =====================
// frontend/src/App.jsx
// =====================
import React, { useEffect, useMemo, useState } from 'react'
import { primeCSRF, login, logout, getSummary, listExpenses, listSettlements, addExpense, addSettlement } from './api'


// ---- helpers ----
function currency(num) {
  if (num == null || Number.isNaN(num)) return '—'
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'CAD' }).format(num)
}

function TextInput(props) {
  return <input {...props} className={`w-full px-3 py-2 rounded-md border outline-none ${props.className || ''}`} />
}
function NumberInput(props) {
  return <input type="number" step="0.01" {...props} className={`w-full px-3 py-2 rounded-md border outline-none ${props.className || ''}`} />
}
function Button({ children, ...rest }) {
  return <button {...rest} className={`px-4 py-2 rounded-xl border shadow-sm active:scale-[0.99] ${rest.className || ''}`}>{children}</button>
}
function Card({ children }) { return <div className="rounded-2xl bg-white shadow-sm border p-4">{children}</div> }

// ---- Tabs ----
function Tabs({ value, onChange, items }) {
  return (
    <div>
      <div className="flex gap-2 mb-3">
        {items.map(t => (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={`px-3 py-1.5 rounded-full border ${value === t.value ? 'bg-gray-900 text-white' : 'bg-white hover:bg-gray-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{items.find(t => t.value === value)?.content}</div>
    </div>
  )
}

// ---- Currency Select with "Recent 5" ----
const DEFAULT_CURRENCIES = ['CAD','USD','THB','JPY','EUR','GBP','AUD','NZD','SGD','PHP','VND','IDR'];

function CurrencySelect({ value, onChange, all = DEFAULT_CURRENCIES }) {
  const [recent, setRecent] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/recent-currencies/', { credentials: 'include' });
        if (r.ok) setRecent(await r.json());
      } catch {}
    })();
  }, []);

  const ordered = useMemo(() => {
    const dedup = new Set(recent.filter(c => all.includes(c)).concat(all));
    return Array.from(dedup);
  }, [recent, all]);

  const handleChange = async (e) => {
    const code = e.target.value;
    onChange(code);
    // fire-and-forget to pin to recent list
    try {
      await fetch('/api/recent-currencies/', {
        method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRFToken': getCookie('csrftoken') || ''     // ← include CSRF
          },
        credentials: 'include',
        body: JSON.stringify({ code }),
      });
    } catch {}
  };

  const recentPinned = recent.filter(c => all.includes(c));

  return (
    <select className="w-full px-3 py-2 rounded-md border" value={value} onChange={handleChange}>
      {recentPinned.length > 0 && (
        <optgroup label="Recent">
          {recentPinned.map(c => <option key={`r-${c}`} value={c}>{c}</option>)}
        </optgroup>
      )}
      <optgroup label="All">
        {ordered.map(c => <option key={c} value={c}>{c}</option>)}
      </optgroup>
    </select>
  );
}

// ---- PaidBy: Party toggle -> Person select ----
function PaidByPicker({ value, onChange }) {
  const [people, setPeople] = useState([]);
  const [partyFilter, setPartyFilter] = useState('household'); // 'household' | 'bev'

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/people/', { credentials: 'include' });
        if (r.ok) setPeople(await r.json());
      } catch {}
    })();
  }, []);

  // We expect person.party to include either is_household boolean or slug ('household'/'bev').
  const filtered = useMemo(() => {
    return people.filter(p => {
      const party = p.party || {};
      if (partyFilter === 'household') return !!party.is_household || party.slug === 'household';
      return !party.is_household || party.slug === 'bev';
    });
  }, [people, partyFilter]);

  return (
    <div className="space-y-2">
      <div className="flex gap-4">
        <label className="inline-flex items-center gap-2">
          <input type="radio" name="party" value="household"
                 checked={partyFilter === 'household'}
                 onChange={() => setPartyFilter('household')} />
          Household
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="radio" name="party" value="bev"
                 checked={partyFilter === 'bev'}
                 onChange={() => setPartyFilter('bev')} />
          Bev
        </label>
      </div>
      <select className="w-full px-3 py-2 rounded-md border" value={value} onChange={e => onChange(Number(e.target.value))}>
        <option value="">Select person…</option>
        {filtered.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}

// ---- Auth/Login ----
function LoginPanel({ onLoggedIn }) {
  const [u, setU] = useState('admin')
  const [p, setP] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const doLogin = async (e) => {
    e.preventDefault()
    setErr(''); setBusy(true)
    try {
      await primeCSRF()
      await login(u, p)
      onLoggedIn()
    } catch (e) {
      setErr(e.message || 'Login failed')
    } finally { setBusy(false) }
  }

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
          <Button disabled={busy} type="submit">{busy? 'Signing in…':'Sign in'}</Button>
          <Button type="button" onClick={async()=>{ await primeCSRF(); alert('CSRF primed'); }}>Prime CSRF</Button>
        </div>
      </form>
    </Card>
  )
}

// ---- Summary ----
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
        <div className={`text-lg font-bold ${Number(data?.net) >= 0 ? 'text-green-700':'text-rose-700'}`}>{currency(data?.net)}</div>
      </div>
    </Card>
  )
}

// ---- Add Expense (tabs + dropdowns + auto-FX + paid-by + weights grid) ----
function AddExpense({ onAdded }) {
  const today = new Date().toISOString().slice(0,10)
  const [f, setF] = useState({
    date: today,
    description:'', category:'lodging',
    currency:'THB', fx_to_cad:'', amount:'',
    paid_by:'', // person id
    weight_household:2, weight_bev:1,
    notes:''
  })
  const [fxBusy, setFxBusy] = useState(false)

  // auto-FX: CAD -> currency for selected date
  useEffect(() => {
    const run = async () => {
      if (!f.date || !f.currency) return;
      setFxBusy(true)
      try {
        const base = encodeURIComponent(f.currency || 'CAD');
        const quote = 'CAD';
        if (base === quote) { setF(prev => ({ ...prev, fx_to_cad: 1 })); return; }
        const r = await fetch(`/api/fx-rate/?date=${encodeURIComponent(f.date)}&base=${base}&quote=${quote}`, { credentials: 'include' });

        if (r.ok) {
          const d = await r.json();
          setF(prev => ({ ...prev, fx_to_cad: d.rate }));
        }
      } catch {} finally {
        setFxBusy(false)
      }
    };
    run();
  }, [f.date, f.currency]);

  const submit = async (e) => {
    e.preventDefault()
    try {
      await addExpense({
        ...f,
        paid_by: f.paid_by ? Number(f.paid_by) : null,
        fx_to_cad: Number(f.fx_to_cad || 1),
        amount: Number(f.amount)
      })
      setF((x)=>({ ...x, description:'', amount:'', notes:'' }))
      onAdded?.()
    } catch (e) {
      alert('Add failed (are you staff / logged in?): ' + (e?.response?.status || e.message))
    }
  }

  return (
    <Card>
      <h3 className="font-semibold mb-2">Add Expense</h3>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3 text-sm">
        <div className="col-span-2">
          <label>Date</label>
          <TextInput type="date" value={f.date} onChange={(e)=>setF({...f, date:e.target.value})} />
        </div>
        <div className="col-span-2">
          <label>Description</label>
          <TextInput value={f.description} onChange={(e)=>setF({...f, description:e.target.value})} placeholder="e.g. Airbnb deposit" />
        </div>
        <div>
          <label>Category</label>
          <select className="w-full px-3 py-2 rounded-md border" value={f.category} onChange={(e)=>setF({...f, category:e.target.value})}>
            <option value="lodging">Lodging</option>
            <option value="food">Food</option>
            <option value="transport">Transport</option>
            <option value="activities">Activities</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label>Paid By</label>
          <PaidByPicker value={f.paid_by} onChange={(val)=>setF({...f, paid_by: val})} />
        </div>

        <div>
          <label>Currency</label>
          <CurrencySelect value={f.currency} onChange={(val)=>setF({...f, currency: val})} />
        </div>
        <div>
          <label className="flex items-center justify-between">
            <span>FX → CAD</span>
            {fxBusy && <span className="text-xs text-gray-500">auto…</span>}
          </label>
          <NumberInput step="0.00000001" value={f.fx_to_cad} onChange={(e)=>setF({...f, fx_to_cad:e.target.value})} />
        </div>
        <div>
          <label>Amount</label>
          <NumberInput value={f.amount} onChange={(e)=>setF({...f, amount:e.target.value})} />
        </div>

        <div className="col-span-2">
          <label>Weights</label>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2">
            <div>
              <label className="text-xs text-gray-500">Household</label>
              <NumberInput value={f.weight_household} onChange={(e)=>setF({...f, weight_household:Number(e.target.value)})} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Bev</label>
              <NumberInput value={f.weight_bev} onChange={(e)=>setF({...f, weight_bev:Number(e.target.value)})} />
            </div>
          </div>
        </div>

        <div className="col-span-2">
          <label>Notes</label>
          <TextInput value={f.notes} onChange={(e)=>setF({...f, notes:e.target.value})} />
        </div>
        <div className="col-span-2"><Button type="submit">Add</Button></div>
      </form>
    </Card>
  )
}

// ---- Add Settlement (unchanged fields; left here, but shown on its own tab) ----
function AddSettlement({ onAdded }) {
  const [people, setPeople] = useState([]);
  const [f, setF] = useState({
    date: new Date().toISOString().slice(0,10),
    from_person_id: "",
    to_person_id: "",
    amount_cad: "",
    notes: "e-Transfer",
  });

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/people/', { credentials: 'include' });
        if (r.ok) setPeople(await r.json());
      } catch {}
    })();
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await addSettlement({
        date: f.date,
        from_person_id: f.from_person_id ? Number(f.from_person_id) : null,
        to_person_id:   f.to_person_id ? Number(f.to_person_id) : null,
        amount_cad: Number(f.amount_cad),
        notes: f.notes,
      });
      setF((x)=>({ ...x, amount_cad:"" }));
      onAdded?.();
    } catch (e) {
      alert('Add failed (are you staff / logged in?): ' + (e?.response?.status || e.message));
    }
  };

  // tiny helper for labeling options like "Chris (Household)"
  const optionLabel = (p) => {
    const party = p.party || {};
    const partyName = party?.name || (party?.is_household ? "Household" : "Bev");
    return `${p.name} (${partyName})`;
  };

  return (
    <Card>
      <h3 className="font-semibold mb-2">Add Settlement</h3>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3 text-sm">
        <div className="col-span-2">
          <label>Date</label>
          <TextInput type="date" value={f.date} onChange={(e)=>setF({...f, date:e.target.value})} />
        </div>

        <div>
          <label>From (Person)</label>
          <select className="w-full px-3 py-2 rounded-md border"
                  value={f.from_person_id}
                  onChange={(e)=>setF({...f, from_person_id: e.target.value})}>
            <option value="">Select…</option>
            {people.map(p => <option key={p.id} value={p.id}>{optionLabel(p)}</option>)}
          </select>
        </div>

        <div>
          <label>To (Person)</label>
          <select className="w-full px-3 py-2 rounded-md border"
                  value={f.to_person_id}
                  onChange={(e)=>setF({...f, to_person_id: e.target.value})}>
            <option value="">Select…</option>
            {people.map(p => <option key={p.id} value={p.id}>{optionLabel(p)}</option>)}
          </select>
        </div>

        <div>
          <label>Amount (CAD)</label>
          <NumberInput value={f.amount_cad} onChange={(e)=>setF({...f, amount_cad:e.target.value})} />
        </div>

        <div className="col-span-2">
          <label>Notes</label>
          <TextInput value={f.notes} onChange={(e)=>setF({...f, notes:e.target.value})} />
        </div>
        <div className="col-span-2">
          <Button type="submit">Add</Button>
        </div>
      </form>
      <div className="text-xs text-gray-500 mt-2">
        Tip: Parties are inferred from the selected people; the record stores party→party.
      </div>
    </Card>
  );
}

// ---- App Root ----
export default function App() {
  const [authed, setAuthed] = useState(document.cookie.includes('sessionid='))
  const [summary, setSummary] = useState(null)
  const [expenses, setExpenses] = useState([])
  const [settlements, setSettlements] = useState([])
  const [tab, setTab] = useState('summary') // 'summary' | 'add-expense' | 'add-settlement'

  useEffect(() => {
    (async () => {
      try {
        await primeCSRF()
        console.log('CSRF cookie primed')
      } catch (err) {
        console.warn('CSRF prime failed:', err)
      }
    })()
  }, [])

  const refreshAll = async () => {
    try {
      const [s, e, st] = await Promise.all([getSummary(), listExpenses(), listSettlements()])
      setSummary(s.data)
      setExpenses(e.data)
      setSettlements(st.data)
    } catch (e) {
      console.warn('Refresh failed (likely not logged in):', e?.response?.status)
    }
  }

  useEffect(() => { if (authed) refreshAll() }, [authed])

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <h1 className="text-2xl font-bold mb-4">Thailand Spend Tracker</h1>
        <LoginPanel onLoggedIn={() => setAuthed(true)} />
        <div className="mt-4 text-sm text-gray-600">Step 1: Sign in with your Django admin user. The app uses session cookies.</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Thailand Spend Tracker</h1>
        <div className="flex items-center gap-2">
          <Button onClick={refreshAll}>Refresh</Button>
          <Button onClick={logout}>Logout</Button>
        </div>
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          {
            value: 'summary',
            label: 'Summary',
            content: (
              <div className="grid gap-4">
                <SummaryCard data={summary} />
                <Card>
                  <h3 className="font-semibold mb-2">Expenses</h3>
                  {expenses?.length ? (
                    <div className="space-y-2">
                      {expenses.map((e)=> (
                        <div key={e.id} className="text-sm border rounded-lg p-3 bg-white">
                          <div className="flex justify-between">
                            <div className="font-medium">{e.description}</div>
                            <div>{new Date(e.date).toISOString().slice(0,10)}</div>
                          </div>
                          <div className="text-gray-600">{e.category} · {e.currency} {e.amount} @ FX {e.fx_to_cad}</div>
                          <div className="text-gray-700">Household {currency(e.share_household_cad)} · Bev {currency(e.share_bev_cad)}</div>
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
          {
            value: 'add-expense',
            label: 'Add Expense',
            content: <AddExpense onAdded={refreshAll} />
          },
          {
            value: 'add-settlement',
            label: 'Add Settlement',
            content: <AddSettlement onAdded={refreshAll} />
          }
        ]}
      />

      <div className="fixed bottom-3 left-0 right-0 px-4">
        <div className="rounded-2xl shadow-md border bg-white p-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">Current Net (Bev → Household)</div>
          <div className={`text-lg font-bold ${Number(summary?.net) >= 0 ? 'text-green-700' : 'text-rose-700'}`}>{currency(summary?.net)}</div>
        </div>
      </div>
    </div>
  )
}
