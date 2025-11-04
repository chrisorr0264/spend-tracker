// src/components/ExpenseForm.jsx
import React, { useEffect, useState } from "react";
import { addExpense, updateExpense, deleteExpense, getExpense } from "../api";
import { NumberInput, TextInput, Button, Card, CurrencySelect, PaidByPicker } from "../sharedControls";

export default function ExpenseForm({
  mode = "create",        // 'create' | 'edit'
  expenseId = null,       // required for edit
  isStaff = false,
  initialDate = new Date().toISOString().slice(0,10),
  onSaved,
  onCancel,
}) {
  const [busy, setBusy] = useState(false);
  const [fxBusy, setFxBusy] = useState(false);
  const [f, setF] = useState({
    date: initialDate,
    description:"", category:"lodging",
    currency:"THB", fx_to_cad:"", amount:"",
    paid_by:"", weight_household:2, weight_bev:1, notes:""
  });

  // load existing on edit
  useEffect(() => {
    if (mode !== "edit" || !expenseId) return;
    (async () => {
      try {
        const { data } = await getExpense(expenseId);
        setF({
          date: data.date,
          description: data.description,
          category: data.category,
          currency: data.currency,
          fx_to_cad: String(data.fx_to_cad),
          amount: String(data.amount),
          paid_by: data.paid_by,
          weight_household: data.weight_household,
          weight_bev: data.weight_bev,
          notes: data.notes || ""
        });
      } catch {
        alert("Failed to load expense for editing");
        onCancel?.();
      }
    })();
  }, [mode, expenseId, onCancel]);

  // auto-FX on date/currency change
  useEffect(() => {
    const run = async () => {
      if (!f.date || !f.currency) return;
      setFxBusy(true);
      try {
        const base = encodeURIComponent(f.currency || "CAD");
        const r = await fetch(`/api/fx-rate/?date=${encodeURIComponent(f.date)}&base=${base}&quote=CAD`, { credentials:"include" });
        if (r.ok) {
          const d = await r.json();
          setF(prev => ({ ...prev, fx_to_cad: d.rate }));
        }
      } catch {} finally { setFxBusy(false); }
    };
    run();
  }, [f.date, f.currency]);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...f,
        paid_by: f.paid_by ? Number(f.paid_by) : null,
        fx_to_cad: Number(f.fx_to_cad || 1),
        amount: Number(f.amount),
        weight_household: Number(f.weight_household),
        weight_bev: Number(f.weight_bev),
      };
      if (mode === "edit" && expenseId) {
        await updateExpense(expenseId, payload, { partial: true });
      } else {
        await addExpense(payload);
      }
      onSaved?.();
    } catch (e) {
      const msg = e?.response?.data ? JSON.stringify(e.response.data) : (e.message || "Save failed");
      alert(msg);
    } finally { setBusy(false); }
  };

  return (
    <Card>
      <h3 className="font-semibold mb-2">{mode === "edit" ? "Edit Expense" : "Add Expense"}</h3>

      <form onSubmit={submit} className="grid grid-cols-2 gap-3 text-sm">
        <div className="col-span-2">
          <label>Date</label>
          <TextInput type="date" value={f.date} onChange={e=>setF({...f, date:e.target.value})} />
        </div>

        <div className="col-span-2">
          <label>Description</label>
          <TextInput value={f.description} onChange={e=>setF({...f, description:e.target.value})} />
        </div>

        <div>
          <label>Category</label>
          <select className="w-full px-3 py-2 rounded-md border" value={f.category} onChange={e=>setF({...f, category:e.target.value})}>
            <option value="lodging">Lodging</option>
            <option value="food">Food</option>
            <option value="transport">Transport</option>
            <option value="activities">Activities</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label>Paid By</label>
          <PaidByPicker value={f.paid_by} onChange={val=>setF({...f, paid_by: val})} />
        </div>

        <div>
          <label>Currency</label>
          <CurrencySelect value={f.currency} onChange={val=>setF({...f, currency: val})} canWrite={isStaff} />
        </div>
        <div>
          <label className="flex items-center justify-between">
            <span>FX → CAD</span>
            {fxBusy && <span className="text-xs text-gray-500">auto…</span>}
          </label>
          <NumberInput step="0.00000001" value={f.fx_to_cad} onChange={e=>setF({...f, fx_to_cad:e.target.value})} />
        </div>

        <div>
          <label>Amount</label>
          <NumberInput value={f.amount} onChange={e=>setF({...f, amount:e.target.value})} />
        </div>

        <div className="col-span-2">
          <label>Weights</label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">Household</label>
              <NumberInput value={f.weight_household} onChange={e=>setF({...f, weight_household:Number(e.target.value)})} />
            </div>
            <div>
              <label className="text-xs text-gray-500">Bev</label>
              <NumberInput value={f.weight_bev} onChange={e=>setF({...f, weight_bev:Number(e.target.value)})} />
            </div>
          </div>
        </div>

        <div className="col-span-2">
          <label>Notes</label>
          <TextInput value={f.notes} onChange={e=>setF({...f, notes:e.target.value})} />
        </div>

        <div className="col-span-2 flex gap-2">
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
          {onCancel && <Button type="button" onClick={onCancel}>Cancel</Button>}
          {mode === "edit" && (
            <Button
              type="button"
              className="ml-auto border-rose-300 text-rose-700"
              onClick={async () => {
                if (!confirm("Delete this expense?")) return;
                try {
                  setBusy(true);
                  await deleteExpense(expenseId);
                  onSaved?.();
                } catch { alert("Delete failed"); }
                finally { setBusy(false); }
              }}
            >
              Delete
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
