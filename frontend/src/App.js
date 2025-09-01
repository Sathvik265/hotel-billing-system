import React, { useEffect, useMemo, useState } from "react";
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
import { Printer, LockKeyhole, ChefHat, ListOrdered, FileText } from "lucide-react";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL; // do not hardcode
const API = `${BACKEND_URL}/api`;

function useAdminMode() {
  const [mode, setMode] = useState("clerk"); // clerk | admin-limited | admin-full
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
      toast.error(e?.response?.data?.detail || "Login failed");
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
          <Input placeholder="e.g., SHI" className="col-span-2" value={staffCode} onChange={e => setStaffCode(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 items-center gap-3">
          <Label className="text-sm">Password (admin)</Label>
          <Input type="password" placeholder="leave blank for clerk" className="col-span-2" value={password} onChange={e => setPassword(e.target.value)} />
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

function Billing() {
  const [tableNo, setTableNo] = useState("");
  const [partyNo, setPartyNo] = useState("");
  const [waiterNo, setWaiterNo] = useState("");
  const [section, setSection] = useState("G"); // AC or G
  const [billNumber, setBillNumber] = useState("");

  const [entryCode, setEntryCode] = useState("");
  const [qty, setQty] = useState(1);
  const [lines, setLines] = useState([]);

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
        header: { table_no: tableNo, party_no: partyNo, waiter_no: waiterNo, section, bill_number: billNumber || null },
        item_codes: lines.map(l => l.code),
        quantities: lines.map(l => l.quantity)
      };
      const res = await axios.post(`${API}/bill`, payload);
      toast.success("Bill created");
      // Persist print data for reliability across print dialogs
      window.printBillData = res.data; // attach to window for print template
      window.__lastBill__ = res.data;
      try { localStorage.setItem("lastBill", JSON.stringify(res.data)); } catch {}
      // Open print preview after small delay to ensure DOM render
      setTimeout(() => window.print(), 200);
      // reset form but keep print data available
      setLines([]); setBillNumber("");
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to create bill");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText size={18}/> Billing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-6 gap-3">
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
            <div className="col-span-2">
              <Label>Bill No (optional)</Label>
              <Input placeholder="auto if empty" value={billNumber} onChange={e => setBillNumber(e.target.value)} />
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
              <Button variant="secondary" onClick={() => setLines([])}>Clear</Button>
            </div>
          </div>

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
        <BillPrint />
      </div>
    </div>
  );
}

function BillPrint() {
  const data = window.printBillData;
  if (!data) return null;
  return (
    <div className="p-6 text-black text-sm w-[580px]">
      <div className="text-center font-bold text-lg">{data.hotel_name}</div>
      <div className="text-center">GST Included</div>
      <Separator className="my-2" />
      <div className="flex justify-between text-xs">
        <div>Bill No: {data.header.bill_number}</div>
        <div>Date: {new Date(data.created_at).toLocaleString()}</div>
      </div>
      <div className="flex justify-between text-xs">
        <div>Table: {data.header.table_no}</div>
        <div>Waiter: {data.header.waiter_no}</div>
      </div>
      <Separator className="my-2" />
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
      <Separator className="my-2" />
      <div className="flex justify-between"><div>Subtotal</div><div>₹ {data.subtotal.toFixed(2)}</div></div>
      <div className="flex justify-between"><div>Tax (5%)</div><div>₹ {data.tax_amount.toFixed(2)}</div></div>
      <div className="flex justify-between font-semibold"><div>Total</div><div>₹ {data.grand_total.toFixed(2)}</div></div>
      <div className="text-center mt-3">Thank you! Visit again</div>
    </div>
  );
}

function AdminPanel({ mode }) {
  const isAdmin = mode === "admin-limited" || mode === "admin-full";
  if (!isAdmin) return null;
  const entries = ["pending", "update", "rectify", "reindex", "create", "report"];
  return (
    <Card className="bg-white/80 backdrop-blur">
      <CardHeader>
        <CardTitle>Admin Actions ({mode})</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-neutral-600 mb-2">Select an action to proceed. Functionality will be added next.</p>
        <ul className="list-disc ml-5">
          {entries.map(e => <li key={e}>{e}</li>)}
        </ul>
      </CardContent>
    </Card>
  );
}

function App() {
  const { mode, setMode } = useAdminMode();
  const isAdmin = mode === "admin-limited" || mode === "admin-full";

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 text-neutral-800">
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Udupi Anand Bhavan — Billing System</h1>
          <p className="text-sm text-neutral-600">Charminar, Hyderabad</p>
        </div>

        <div className="mb-6">
          <LoginPanel onMode={setMode} />
        </div>

        <Tabs defaultValue="billing" className="">
          <TabsList className="bg-white/70 backdrop-blur border">
            <TabsTrigger value="billing" className="gap-1"><FileText size={14}/> Billing</TabsTrigger>
            <TabsTrigger value="menu" className="gap-1"><ListOrdered size={14}/> Food Menu</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="gap-1"><LockKeyhole size={14}/> Admin</TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="billing" className="mt-4">
            <Billing />
          </TabsContent>
          <TabsContent value="menu" className="mt-4">
            <FoodMenu />
          </TabsContent>
          {isAdmin && (
            <TabsContent value="admin" className="mt-4">
              <AdminPanel mode={mode} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

export default App;