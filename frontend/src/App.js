import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import "./App.css";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Label } from "./components/ui/label";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { Separator } from "./components/ui/separator";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "./components/ui/table";
import { Textarea } from "./components/ui/textarea";
import { Printer, LockKeyhole, ChefHat, ListOrdered, FileText, Save, Trash2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL; // do not hardcode
const API = `${BACKEND_URL}/api`;

function useAdminMode() {
  const [mode, setMode] = useState("none"); // none until login; then clerk | admin-limited | admin-full
  return { mode, setMode };
}

function LoginPanel({ onMode }) {
  const [staffCode, setStaffCode] = useState("");
  const [password, setPassword] = useState("");

  const submit = async () => {
    try {
      const res = await axios.post(`${API}/auth/login`, { staff_code: staffCode, password });
      onMode(res.data.mode);
      if (res.data.mode.includes("admin")) {
        toast.success("Admin mode unlocked");
      } else {
        toast.success("Clerk mode");
      }
    } catch (e) {
      onMode("none");
      toast.error(e?.response?.data?.detail || "Invalid login");
    }
  };

  return (
    <Card className="shadow-xl border-0 bg-white/70 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2"><LockKeyhole size={18} /> Staff Access</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 items-center gap-3">
          <Label className="text-sm">3-letter ID</Label>
          <Input placeholder="e.g., SHI or CLK" className="col-span-2" value={staffCode} onChange={e => setStaffCode(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 items-center gap-3">
          <Label className="text-sm">Password</Label>
          <Input type="password" placeholder="required for admin" className="col-span-2" value={password} onChange={e => setPassword(e.target.value)} />
        </div>
        <div className="flex justify-end">
          <Button onClick={submit} className="px-5">Enter</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FoodMenu() {
  const [items, setItems] = useState([]);
  const load = async () => {
    try {
      const res = await axios.get(`${API}/menu`);
      setItems(res.data);
    } catch (e) {
      toast.error("Failed to load menu");
    }
  };
  useEffect(() => { load(); }, []);

  return (
    <Card className="shadow-md bg-white/80 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ChefHat size={18}/> Food Menu</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Alpha</TableHead>
              <TableHead>Numeric</TableHead>
              <TableHead>Fixed</TableHead>
              <TableHead>General</TableHead>
              <TableHead>AC</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow key={it.id}>
                <TableCell>{it.name}</TableCell>
                <TableCell>{it.alpha_code}</TableCell>
                <TableCell>{it.numeric_code}</TableCell>
                <TableCell>₹ {it.price_fixed}</TableCell>
                <TableCell>₹ {it.price_general}</TableCell>
                <TableCell>₹ {it.price_ac}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Billing({ settings }) {
  const [tableNo, setTableNo] = useState("");
  const [partyNo, setPartyNo] = useState("1"); // default to 1
  const [waiterNo, setWaiterNo] = useState("");
  const [section, setSection] = useState("G"); // AC or G

  const [entryCode, setEntryCode] = useState("");
  const [qty, setQty] = useState(1);
  const [lines, setLines] = useState([]);

  const [preview, setPreview] = useState(null);
  const debounceRef = useRef();

  useEffect(() => {
    if (!entryCode || entryCode.trim().length < 2) { setPreview(null); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await axios.get(`${API}/menu/lookup/${entryCode}`);
        setPreview(res.data);
      } catch {
        setPreview(null);
      }
    }, 250);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [entryCode]);

  const addItem = async () => {
    if (!entryCode) return;
    try {
      const res = await axios.get(`${API}/menu/lookup/${entryCode}`);
      const item = res.data;
      const unit = section === 'AC' ? item.price_ac : item.price_general;
      const newLine = { code: entryCode.toUpperCase(), name: item.name, quantity: qty, unit_price: unit, line_total: +(unit * qty).toFixed(2) };
      setLines(prev => [...prev, newLine]);
      setEntryCode("");
      setQty(1);
      setPreview(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Item not found");
    }
  };

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.line_total, 0), [lines]);
  const tax = useMemo(() => +(subtotal * 0.05).toFixed(2), [subtotal]);
  const total = useMemo(() => +(subtotal + tax).toFixed(2), [subtotal, tax]);

  const createBill = async () => {
    if (!tableNo || !partyNo || !waiterNo || !section) {
      toast.error("Enter table, party, waiter and section");
      return;
    }
    if (lines.length === 0) {
      toast.error("Add at least one item");
      return;
    }
    try {
      const payload = {
        header: { table_no: tableNo, party_no: partyNo, waiter_no: waiterNo, section },
        item_codes: lines.map(l => l.code),
        quantities: lines.map(l => l.quantity)
      };
      const res = await axios.post(`${API}/bill`, payload);
      toast.success("Bill created");
      // Persist print data and settings
      window.printBillData = { ...res.data, settings };
      window.__lastBill__ = res.data;
      try { localStorage.setItem("lastBill", JSON.stringify(res.data)); } catch {}
      try { localStorage.setItem("settings", JSON.stringify(settings || {})); } catch {}
      setTimeout(() => window.print(), 200);
      setLines([]);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to create bill");
    }
  };

  const effectiveRate = preview ? (section === 'AC' ? preview.price_ac : preview.price_general) : null;

  return (
    <div className="space-y-4">
      <Card className="bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText size={18}/> Billing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-1">
              <Label>Table No</Label>
              <Input value={tableNo} onChange={e => setTableNo(e.target.value)} />
            </div>
            <div className="col-span-1">
              <Label>Party No</Label>
              <Input value={partyNo} onChange={e => setPartyNo(e.target.value)} />
            </div>
            <div className="col-span-1">
              <Label>Waiter No</Label>
              <Input value={waiterNo} onChange={e => setWaiterNo(e.target.value)} />
            </div>
            <div className="col-span-1">
              <Label>Section (AC/G)</Label>
              <Input value={section} onChange={e => setSection(e.target.value.toUpperCase().startsWith('A') ? 'AC' : 'G')} />
            </div>
          </div>

          <Separator className="my-3" />

          <div className="grid grid-cols-6 gap-3 items-end">
            <div className="col-span-3">
              <Label>Item Code (alpha or numeric)</Label>
              <Input placeholder="e.g., IDL or 101" value={entryCode} onChange={e => setEntryCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addItem(); }} />
            </div>
            <div className="col-span-1">
              <Label>Qty</Label>
              <Input type="number" min={1} value={qty} onChange={e => setQty(parseInt(e.target.value || '1', 10))} />
            </div>
            <div className="col-span-2 flex gap-2">
              <Button onClick={addItem}>Add</Button>
              <Button variant="secondary" onClick={() => { setLines([]); setPreview(null); }}>Clear</Button>
            </div>
          </div>

          {preview && (
            <div className="rounded-md border bg-amber-50 px-4 py-2 text-sm">
              <div className="flex justify-between">
                <div className="font-medium">{preview.name} ({preview.alpha_code}/{preview.numeric_code})</div>
                <div>Rate now: ₹ {effectiveRate}</div>
              </div>
              <div className="mt-1 grid grid-cols-3 gap-2">
                <div>Fixed: ₹ {preview.price_fixed}</div>
                <div>General: ₹ {preview.price_general}</div>
                <div>AC: ₹ {preview.price_ac}</div>
              </div>
            </div>
          )}

          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l, idx) => (
                <TableRow key={idx}>
                  <TableCell>{l.code}</TableCell>
                  <TableCell>{l.name}</TableCell>
                  <TableCell className="text-right">{l.quantity}</TableCell>
                  <TableCell className="text-right">₹ {l.unit_price}</TableCell>
                  <TableCell className="text-right">₹ {l.line_total.toFixed(2)}</TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={4} className="text-right font-medium">Subtotal</TableCell>
                <TableCell className="text-right">₹ {subtotal.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4} className="text-right font-medium">Tax 5%</TableCell>
                <TableCell className="text-right">₹ {tax.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={4} className="text-right font-semibold">Grand Total</TableCell>
                <TableCell className="text-right font-semibold">₹ {total.toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>

          <div className="flex justify-end gap-2 mt-3">
            <Button onClick={createBill} className="gap-2"><Printer size={16}/> Print Bill</Button>
          </div>
        </CardContent>
      </Card>

      {/* Print styles */}
      <div className="print-area hidden print:block">
        <BillPrint settings={settings} />
      </div>
    </div>
  );
}

function BillPrint({ settings }) {
  const data = (typeof window !== 'undefined' && window.printBillData) || null;
  const cfg = settings || (typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('settings') || '{}') : {});
  if (!data) return null;
  return (
    <div className="print-receipt">
      <div className="text-center font-bold text-base">{data.hotel_name}</div>
      {cfg?.address ? <div className="text-center text-xs">{cfg.address}</div> : null}
      <div className="text-center text-xs">GST Included{cfg?.gstin ? ` • GSTIN: ${cfg.gstin}` : ''}{cfg?.phone ? ` • Ph: ${cfg.phone}` : ''}</div>
      <div className="divider" />
      <div className="row"><span>Bill No</span><span>{data.header.bill_number}</span></div>
      <div className="row"><span>Date</span><span>{new Date(data.created_at).toLocaleString()}</span></div>
      <div className="row"><span>Table</span><span>{data.header.table_no}</span></div>
      <div className="row"><span>Waiter</span><span>{data.header.waiter_no}</span></div>
      <div className="row"><span>Section</span><span>{data.header.section}</span></div>
      <div className="divider" />
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="text-left">Item</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Rate</th>
            <th className="text-right">Amt</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((it, i) => (
            <tr key={i}>
              <td>{it.name}</td>
              <td className="text-right">{it.quantity}</td>
              <td className="text-right">{it.unit_price}</td>
              <td className="text-right">{it.line_total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="divider" />
      <div className="row"><span>Subtotal</span><span>₹ {data.subtotal.toFixed(2)}</span></div>
      <div className="row"><span>Tax (5%)</span><span>₹ {data.tax_amount.toFixed(2)}</span></div>
      <div className="row total"><span>Total</span><span>₹ {data.grand_total.toFixed(2)}</span></div>
      <div className="center mt-2 text-xs">Thank you! Visit again</div>
    </div>
  );
}

function SettingsEditor({ settings, onChange, canEdit }) {
  const [form, setForm] = useState(settings || {});
  useEffect(() => setForm(settings || {}), [settings]);

  const save = async () => {
    try {
      const res = await axios.put(`${API}/settings`, form);
      onChange && onChange(res.data);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to save settings");
    }
  };

  if (!canEdit) return null;
  return (
    <Card className="bg-white/80 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Save size={16}/> Receipt Settings (Admin Full)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Hotel Name</Label>
            <Input value={form.hotel_name || ''} onChange={e => setForm({ ...form, hotel_name: e.target.value })} />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>GSTIN</Label>
            <Input value={form.gstin || ''} onChange={e => setForm({ ...form, gstin: e.target.value })} />
          </div>
          <div>
            <Label>Address</Label>
            <Textarea rows={2} value={form.address || ''} onChange={e => setForm({ ...form, address: e.target.value })} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={save} className="gap-2"><Save size={14}/> Save</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CredentialsManager() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ staff_code: "", role: "clerk", password: "", password_l1: "", password_root: "", active: true });

  const load = async () => {
    try { const res = await axios.get(`${API}/credentials`); setRows(res.data); } catch {}
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    try {
      const payload = { ...form, staff_code: (form.staff_code || '').toUpperCase() };
      const res = await axios.post(`${API}/credentials`, payload);
      toast.success("Credential added");
      setForm({ staff_code: "", role: "clerk", password: "", password_l1: "", password_root: "", active: true });
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed to add"); }
  };
  const del = async (id) => { try { await axios.delete(`${API}/credentials/${id}`); toast.success("Deleted"); load(); } catch {} };
  const toggleActive = async (id, active) => { try { await axios.put(`${API}/credentials/${id}`, { active: !active }); load(); } catch {} };
  const editRow = async (r) => {
    try {
      const newRole = window.prompt("Role (clerk/admin)", r.role) || r.role;
      let payload = { role: newRole };
      if (newRole === 'admin') {
        const l1 = window.prompt("Admin L1 password (blank to keep)", "");
        const root = window.prompt("Admin ROOT password (blank to keep)", "");
        if (l1 !== null && l1 !== '') payload.password_l1 = l1;
        if (root !== null && root !== '') payload.password_root = root;
      } else {
        const pw = window.prompt("Clerk password (blank to clear)", r.password || "");
        if (pw !== null) payload.password = pw; // allow empty to clear
      }
      await axios.put(`${API}/credentials/${r.id}`, payload);
      toast.success("Updated");
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed to update"); }
  };

  return (
    <Card className="bg-white/80 backdrop-blur">
      <CardHeader>
        <CardTitle>Credentials</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-6 gap-2 items-end">
          <div className="col-span-1">
            <Label>Code</Label>
            <Input value={form.staff_code} onChange={e => setForm({ ...form, staff_code: e.target.value })} placeholder="3 letters" />
          </div>
          <div className="col-span-1">
            <Label>Role</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="clerk">clerk</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.role === 'clerk' ? (
            <div className="col-span-2">
              <Label>Clerk Password (optional)</Label>
              <Input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
            </div>
          ) : (
            <>
              <div className="col-span-2">
                <Label>Admin L1 Password</Label>
                <Input value={form.password_l1} onChange={e => setForm({ ...form, password_l1: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Admin Root Password</Label>
                <Input value={form.password_root} onChange={e => setForm({ ...form, password_root: e.target.value })} />
              </div>
            </>
          )}
          <div className="col-span-1 flex justify-end">
            <Button onClick={add}>Add</Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.staff_code}</TableCell>
                <TableCell>{r.role}</TableCell>
                <TableCell>{r.active ? 'active' : 'inactive'}</TableCell>
                <TableCell className="text-right flex gap-2 justify-end">
                  <Button variant="secondary" onClick={() => toggleActive(r.id, r.active)}>{r.active ? 'Disable' : 'Enable'}</Button>
                  <Button variant="destructive" onClick={() => del(r.id)} className="gap-1"><Trash2 size={14}/> Delete</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AdminPanel({ mode, settings, onSettings }) {
  const isAdmin = mode === "admin-limited" || mode === "admin-full";
  if (!isAdmin) return null;
  const entries = ["pending", "update", "rectify", "reindex", "create", "report"];
  return (
    <div className="space-y-4">
      <Card className="bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle>Admin Actions ({mode})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc ml-5">
            {entries.map(e => <li key={e}>{e}</li>)}
          </ul>
        </CardContent>
      </Card>
      {mode === 'admin-full' && (
        <>
          <SettingsEditor settings={settings} onChange={onSettings} canEdit={true} />
          <CredentialsManager />
        </>
      )}
    </div>
  );
}

function App() {
  const { mode, setMode } = useAdminMode();
  const isAdmin = mode === "admin-limited" || mode === "admin-full";
  const [settings, setSettings] = useState(null);

  const loadSettings = async () => {
    try {
      const res = await axios.get(`${API}/settings`);
      setSettings(res.data);
      if (typeof window !== 'undefined') {
        window.__settings__ = res.data;
        try { localStorage.setItem('settings', JSON.stringify(res.data)); } catch {}
      }
    } catch (e) {
      // ignore for MVP
    }
  };

  useEffect(() => { loadSettings(); }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 text-neutral-800">
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Udupi Anand Bhavan — Billing System</h1>
          <p className="text-sm text-neutral-600">Charminar, Hyderabad</p>
        </div>

        {/* Gate: show only login until authenticated */}
        {mode === 'none' ? (
          <div className="max-w-3xl"><LoginPanel onMode={setMode} /></div>
        ) : (
          <>
            <Tabs defaultValue="billing" className="">
              <TabsList className="bg-white/70 backdrop-blur border">
                <TabsTrigger value="billing" className="gap-1"><FileText size={14}/> Billing</TabsTrigger>
                <TabsTrigger value="menu" className="gap-1"><ListOrdered size={14}/> Food Menu</TabsTrigger>
                {isAdmin && (
                  <TabsTrigger value="admin" className="gap-1"><LockKeyhole size={14}/> Admin</TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="billing" className="mt-4">
                <Billing settings={settings} />
              </TabsContent>
              <TabsContent value="menu" className="mt-4">
                <FoodMenu />
              </TabsContent>
              {isAdmin && (
                <TabsContent value="admin" className="mt-4">
                  <AdminPanel mode={mode} settings={settings} onSettings={(s) => { setSettings(s); if (typeof window !== 'undefined') window.__settings__ = s; }} />
                </TabsContent>
              )}
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}

export default App;