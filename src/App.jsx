import { useEffect, useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:8000";

function App() {
  const [series, setSeries] = useState([]);
  const [products, setProducts] = useState([]);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [horizon, setHorizon] = useState(7);
  const [stockInput, setStockInput] = useState("");

  const [predictionResult, setPredictionResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // โหลดข้อมูลเริ่มต้น: 30 วันล่าสุด + product list
  useEffect(() => {
    const fetchInitial = async () => {
      setLoading(true);
      setError("");
      try {
        const [seriesRes, prodRes] = await Promise.all([
          fetch(`${API_BASE}/latest_series`),
          fetch(`${API_BASE}/products`),
        ]);

        const seriesData = await seriesRes.json();
        const prodData = await prodRes.json();

        if (!seriesData.success) {
          throw new Error(seriesData.message || "โหลดข้อมูล 30 วันล่าสุดไม่สำเร็จ");
        }
        if (!prodData.success) {
          throw new Error(prodData.message || "โหลดรายการสินค้าไม่สำเร็จ");
        }

        setSeries(seriesData.last_days || []);
        setProducts(prodData.items || []);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchInitial();
  }, []);

  const handleSelectProduct = (e) => {
    const pid = e.target.value;
    setSelectedProductId(pid);
    setPredictionResult(null);

    const prod = products.find((p) => p.product_id === pid);
    if (prod) {
      setStockInput(
        prod.stock_quantity !== undefined && prod.stock_quantity !== null
          ? String(prod.stock_quantity)
          : ""
      );
    } else {
      setStockInput("");
    }
  };

  const handlePredict = async () => {
    if (!selectedProductId) {
      setError("กรุณาเลือกสินค้า");
      return;
    }

    const stockVal = parseFloat(stockInput || "0");
    if (isNaN(stockVal) || stockVal < 0) {
      setError("จำนวนสต็อกต้องเป็นตัวเลข >= 0");
      return;
    }

    setLoading(true);
    setError("");
    setPredictionResult(null);

    try {
      const payload = {
        product_id: selectedProductId,
        horizon_days: horizon,
        current_stock: stockVal,
      };

      const res = await fetch(`${API_BASE}/predict_item_stock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || "ทำนายไม่สำเร็จ");
      }

      setPredictionResult(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct =
    selectedProductId &&
    products.find((p) => p.product_id === selectedProductId);

  return (
    <div className="app-root">
      <div className="app">
        <header className="app-header">
          <h1>AI Fashion Forecaster</h1>
          <p>
            ระบบทำนายสต็อก / ความต้องการสินค้าในร้านบูติก
            โดยใช้โมเดล LSTM จากข้อมูลยอดขายย้อนหลัง
          </p>
        </header>

        {error && <div className="alert alert-error">⚠ {error}</div>}

        {/* การ์ด: เลือกสินค้า + horizon + ทำนาย */}
        <section className="card">
          <h2>ทำนายสต็อกตามสินค้า</h2>
          <p className="subtext">
            เลือกสินค้า เลือกช่วงเวลาพยากรณ์ (7 วัน / 30 วัน)
            และระบุจำนวนสต็อกปัจจุบันที่ต้องการให้ระบบใช้คำนวณ
          </p>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">เลือกสินค้า</label>
              <select
                className="form-select"
                value={selectedProductId}
                onChange={handleSelectProduct}
              >
                <option value="">-- เลือกสินค้า --</option>
                {products.map((p) => (
                  <option key={p.product_id} value={p.product_id}>
                    {p.product_id} - {p.brand} ({p.category})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">ช่วงเวลาที่ต้องการพยากรณ์</label>
              <select
                className="form-select"
                value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
              >
                <option value={7}>อีก 7 วัน</option>
                <option value={30}>อีก 30 วัน</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">สต็อกปัจจุบันของสินค้า (ชิ้น)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                value={stockInput}
                onChange={(e) => setStockInput(e.target.value)}
                placeholder="เช่น 50"
              />
              <p className="muted small">
                ถ้าไม่แก้ ระบบจะใช้ค่าจากฐานข้อมูล (stock_quantity ใน CSV)
              </p>
            </div>
          </div>

          {selectedProduct && (
            <div className="product-summary">
              <h3>ข้อมูลสินค้า</h3>
              <p>
                <strong>ID:</strong> {selectedProduct.product_id}
              </p>
              <p>
                <strong>แบรนด์:</strong> {selectedProduct.brand} |{" "}
                <strong>หมวดหมู่:</strong> {selectedProduct.category}
              </p>
              <p>
                <strong>ฤดูกาล:</strong> {selectedProduct.season} |{" "}
                <strong>สี:</strong> {selectedProduct.color} |{" "}
                <strong>ไซส์:</strong> {selectedProduct.size}
              </p>
              <p>
                <strong>ราคา:</strong>{" "}
                {selectedProduct.current_price != null
                  ? `${selectedProduct.current_price.toFixed(2)}`
                  : "-"}{" "}
                | <strong>สต็อกในฐานข้อมูล:</strong>{" "}
                {selectedProduct.stock_quantity}
              </p>
            </div>
          )}

          <button
            className="btn-primary"
            onClick={handlePredict}
            disabled={loading || !selectedProductId}
          >
            {loading ? "กำลังทำนาย..." : "ทำนายความต้องการ & สต็อกคงเหลือ"}
          </button>

          {predictionResult && (
            <div className="prediction-box">
              <p>
                ช่วงเวลาที่พยากรณ์: <strong>{predictionResult.horizon_days}</strong>{" "}
                วัน
              </p>
              <p>
                สต็อกเริ่มต้นที่ใช้คำนวณ:{" "}
                <strong>{predictionResult.base_stock.toFixed(0)}</strong> ชิ้น
              </p>
              <p>
                คาดว่าความต้องการรวมของสินค้านี้ในช่วง{" "}
                <strong>{predictionResult.horizon_days}</strong> วันถัดไป ≈{" "}
                <strong>
                  {predictionResult.total_future_demand.toFixed(1)} ชิ้น
                </strong>
              </p>
              <p>
                <strong>สต็อกคงเหลือประมาณการ</strong> หลังผ่านไป{" "}
                {predictionResult.horizon_days} วัน ≈{" "}
                <span className="prediction-number">
                  {predictionResult.predicted_stock_left.toFixed(1)} ชิ้น
                </span>
              </p>
            </div>
          )}
        </section>

        {/* การ์ด: ข้อมูลยอดขายรวม 30 วันล่าสุด */}
        <section className="card">
          <div className="card-header">
            <div>
              <h2>ข้อมูลยอดขายรวม 30 วันล่าสุดของร้าน</h2>
              <p className="subtext">
                ข้อมูลนี้ใช้เป็นพื้นฐานให้โมเดล LSTM เรียนรู้แพตเทิร์นความต้องการรวมของร้าน
              </p>
            </div>
            {loading && (
              <span className="badge badge-neutral">กำลังโหลดข้อมูล...</span>
            )}
          </div>

          {series.length === 0 && !loading && (
            <p className="muted">ยังไม่มีข้อมูล หรือโหลดข้อมูลไม่สำเร็จ</p>
          )}

          {series.length > 0 && (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>วันที่</th>
                    <th>จำนวนชิ้นรวม</th>
                    <th>ยอดขายรวม</th>
                    <th>ส่วนลดเฉลี่ย (%)</th>
                    <th>เรตติ้งเฉลี่ย</th>
                    <th>วันในสัปดาห์</th>
                    <th>Weekend?</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((row, idx) => (
                    <tr key={idx}>
                      <td>{row.date}</td>
                      <td>{row.total_qty}</td>
                      <td>{row.total_revenue.toFixed(2)}</td>
                      <td>{row.avg_discount.toFixed(2)}</td>
                      <td>{row.avg_rating.toFixed(2)}</td>
                      <td>{row.dayofweek}</td>
                      <td>{row.is_weekend ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;
