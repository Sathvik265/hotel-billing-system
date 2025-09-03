import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./components/ui/tabs";
import { Input } from "./components/ui/input";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Label } from "./components/ui/label";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { Separator } from "./components/ui/separator";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "./components/ui/table";
import { Textarea } from "./components/ui/textarea";
import {
  Printer,
  LockKeyhole,
  ChefHat,
  ListOrdered,
  FileText,
  Save,
  Trash2,
  Minus,
  Plus,
  History,
  Edit,
} from "lucide-react";

// Hardcoded the backend URL to resolve the 'process is not defined' error.
const BACKEND_URL = "http://127.0.0.1:8000";
const API = `${BACKEND_URL}/api`;

function useAdminMode() {
  const [mode, setMode] = useState("none");
  return { mode, setMode };
}

function LoginPanel({ onMode }) {
  const [credential, setCredential] = useState("");

  const handleKeyDown = (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submit(event.shiftKey);
    }
  };

  const submit = async (isRoot = false) => {
    try {
      const res = await axios.post(`${API}/auth/login`, {
        staff_code: credential,
        is_root: isRoot,
      });
      onMode(res.data.mode);
      toast.success(
        res.data.mode.includes("admin")
          ? `Logged in as ${res.data.mode}`
          : "Clerk mode"
      );
    } catch (e) {
      onMode("none");
      toast.error(e?.response?.data?.detail || "Invalid login");
    }
  };

  return (
    <Card className="shadow-xl border-0 bg-white/70 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          <LockKeyhole size={18} /> Staff Access
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 items-center gap-3">
          <Label className="text-sm">Credential</Label>
          <Input
            placeholder="Enter credential"
            className="col-span-2"
            value={credential}
            onChange={(e) => setCredential(e.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={() => submit(false)} className="px-5">
            Enter
          </Button>
        </div>
        <div className="text-xs text-gray-500">
          <p>
            Hint: Use 'CLK' for clerk, 'SHI' for admin, or 'SHI' + Shift+Enter
            for root admin.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function DateSelection({ onDateSelected }) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const handleProceed = () => {
    if (date) {
      onDateSelected(date);
    } else {
      toast.error("Please select a date.");
    }
  };

  return (
    <Card className="shadow-xl border-0 bg-white/70 backdrop-blur-xl">
      <CardHeader>
        <CardTitle className="text-xl flex items-center gap-2">
          Select Billing Date
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 items-center gap-3">
          <Label className="text-sm">Date</Label>
          <Input
            type="date"
            className="col-span-2"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={handleProceed} className="px-5">
            Proceed
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FoodMenu({ mode }) {
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({
    name: "",
    alpha_code: "",
    numeric_code: "",
    price_fixed: "",
    price_general: "",
    price_ac: "",
  });

  const load = async () => {
    try {
      const res = await axios.get(`${API}/menu`);
      setItems(res.data);
    } catch (e) {
      toast.error("Failed to load menu");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleNewItemChange = (e) => {
    const { name, value } = e.target;
    setNewItem((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddItem = async () => {
    try {
      await axios.post(`${API}/menu`, newItem);
      toast.success("Item added successfully");
      setNewItem({
        name: "",
        alpha_code: "",
        numeric_code: "",
        price_fixed: "",
        price_general: "",
        price_ac: "",
      });
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to add item");
    }
  };

  const handleDeleteItem = async (itemId) => {
    try {
      await axios.delete(`${API}/menu/${itemId}`);
      toast.success("Item deleted successfully");
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to delete item");
    }
  };

  return (
    <Card className="shadow-md bg-white/80 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ChefHat size={18} /> Food Menu
        </CardTitle>
      </CardHeader>
      <CardContent>
        {mode === "admin-full" && (
          <div className="grid grid-cols-7 gap-2 mb-4 items-end">
            <Input
              name="name"
              placeholder="Name"
              value={newItem.name}
              onChange={handleNewItemChange}
            />
            <Input
              name="alpha_code"
              placeholder="Alpha"
              value={newItem.alpha_code}
              onChange={handleNewItemChange}
            />
            <Input
              name="numeric_code"
              placeholder="Numeric"
              value={newItem.numeric_code}
              onChange={handleNewItemChange}
            />
            <Input
              name="price_fixed"
              placeholder="Fixed"
              value={newItem.price_fixed}
              onChange={handleNewItemChange}
            />
            <Input
              name="price_general"
              placeholder="General"
              value={newItem.price_general}
              onChange={handleNewItemChange}
            />
            <Input
              name="price_ac"
              placeholder="AC"
              value={newItem.price_ac}
              onChange={handleNewItemChange}
            />
            <Button onClick={handleAddItem}>Add Item</Button>
          </div>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Alpha</TableHead>
              <TableHead>Numeric</TableHead>
              <TableHead>Fixed</TableHead>
              <TableHead>General</TableHead>
              <TableHead>AC</TableHead>
              {mode === "admin-full" && <TableHead>Actions</TableHead>}
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
                {mode === "admin-full" && (
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteItem(it.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function Billing({
  drafts,
  setDrafts,
  currentTable,
  setCurrentTable,
  billingDate,
}) {
  const [entryCode, setEntryCode] = useState("");
  const [qty, setQty] = useState(1);
  const [preview, setPreview] = useState(null);
  const debounceRef = useRef();
  const tableNoRef = useRef(null);

  const currentDraft = useMemo(
    () =>
      drafts[currentTable] || {
        header: { table_no: currentTable, party_no: "1", section: "G" },
        lines: [],
        modified_from_bill_id: null,
      },
    [drafts, currentTable]
  );

  const onHeaderChange = (patch) => {
    const newHeader = { ...currentDraft.header, ...patch };
    if (patch.table_no !== undefined) {
      newHeader.bill_number = patch.table_no;
    }
    const newDraft = { ...currentDraft, header: newHeader };
    setDrafts((prev) => ({ ...prev, [currentTable]: newDraft }));
  };

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === "Escape") {
        tableNoRef.current.focus();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);

  const loadDataForTable = async (tableNo) => {
    if (!tableNo) return;
    if (drafts[tableNo]) return;
    try {
      const res = await axios.get(`${API}/bill/last`, {
        params: { table_no: tableNo, bill_date: billingDate },
      });
      const lastBill = res.data;
      setDrafts((prev) => ({
        ...prev,
        [tableNo]: {
          header: lastBill.header,
          lines: lastBill.items,
          modified_from_bill_id: lastBill.id,
        },
      }));
      toast.success(`Loaded last bill for table ${tableNo}`);
    } catch (e) {
      setDrafts((prev) => ({
        ...prev,
        [tableNo]: {
          header: {
            table_no: tableNo,
            party_no: "1",
            section: "G",
            bill_number: tableNo,
          },
          lines: [],
        },
      }));
    }
  };

  const handleTableNoKeyDown = (event) => {
    if (event.key === "Enter") {
      const newTableNo = event.target.value;
      setCurrentTable(newTableNo);
      loadDataForTable(newTableNo);
    }
  };

  useEffect(() => {
    if (!entryCode || entryCode.trim().length < 2) {
      setPreview(null);
      return;
    }
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
    if (!entryCode || !currentTable) return;
    try {
      const res = await axios.get(`${API}/menu/lookup/${entryCode}`);
      const item = res.data;
      const unit =
        currentDraft.header.section === "AC"
          ? item.price_ac
          : item.price_general;
      const newLine = {
        code: entryCode.toUpperCase(),
        name: item.name,
        quantity: qty,
        unit_price: unit,
        line_total: +(unit * qty).toFixed(2),
      };
      const updatedLines = [...currentDraft.lines, newLine];
      setDrafts((prev) => ({
        ...prev,
        [currentTable]: { ...currentDraft, lines: updatedLines },
      }));
      setEntryCode("");
      setQty(1);
      setPreview(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Item not found");
    }
  };

  const updateQty = (index, newQty) => {
    if (newQty <= 0) {
      removeLine(index);
      return;
    }
    const updatedLines = currentDraft.lines.map((l, i) => {
      if (i !== index) return l;
      return {
        ...l,
        quantity: newQty,
        line_total: +(l.unit_price * newQty).toFixed(2),
      };
    });
    setDrafts((prev) => ({
      ...prev,
      [currentTable]: { ...currentDraft, lines: updatedLines },
    }));
  };

  const removeLine = (index) => {
    const updatedLines = currentDraft.lines.filter((_, i) => i !== index);
    setDrafts((prev) => ({
      ...prev,
      [currentTable]: { ...currentDraft, lines: updatedLines },
    }));
  };

  const subtotal = useMemo(
    () => currentDraft.lines.reduce((s, l) => s + l.line_total, 0),
    [currentDraft.lines]
  );
  const tax = useMemo(() => +(subtotal * 0.05).toFixed(2), [subtotal]);
  const total = useMemo(() => +(subtotal + tax).toFixed(2), [subtotal, tax]);

  const createBill = async () => {
    const h = currentDraft.header;
    if (!h.table_no || !h.party_no || !h.section) {
      return toast.error("Enter table, party, and section");
    }
    if (currentDraft.lines.length === 0) {
      return toast.error("Add at least one item");
    }
    try {
      const payload = {
        header: { ...h, bill_number: h.bill_number || h.table_no },
        item_codes: currentDraft.lines.map((l) => l.code),
        quantities: currentDraft.lines.map((l) => l.quantity),
        bill_date: billingDate,
        modified_from_bill_id: currentDraft.modified_from_bill_id,
      };
      const res = await axios.post(`${API}/bill`, payload);
      toast.success("Bill created");
      window.printBillData = res.data;

      setDrafts((prev) => {
        const newDrafts = { ...prev };
        delete newDrafts[currentTable];
        return newDrafts;
      });
      setCurrentTable("");

      setTimeout(() => {
        window.print();
        tableNoRef.current.focus();
      }, 200);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Failed to create bill");
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText size={18} /> Billing for {billingDate}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-1">
              <Label>Table No</Label>
              <Input
                ref={tableNoRef}
                placeholder="Type & Enter"
                value={currentTable}
                onChange={(e) => setCurrentTable(e.target.value)}
                onKeyDown={handleTableNoKeyDown}
              />
            </div>
            <div className="col-span-1">
              <Label>Party No</Label>
              <Input
                value={currentDraft.header.party_no || ""}
                onChange={(e) => onHeaderChange({ party_no: e.target.value })}
              />
            </div>
            <div className="col-span-1">
              <Label>Section</Label>
              <Input
                list="sections"
                value={currentDraft.header.section || "G"}
                onChange={(e) =>
                  onHeaderChange({ section: e.target.value.toUpperCase() })
                }
              />
              <datalist id="sections">
                <option value="G" />
                <option value="AC" />
              </datalist>
            </div>
            <div className="col-span-2">
              <Label>Bill No (system)</Label>
              <Input value={currentDraft.header.bill_number || ""} readOnly />
            </div>
          </div>
          <Separator className="my-3" />
          <div className="grid grid-cols-6 gap-3 items-end">
            <div className="col-span-3">
              <Label>Item Code</Label>
              <Input
                placeholder="e.g., IDL or 101"
                value={entryCode}
                onChange={(e) => setEntryCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addItem();
                }}
              />
            </div>
            <div className="col-span-1">
              <Label>Qty</Label>
              <Input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(parseInt(e.target.value || "1", 10))}
              />
            </div>
            <div className="col-span-2 flex gap-2">
              <Button onClick={addItem} disabled={!currentTable}>
                Add
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (currentTable)
                    setDrafts((prev) => ({
                      ...prev,
                      [currentTable]: { ...currentDraft, lines: [] },
                    }));
                }}
              >
                Clear Items
              </Button>
            </div>
          </div>
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="text-right w-48">Qty</TableHead>
                <TableHead className="text-right">Rate</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currentDraft.lines.map((l, idx) => (
                <TableRow key={idx}>
                  <TableCell>{l.name}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQty(idx, l.quantity - 1)}
                      >
                        <Minus size={14} />
                      </Button>
                      <span className="w-8 text-center">{l.quantity}</span>
                      <Button
                        size="sm"
                        onClick={() => updateQty(idx, l.quantity + 1)}
                      >
                        <Plus size={14} />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    ₹ {l.unit_price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    ₹ {l.line_total.toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">
                  Subtotal
                </TableCell>
                <TableCell className="text-right">
                  ₹ {subtotal.toFixed(2)}
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-medium">
                  Tax 5%
                </TableCell>
                <TableCell className="text-right">₹ {tax.toFixed(2)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell colSpan={3} className="text-right font-semibold">
                  Grand Total
                </TableCell>
                <TableCell className="text-right font-semibold">
                  ₹ {total.toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className="flex justify-end gap-2 mt-3">
            <Button
              onClick={createBill}
              className="gap-2"
              disabled={!currentTable}
            >
              <Printer size={16} /> Print Bill
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="print-area hidden print:block">
        <BillPrint />
      </div>
    </div>
  );
}

function RecentBills({ billingDate, onModifyBill }) {
  const [bills, setBills] = useState([]);

  const loadRecentBills = async () => {
    try {
      const res = await axios.get(`${API}/bills/by_date`, {
        params: { bill_date: billingDate },
      });
      setBills(res.data);
    } catch (e) {
      toast.error("Failed to load recent bills.");
    }
  };

  useEffect(() => {
    if (billingDate) {
      loadRecentBills();
    }
  }, [billingDate]);

  return (
    <Card className="shadow-md bg-white/80 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History size={18} /> Recent Bills for {billingDate}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill No</TableHead>
              <TableHead>Table</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bills.map((bill) => (
              <TableRow key={bill.id}>
                <TableCell>{bill.header.bill_number}</TableCell>
                <TableCell>{bill.header.table_no}</TableCell>
                <TableCell>
                  {new Date(bill.created_at).toLocaleTimeString()}
                </TableCell>
                <TableCell>₹ {bill.grand_total.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onModifyBill(bill)}
                  >
                    <Edit size={14} className="mr-2" /> Modify
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function BillPrint() {
  const data = (typeof window !== "undefined" && window.printBillData) || null;
  if (!data) return null;
  return (
    <div className="print-receipt">
      <div className="text-center font-bold text-base">{data.hotel_name}</div>
      {data.address && (
        <div className="text-center text-xs">{data.address}</div>
      )}
      <div className="text-center text-xs">
        GST Included{data.gstin ? ` • GSTIN: ${data.gstin}` : ""}
        {data.phone ? ` • Ph: ${data.phone}` : ""}
      </div>
      <div className="divider" />
      <div className="row">
        <span>Bill No</span>
        <span>{data.header.bill_number}</span>
      </div>
      <div className="row">
        <span>Date</span>
        <span>{new Date(data.created_at).toLocaleString()}</span>
      </div>
      <div className="row">
        <span>Table</span>
        <span>{data.header.table_no}</span>
      </div>
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
              <td className="text-right">{it.unit_price.toFixed(2)}</td>
              <td className="text-right">{it.line_total.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="divider" />
      <div className="row">
        <span>Subtotal</span>
        <span>₹ {data.subtotal.toFixed(2)}</span>
      </div>
      <div className="row">
        <span>Tax (5%)</span>
        <span>₹ {data.tax_amount.toFixed(2)}</span>
      </div>
      <div className="row total">
        <span>Total</span>
        <span>₹ {data.grand_total.toFixed(2)}</span>
      </div>
      <div className="center mt-2 text-xs">Thank you! Visit again</div>
    </div>
  );
}

function SettingsEditor({ settings, onChange }) {
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

  return (
    <Card className="bg-white/80 backdrop-blur">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Save size={16} /> Receipt Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Setting</TableHead>
              <TableHead>Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Hotel Name</TableCell>
              <TableCell>
                <Input
                  value={form.hotel_name || ""}
                  onChange={(e) =>
                    setForm({ ...form, hotel_name: e.target.value })
                  }
                />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Phone</TableCell>
              <TableCell>
                <Input
                  value={form.phone || ""}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>GSTIN</TableCell>
              <TableCell>
                <Input
                  value={form.gstin || ""}
                  onChange={(e) => setForm({ ...form, gstin: e.target.value })}
                />
              </TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Address</TableCell>
              <TableCell>
                <Textarea
                  rows={2}
                  value={form.address || ""}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <div className="flex justify-end">
          <Button onClick={save} className="gap-2">
            <Save size={14} /> Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminPanel({ mode }) {
  const [settings, setSettings] = useState(null);

  const loadSettings = async () => {
    try {
      const res = await axios.get(`${API}/settings`);
      setSettings(res.data);
    } catch {}
  };

  useEffect(() => {
    if (mode === "admin-full") {
      loadSettings();
    }
  }, [mode]);

  const isAdmin = mode.includes("admin");
  if (!isAdmin) return null;
  return (
    <div className="space-y-4">
      <Card className="bg-white/80 backdrop-blur">
        <CardHeader>
          <CardTitle>Admin Actions ({mode})</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc ml-5">
            <li>Pending</li>
            <li>Update</li>
            <li>Rectify</li>
            <li>Reindex</li>
            <li>Create</li>
            <li>Report</li>
          </ul>
        </CardContent>
      </Card>
      {mode === "admin-full" && settings && (
        <SettingsEditor settings={settings} onChange={setSettings} />
      )}
    </div>
  );
}

function App() {
  const { mode, setMode } = useAdminMode();
  const [billingDate, setBillingDate] = useState(null);
  const isAdmin = mode.includes("admin");
  const [drafts, setDrafts] = useState({});
  const [currentTable, setCurrentTable] = useState("");
  const [activeTab, setActiveTab] = useState("billing");

  const handleDateSelected = (date) => {
    setBillingDate(date);
  };

  const handleModifyBill = (bill) => {
    const tableNo = bill.header.table_no;
    setDrafts((prev) => ({
      ...prev,
      [tableNo]: {
        header: bill.header,
        lines: bill.items,
        modified_from_bill_id: bill.id,
      },
    }));
    setCurrentTable(tableNo);
    setActiveTab("billing");
    toast.info(
      `Editing bill for table ${tableNo}. A new bill will be created upon printing.`
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-orange-50 text-neutral-800">
      <Toaster position="top-right" />
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Udupi Anand Bhavan — Billing System
          </h1>
        </div>
        {mode === "none" ? (
          <div className="max-w-3xl">
            <LoginPanel onMode={setMode} />
          </div>
        ) : !billingDate ? (
          <div className="max-w-3xl">
            <DateSelection onDateSelected={handleDateSelected} />
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="">
            <TabsList className="bg-white/70 backdrop-blur border">
              <TabsTrigger value="billing" className="gap-1">
                <FileText size={14} /> Billing
              </TabsTrigger>
              <TabsTrigger value="menu" className="gap-1">
                <ListOrdered size={14} /> Food Menu
              </TabsTrigger>
              <TabsTrigger value="recent" className="gap-1">
                <History size={14} /> Recent Bills
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="admin" className="gap-1">
                  <LockKeyhole size={14} /> Admin
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="billing" className="mt-4">
              <Billing
                drafts={drafts}
                setDrafts={setDrafts}
                currentTable={currentTable}
                setCurrentTable={setCurrentTable}
                billingDate={billingDate}
              />
            </TabsContent>
            <TabsContent value="menu" className="mt-4">
              <FoodMenu mode={mode} />
            </TabsContent>
            <TabsContent value="recent" className="mt-4">
              <RecentBills
                billingDate={billingDate}
                onModifyBill={handleModifyBill}
              />
            </TabsContent>
            {isAdmin && (
              <TabsContent value="admin" className="mt-4">
                <AdminPanel mode={mode} />
              </TabsContent>
            )}
          </Tabs>
        )}
      </div>
    </div>
  );
}

export default App;
