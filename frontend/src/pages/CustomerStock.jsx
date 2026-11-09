import React, { useEffect, useState } from "react";
import axios from "axios";
import "./CustomerStock.css";

const api = axios.create({
    baseURL: "http://localhost:5000/api/customer-stock"
});

export default function CustomerStock() {
    const [dashboard, setDashboard] = useState({});
    const [customers, setCustomers] = useState([]);
    const [items, setItems] = useState([]);
    const [history, setHistory] = useState([]);
    const [page, setPage] = useState("items");

    const [customer, setCustomer] = useState({
        customer_code: "",
        customer_name: "",
        phone: "",
        address: ""
    });

    const [deposit, setDeposit] = useState({
        customer_id: "",
        product_name: "",
        unit: "ชิ้น",
        quantity: ""
    });

    const loadData = async () => {
        try {
            const [d, c, i, h] = await Promise.all([
                api.get("/dashboard"),
                api.get("/customers"),
                api.get("/items"),
                api.get("/history")
            ]);

            setDashboard(d.data);
            setCustomers(c.data);
            setItems(i.data);
            setHistory(h.data);
        } catch (error) {
            alert("ไม่สามารถเชื่อมต่อฐานข้อมูลได้");
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const saveCustomer = async (e) => {
        e.preventDefault();

        try {
            await api.post("/customers", customer);
            alert("เพิ่มข้อมูลลูกค้าเรียบร้อย");

            setCustomer({
                customer_code: "",
                customer_name: "",
                phone: "",
                address: ""
            });

            loadData();
        } catch (error) {
            alert(error.response?.data?.message || "บันทึกไม่สำเร็จ");
        }
    };

    const saveDeposit = async (e) => {
        e.preventDefault();

        try {
            await api.post("/deposit", {
                customer_id: Number(deposit.customer_id),
                items: [{
                    product_name: deposit.product_name,
                    unit: deposit.unit,
                    quantity: Number(deposit.quantity)
                }]
            });

            alert("รับฝากสินค้าเรียบร้อย");

            setDeposit({
                customer_id: "",
                product_name: "",
                unit: "ชิ้น",
                quantity: ""
            });

            setPage("items");
            loadData();
        } catch (error) {
            alert(error.response?.data?.message || "รับฝากไม่สำเร็จ");
        }
    };

    const returnItem = async (item) => {
        const quantity = Number(
            prompt(`จำนวนที่ต้องการคืน (คงเหลือ ${item.quantity_remaining})`)
        );

        if (!Number.isFinite(quantity) || quantity <= 0) return;

        try {
            await api.post("/return", {
                item_id: item.id,
                quantity
            });

            alert("เบิกคืนสินค้าเรียบร้อย");
            loadData();
        } catch (error) {
            alert(error.response?.data?.message || "เบิกคืนไม่สำเร็จ");
        }
    };

    return (
        <div className="customer-stock">

            <h2>📦 ระบบจัดการสินค้าฝากลูกค้า</h2>
            <p>ระบบจัดเก็บและตรวจสอบสินค้าของลูกค้าที่ฝากไว้กับร้าน</p>

            <div className="stock-dashboard">
                <div className="stock-card">
                    <span>ลูกค้าทั้งหมด</span>
                    <h2>{dashboard.total_customers || 0}</h2>
                </div>

                <div className="stock-card">
                    <span>รายการสินค้าฝาก</span>
                    <h2>{dashboard.total_items || 0}</h2>
                </div>

                <div className="stock-card">
                    <span>สินค้าคงเหลือ</span>
                    <h2>{dashboard.total_quantity || 0}</h2>
                </div>

                <div className="stock-card">
                    <span>ประวัติรายการ</span>
                    <h2>{dashboard.total_transactions || 0}</h2>
                </div>
            </div>

            <div className="stock-menu">
                <button onClick={() => setPage("items")}>
                    รายการสินค้าฝาก
                </button>

                <button onClick={() => setPage("deposit")}>
                    + รับฝากสินค้า
                </button>

                <button onClick={() => setPage("customer")}>
                    เพิ่มลูกค้า
                </button>

                <button onClick={() => setPage("customers")}>
                    รายชื่อลูกค้า
                </button>

                <button onClick={() => setPage("history")}>
                    ประวัติรายการ
                </button>
            </div>

            {page === "deposit" && (
                <form className="stock-form" onSubmit={saveDeposit}>
                    <h3>รับฝากสินค้า</h3>

                    <select
                        value={deposit.customer_id}
                        onChange={e => setDeposit({
                            ...deposit,
                            customer_id: e.target.value
                        })}
                        required
                    >
                        <option value="">เลือกลูกค้า</option>
                        {customers.map(c => (
                            <option key={c.id} value={c.id}>
                                {c.customer_code} - {c.customer_name}
                            </option>
                        ))}
                    </select>

                    <input
                        placeholder="ชื่อสินค้า"
                        value={deposit.product_name}
                        onChange={e => setDeposit({
                            ...deposit,
                            product_name: e.target.value
                        })}
                        required
                    />

                    <input
                        placeholder="หน่วย เช่น ชิ้น / กล่อง"
                        value={deposit.unit}
                        onChange={e => setDeposit({
                            ...deposit,
                            unit: e.target.value
                        })}
                        required
                    />

                    <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        placeholder="จำนวนสินค้าที่ฝาก"
                        value={deposit.quantity}
                        onChange={e => setDeposit({
                            ...deposit,
                            quantity: e.target.value
                        })}
                        required
                    />

                    <button type="submit">บันทึกรับฝาก</button>
                </form>
            )}

            {page === "customer" && (
                <form className="stock-form" onSubmit={saveCustomer}>
                    <h3>เพิ่มข้อมูลลูกค้า</h3>

                    <input
                        placeholder="รหัสลูกค้า"
                        value={customer.customer_code}
                        onChange={e => setCustomer({
                            ...customer,
                            customer_code: e.target.value
                        })}
                        required
                    />

                    <input
                        placeholder="ชื่อลูกค้า"
                        value={customer.customer_name}
                        onChange={e => setCustomer({
                            ...customer,
                            customer_name: e.target.value
                        })}
                        required
                    />

                    <input
                        placeholder="เบอร์โทรศัพท์"
                        value={customer.phone}
                        onChange={e => setCustomer({
                            ...customer,
                            phone: e.target.value
                        })}
                    />

                    <input
                        placeholder="ที่อยู่"
                        value={customer.address}
                        onChange={e => setCustomer({
                            ...customer,
                            address: e.target.value
                        })}
                    />

                    <button type="submit">บันทึกลูกค้า</button>
                </form>
            )}

            {page === "items" && (
                <>
                    <h3>รายการสินค้าฝากทั้งหมด</h3>

                    <div className="stock-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>เลขที่ฝาก</th>
                                    <th>ชื่อลูกค้า</th>
                                    <th>สินค้า</th>
                                    <th>จำนวนฝาก</th>
                                    <th>คงเหลือ</th>
                                    <th>หน่วย</th>
                                    <th>จัดการ</th>
                                </tr>
                            </thead>

                            <tbody>
                                {items.map(item => (
                                    <tr key={item.id}>
                                        <td>{item.deposit_no}</td>
                                        <td>{item.customer_name}</td>
                                        <td>{item.product_name}</td>
                                        <td>{item.quantity_received}</td>
                                        <td>{item.quantity_remaining}</td>
                                        <td>{item.unit}</td>
                                        <td>
                                            <button
                                                onClick={() => returnItem(item)}
                                            >
                                                เบิกคืน
                                            </button>
                                        </td>
                                    </tr>
                                ))}

                                {items.length === 0 && (
                                    <tr>
                                        <td colSpan="7">
                                            ยังไม่มีสินค้าฝาก
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {page === "customers" && (
                <>
                    <h3>รายชื่อลูกค้า</h3>
                    <div className="stock-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>รหัสลูกค้า</th>
                                    <th>ชื่อลูกค้า</th>
                                    <th>โทรศัพท์</th>
                                    <th>จำนวนรายการ</th>
                                    <th>สินค้าคงเหลือ</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.map(c => (
                                    <tr key={c.id}>
                                        <td>{c.customer_code}</td>
                                        <td>{c.customer_name}</td>
                                        <td>{c.phone}</td>
                                        <td>{c.product_count}</td>
                                        <td>{c.total_remaining}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {page === "history" && (
                <>
                    <h3>ประวัติการฝากและเบิกคืน</h3>
                    <div className="stock-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>เลขที่รายการ</th>
                                    <th>วันที่</th>
                                    <th>ลูกค้า</th>
                                    <th>สินค้า</th>
                                    <th>ประเภท</th>
                                    <th>จำนวน</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map(h => (
                                    <tr key={h.id}>
                                        <td>{h.transaction_no}</td>
                                        <td>{new Date(h.created_at).toLocaleString()}</td>
                                        <td>{h.customer_name}</td>
                                        <td>{h.product_name}</td>
                                        <td>
                                            {h.transaction_type === "DEPOSIT"
                                                ? "รับฝาก"
                                                : "เบิกคืน"}
                                        </td>
                                        <td>{h.quantity} {h.unit}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

        </div>
    );
}
