import React, { useState, useEffect, useRef } from "react";

// --- Helper Components ---

// A reusable button component for consistent styling
const ActionButton = ({ children, onClick, className = "" }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 bg-gray-600 text-white font-semibold rounded-md hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white transition-colors duration-200 ${className}`}
  >
    {children}
  </button>
);

// A reusable input component
const InputField = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  name,
  onKeyDown,
  maxLength,
  className = "",
}) => (
  <div className={`flex flex-col ${className}`}>
    {label && (
      <label className="mb-1 text-sm font-medium text-gray-300">{label}</label>
    )}
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      onKeyDown={onKeyDown}
      placeholder={placeholder}
      maxLength={maxLength}
      className={`bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500`}
    />
  </div>
);

// --- Main Feature Components ---

// Food Menu Screen Component
const FoodMenu = ({ menuItems, setMenuItems }) => {
  const [newItem, setNewItem] = useState({
    alphaCode: "",
    numericCode: "",
    description: "",
    generalRate: "",
    acRate: "",
  });

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    // Only convert to uppercase if it's a text input
    const processedValue = type === "text" ? value.toUpperCase() : value;
    setNewItem((prev) => ({ ...prev, [name]: processedValue }));
  };

  const handleAddItem = async () => {
    if (
      !newItem.alphaCode ||
      !newItem.numericCode ||
      !newItem.description ||
      !newItem.generalRate ||
      !newItem.acRate
    ) {
      alert("Please fill all fields to add an item.");
      return;
    }
    try {
      const response = await fetch("http://localhost:3001/api/menu", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newItem),
      });
      if (!response.ok) throw new Error("Failed to add item");
      // Fetch the entire list again to ensure data consistency
      const menuResponse = await fetch("http://localhost:3001/api/menu");
      const updatedMenuItems = await menuResponse.json();
      setMenuItems(updatedMenuItems);
      setNewItem({
        alphaCode: "",
        numericCode: "",
        description: "",
        generalRate: "",
        acRate: "",
      });
    } catch (error) {
      console.error("Error adding item:", error);
      alert("Could not add new item to the database.");
    }
  };

  return (
    <div className="p-6 bg-gray-800 rounded-lg shadow-inner h-full overflow-y-auto">
      <h2 className="text-2xl font-bold text-white mb-4 border-b border-gray-600 pb-2">
        Food Menu Management
      </h2>

      <div className="bg-gray-700 p-4 rounded-lg mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Add New Item</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <InputField
            label="Alphabetic Code"
            name="alphaCode"
            value={newItem.alphaCode}
            onChange={handleInputChange}
            placeholder="e.g., IDL"
            type="text"
          />
          <InputField
            label="Numeric Code"
            name="numericCode"
            value={newItem.numericCode}
            onChange={handleInputChange}
            placeholder="e.g., 101"
            type="text"
          />
          <InputField
            label="Description"
            name="description"
            value={newItem.description}
            onChange={handleInputChange}
            placeholder="e.g., Idli"
            type="text"
          />
          <InputField
            label="General Rate"
            name="generalRate"
            type="number"
            value={newItem.generalRate}
            onChange={handleInputChange}
            placeholder="30.00"
          />
          <InputField
            label="AC Rate"
            name="acRate"
            type="number"
            value={newItem.acRate}
            onChange={handleInputChange}
            placeholder="35.00"
          />
        </div>
        <div className="mt-4 text-right">
          <ActionButton onClick={handleAddItem}>Add Item</ActionButton>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-white uppercase bg-gray-700">
            <tr>
              <th scope="col" className="px-6 py-3">
                Alpha Code
              </th>
              <th scope="col" className="px-6 py-3">
                Numeric Code
              </th>
              <th scope="col" className="px-6 py-3">
                Description
              </th>
              <th scope="col" className="px-6 py-3 text-right">
                General Rate
              </th>
              <th scope="col" className="px-6 py-3 text-right">
                AC Rate
              </th>
            </tr>
          </thead>
          <tbody>
            {menuItems.map((item) => (
              <tr
                key={item.id}
                className="bg-gray-800 border-b border-gray-700 hover:bg-gray-600"
              >
                <td className="px-6 py-4 font-mono">{item.alphaCode}</td>
                <td className="px-6 py-4 font-mono">{item.numericCode}</td>
                <td className="px-6 py-4">{item.description}</td>
                <td className="px-6 py-4 text-right font-mono">
                  ₹{parseFloat(item.generalRate).toFixed(2)}
                </td>
                <td className="px-6 py-4 text-right font-mono">
                  ₹{parseFloat(item.acRate).toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Billing Screen Component
const Billing = ({ menuItems }) => {
  const [billDetails, setBillDetails] = useState({
    tableNo: "",
    partyNo: "1",
    waiterNo: "",
    area: "G",
    billNo: "1",
  });
  const [billItems, setBillItems] = useState([]);
  const [itemInput, setItemInput] = useState("");
  const printRef = useRef();

  useEffect(() => {
    const today = new Date().toLocaleDateString();
    const lastReset = localStorage.getItem("billResetDate");
    if (today !== lastReset) {
      localStorage.setItem("billResetDate", today);
      localStorage.setItem("lastBillNo", "1");
      setBillDetails((prev) => ({ ...prev, billNo: "1" }));
    } else {
      setBillDetails((prev) => ({
        ...prev,
        billNo: localStorage.getItem("lastBillNo") || "1",
      }));
    }
  }, []);

  const handleDetailChange = (e) => {
    const { name, value } = e.target;
    setBillDetails((prev) => ({ ...prev, [name]: value.toUpperCase() }));
  };

  const handleAddItemToBill = (e) => {
    if (e.key === "Enter" && itemInput.trim() !== "") {
      const searchTerm = itemInput.trim().toUpperCase();
      const foundItem = menuItems.find(
        (item) =>
          item.alphaCode.toUpperCase() === searchTerm ||
          item.numericCode === searchTerm
      );

      if (foundItem) {
        const price =
          billDetails.area === "AC" ? foundItem.acRate : foundItem.generalRate;
        const existingItemIndex = billItems.findIndex(
          (item) => item.id === foundItem.id
        );

        if (existingItemIndex > -1) {
          const updatedItems = [...billItems];
          updatedItems[existingItemIndex].quantity += 1;
          setBillItems(updatedItems);
        } else {
          setBillItems([
            ...billItems,
            { ...foundItem, quantity: 1, price: parseFloat(price) },
          ]);
        }
        setItemInput("");
      } else {
        alert("Item not found. Please enter a valid code.");
      }
    }
  };

  const handleQuantityChange = (id, newQuantity) => {
    const quantity = parseInt(newQuantity, 10);
    if (quantity > 0) {
      setBillItems(
        billItems.map((item) => (item.id === id ? { ...item, quantity } : item))
      );
    } else {
      setBillItems(billItems.filter((item) => item.id !== id));
    }
  };

  const subtotal = billItems.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );
  const tax = subtotal * 0.05;
  const total = subtotal + tax;

  const handlePrint = () => {
    const printWindow = window.open("", "", "height=600,width=800");
    printWindow.document.write("<html><head><title>Print Bill</title>");
    printWindow.document.write(`
            <style>
                body { font-family: 'Courier New', Courier, monospace; margin: 20px; }
                .receipt { width: 300px; margin: auto; }
                h1, h2 { text-align: center; margin: 5px 0; }
                p { margin: 2px 0; }
                table { width: 100%; border-collapse: collapse; }
                th, td { padding: 2px; }
                .text-right { text-align: right; }
                hr { border: none; border-top: 1px dashed #000; }
            </style>
        `);
    printWindow.document.write("</head><body>");
    printWindow.document.write(printRef.current.innerHTML);
    printWindow.document.write("</body></html>");
    printWindow.document.close();
    printWindow.print();
  };

  const finalizeBill = async () => {
    if (billItems.length === 0) {
      alert("Cannot finalize an empty bill.");
      return;
    }

    if (!billDetails.tableNo || billDetails.tableNo.trim() === "") {
      alert("Please enter a Table Number before finalizing the bill.");
      return;
    }

    try {
      const response = await fetch("http://localhost:3001/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billDetails, billItems, total }),
      });

      if (!response.ok) {
        let errorMessage = "Failed to save bill due to a server error.";
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = `Server error: ${errorData.error}`;
          }
        } catch (jsonError) {
          console.error("Could not parse error response JSON:", jsonError);
          errorMessage = `Server returned a non-JSON error (Status: ${response.status}).`;
        }
        throw new Error(errorMessage);
      }

      handlePrint();

      const nextBillNo = parseInt(billDetails.billNo, 10) + 1;
      localStorage.setItem("lastBillNo", nextBillNo.toString());
      setBillDetails((prev) => ({
        ...prev,
        billNo: nextBillNo.toString(),
        tableNo: "",
        partyNo: "1",
        waiterNo: "",
      }));
      setBillItems([]);
    } catch (error) {
      console.error("Error finalizing bill:", error);
      alert(
        `Could not save the bill to the database.\nReason: ${error.message}`
      );
    }
  };

  return (
    <div className="p-6 bg-gray-800 rounded-lg shadow-inner h-full flex flex-col">
      <h2 className="text-2xl font-bold text-white mb-4 border-b border-gray-600 pb-2">
        Restaurant Billing
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
        <InputField
          label="Table No"
          name="tableNo"
          value={billDetails.tableNo}
          onChange={handleDetailChange}
        />
        <InputField
          label="Party No"
          name="partyNo"
          value={billDetails.partyNo}
          onChange={handleDetailChange}
        />
        <InputField
          label="Waiter No"
          name="waiterNo"
          value={billDetails.waiterNo}
          onChange={handleDetailChange}
        />
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-300">
            Area (AC/G)
          </label>
          <select
            name="area"
            value={billDetails.area}
            onChange={handleDetailChange}
            className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="G">General</option>
            <option value="AC">AC</option>
          </select>
        </div>
        <div>
          <label className="block mb-1 text-sm font-medium text-gray-300">
            Bill No
          </label>
          <div className="bg-gray-900 border border-gray-600 rounded-md px-3 py-2 text-white">
            {billDetails.billNo}
          </div>
        </div>
      </div>

      <div className="mb-4">
        <InputField
          label="Enter Item Code (Alpha/Numeric) and Press Enter"
          value={itemInput}
          onChange={(e) => setItemInput(e.target.value)}
          onKeyDown={handleAddItemToBill}
          placeholder="e.g., IDL or 101"
        />
      </div>

      <div className="flex-grow overflow-y-auto border border-gray-600 rounded-lg">
        <table className="w-full text-sm text-left text-gray-300">
          <thead className="text-xs text-white uppercase bg-gray-700 sticky top-0">
            <tr>
              <th scope="col" className="px-4 py-2">
                Code
              </th>
              <th scope="col" className="px-4 py-2">
                Description
              </th>
              <th scope="col" className="px-4 py-2 text-center">
                Qty
              </th>
              <th scope="col" className="px-4 py-2 text-right">
                Rate
              </th>
              <th scope="col" className="px-4 py-2 text-right">
                Amount
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {billItems.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-8 text-gray-400">
                  No items added to the bill.
                </td>
              </tr>
            ) : (
              billItems.map((item) => (
                <tr key={item.id} className="hover:bg-gray-700">
                  <td className="px-4 py-2 font-mono">{item.alphaCode}</td>
                  <td className="px-4 py-2">{item.description}</td>
                  <td className="px-4 py-2 text-center">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        handleQuantityChange(item.id, e.target.value)
                      }
                      className="w-16 text-center bg-gray-800 border border-gray-600 rounded"
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    ₹{item.price.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-600 flex justify-between items-center">
        <div>
          <ActionButton
            onClick={finalizeBill}
            className="bg-green-600 hover:bg-green-500"
          >
            End & Print Bill
          </ActionButton>
        </div>
        <div className="text-right text-white">
          <p className="font-mono">
            Subtotal:{" "}
            <span className="font-semibold">₹{subtotal.toFixed(2)}</span>
          </p>
          <p className="font-mono">
            Tax (5%): <span className="font-semibold">₹{tax.toFixed(2)}</span>
          </p>
          <p className="text-xl font-bold font-mono mt-1">
            Total: <span className="font-semibold">₹{total.toFixed(2)}</span>
          </p>
        </div>
      </div>

      <div ref={printRef} style={{ display: "none" }}>
        <div className="receipt">
          <h1>Hotel Name</h1>
          <h2>Bill Receipt</h2>
          <hr />
          <p>Bill No: {billDetails.billNo}</p>
          <p>Date: {new Date().toLocaleString()}</p>
          <p>
            Table: {billDetails.tableNo} | Party: {billDetails.partyNo}
          </p>
          <hr />
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th className="text-right">Qty</th>
                <th className="text-right">Rate</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {billItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.description}</td>
                  <td className="text-right">{item.quantity}</td>
                  <td className="text-right">{item.price.toFixed(2)}</td>
                  <td className="text-right">
                    {(item.price * item.quantity).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr />
          <p>
            Subtotal: <span className="text-right">₹{subtotal.toFixed(2)}</span>
          </p>
          <p>
            Tax (5%): <span className="text-right">₹{tax.toFixed(2)}</span>
          </p>
          <hr />
          <h2>Total: ₹{total.toFixed(2)}</h2>
          <hr />
          <p style={{ textAlign: "center" }}>Thank you! Visit again!</p>
        </div>
      </div>
    </div>
  );
};

// Admin Panel Component
const AdminPanel = () => {
  const adminFunctions = [
    "Pending",
    "Update",
    "Rectify",
    "Re-index",
    "Create",
    "Report",
  ];
  return (
    <div className="p-6 bg-gray-800 rounded-lg shadow-inner h-full">
      <h2 className="text-2xl font-bold text-white mb-4 border-b border-gray-600 pb-2">
        Admin Panel
      </h2>
      <p className="text-gray-300 mb-6">
        The following administrative functions are available. Full functionality
        will be connected to the backend.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {adminFunctions.map((func) => (
          <div
            key={func}
            className="bg-gray-700 p-4 rounded-lg text-center text-white font-semibold hover:bg-gray-600 cursor-pointer transition-colors"
          >
            {func}
          </div>
        ))}
      </div>
    </div>
  );
};

// Main App Component
export default function App() {
  const [userRole, setUserRole] = useState(null);
  const [clerkId, setClerkId] = useState("");
  const [activeTab, setActiveTab] = useState("billing");
  const [menuItems, setMenuItems] = useState([]);
  const [serverStatus, setServerStatus] = useState("connecting"); // 'connecting', 'connected', 'error'

  const ADMIN_CODE = "SHI";

  const fetchMenuData = () => {
    setServerStatus("connecting");
    fetch("http://localhost:3001/api/menu")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setMenuItems(data);
        setServerStatus("connected");
      })
      .catch((err) => {
        console.error("Failed to fetch menu items:", err);
        setServerStatus("error");
      });
  };

  useEffect(() => {
    if (userRole) {
      fetchMenuData();
    }
  }, [userRole]);

  const handleLogin = () => {
    const id = clerkId.trim().toUpperCase();
    if (id.length === 0) {
      alert("Please enter an ID.");
      return;
    }
    if (id === ADMIN_CODE) {
      setUserRole("admin");
    } else if (id.length === 3) {
      setUserRole("clerk");
    } else {
      alert("Please enter a valid 3-letter ID.");
    }
  };

  const renderTabs = () => {
    const tabs = [
      { id: "billing", label: "Billing" },
      { id: "menu", label: "Food Menu" },
    ];
    if (userRole === "admin") {
      tabs.push({ id: "admin", label: "Admin Panel" });
    }

    return (
      <div className="flex border-b border-gray-600">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-semibold text-sm transition-colors duration-200 focus:outline-none ${
              activeTab === tab.id
                ? "border-b-2 border-blue-500 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case "billing":
        return <Billing menuItems={menuItems} />;
      case "menu":
        return <FoodMenu menuItems={menuItems} setMenuItems={setMenuItems} />;
      case "admin":
        return userRole === "admin" ? <AdminPanel /> : null;
      default:
        return <Billing menuItems={menuItems} />;
    }
  };

  if (!userRole) {
    return (
      <div className="bg-gray-900 min-h-screen flex items-center justify-center font-mono text-white">
        <div className="w-full max-w-xs p-8 bg-gray-800 rounded-lg shadow-lg border border-gray-700">
          <h1 className="text-2xl font-bold text-center mb-2">
            Hotel Billing System
          </h1>
          <p className="text-center text-gray-400 mb-6">Enter ID to begin</p>
          <InputField
            value={clerkId}
            onChange={(e) => setClerkId(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            maxLength={3}
            placeholder="e.g., SHI"
            className="w-full px-4 py-3 text-center text-2xl tracking-widest uppercase"
          />
          <button
            onClick={handleLogin}
            className="w-full mt-6 bg-blue-600 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500 transition-colors duration-200"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 min-h-screen font-sans text-white p-4">
      <header className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">
          Hotel Billing System -{" "}
          {userRole === "admin"
            ? "Admin Mode"
            : `Clerk Mode (ID: ${clerkId.toUpperCase()})`}
        </h1>
        <button
          onClick={() => {
            setUserRole(null);
            setClerkId("");
          }}
          className="text-sm text-gray-400 hover:text-white"
        >
          Logout
        </button>
      </header>
      <main className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 h-[calc(100vh-80px)] flex flex-col">
        {renderTabs()}
        <div className="flex-grow overflow-hidden">
          {serverStatus === "connecting" && (
            <div className="p-6 text-center text-gray-400">
              Connecting to server...
            </div>
          )}
          {serverStatus === "error" && (
            <div className="p-6">
              <div className="text-center text-red-400 bg-red-900/50 p-4 rounded-lg border border-red-700">
                <h3 className="font-bold text-lg">Connection Failed</h3>
                <p className="mt-1">
                  Could not connect to the backend server at
                  http://localhost:3001.
                </p>
                <p className="text-sm mt-2">
                  Please ensure the Node.js server is running and there are no
                  network issues, then{" "}
                  <button
                    onClick={fetchMenuData}
                    className="underline font-semibold hover:text-white"
                  >
                    try again
                  </button>
                  .
                </p>
              </div>
            </div>
          )}
          {serverStatus === "connected" && renderContent()}
        </div>
      </main>
    </div>
  );
}
