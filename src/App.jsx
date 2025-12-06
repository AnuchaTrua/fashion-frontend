// src/App.jsx
import { useEffect, useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:8000";

function App() {
  const [series, setSeries] = useState([]);
  const [products, setProducts] = useState([]);

  const [selectedProductId, setSelectedProductId] = useState("");
  const [horizon, setHorizon] = useState(7);
  const [stockInput, setStockInput] = useState("");

  // scenario ใหม่
  const [scenarioPrice, setScenarioPrice] = useState("");
  const [scenarioDiscount, setScenarioDiscount] = useState("");

  const [predictionResult, setPredictionResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // โหลดข้อมูลเริ่มต้น: WINDOW_SIZE วันล่าสุด + product list
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
          throw new Error(seriesData.message || "โหลดข้อมูลล่าสุดไม่สำเร็จ");
        }
        if (!prodData.success) {
          throw new Error(prodData.message || "โหลดรายการสินค้าไม่สำเร็จ");
        }

        setSeries(seriesData.last_days || []);
        setProducts(prodData.items || []);
      } catch (err) {
        console.error(err);
        setError(err.message || "เกิดข้อผิดพลาดในการดึงข้อมูล");
      } finally {
        setLoading(false);
      }
    };

    fetchInitial();
  }, []);

  const selectedProduct =
    selectedProductId &&
    products.find((p) => p.product_id === selectedProductId);

  const handleSelectProduct = (e) => {
    const pid = e.target.value;
    setSelectedProductId(pid);
    setPredictionResult(null);
    setError("");

    const prod = products.find((p) => p.product_id === pid);
    if (prod) {
      setStockInput(
        prod.stock_quantity !== undefined && prod.stock_quantity !== null
          ? String(prod.stock_quantity)
          : ""
      );

      // เติมค่า default ของ scenario ให้ใกล้เคียงของจริง
      setScenarioPrice(
        prod.current_price !== undefined && prod.current_price !== null
          ? String(prod.current_price)
          : ""
      );
      setScenarioDiscount(
        prod.markdown_percentage !== undefined &&
          prod.markdown_percentage !== null
          ? String(prod.markdown_percentage)
          : ""
      );
    } else {
      setStockInput("");
      setScenarioPrice("");
      setScenarioDiscount("");
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

    // scenario price / discount (optional)
    const scenarioPriceNum =
      scenarioPrice.trim() === "" ? null : parseFloat(scenarioPrice);
    const scenarioDiscountNum =
      scenarioDiscount.trim() === "" ? null : parseFloat(scenarioDiscount);

    if (
      scenarioPriceNum !== null &&
      (isNaN(scenarioPriceNum) || scenarioPriceNum <= 0)
    ) {
      setError("ราคาจำลองต้องเป็นจำนวนบวก");
      return;
    }

    if (
      scenarioDiscountNum !== null &&
      (isNaN(scenarioDiscountNum) ||
        scenarioDiscountNum < 0 ||
        scenarioDiscountNum > 100)
    ) {
      setError("ส่วนลดจำลองต้องอยู่ระหว่าง 0–100 (%)");
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

      if (scenarioPriceNum !== null) {
        payload.scenario_price = scenarioPriceNum;
      }
      if (scenarioDiscountNum !== null) {
        payload.scenario_discount = scenarioDiscountNum;
      }

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
      setError(err.message || "เกิดข้อผิดพลาดระหว่างการทำนาย");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-root">
      <div className="app">
        <header className="app-header">
          <h1>AI Fashion Forecaster</h1>
          <p>
            ระบบทำนายสต็อก / ความต้องการสินค้าในร้านบูติก
            โดยใช้โมเดล LSTM จากข้อมูลยอดขายย้อนหลัง พร้อมลองตั้งราคาและส่วนลดจำลองได้
          </p>
        </header>

        {error && <div className="alert alert-error">⚠ {error}</div>}

        {/* การ์ด: เลือกสินค้า + horizon + ทำนาย */}
        <section className="card">
          <h2>ทำนายสต็อกตามสินค้า</h2>
          <p className="subtext">
            เลือกสินค้า เลือกช่วงเวลาพยากรณ์ (7 วัน / 30 วัน)
            ระบุจำนวนสต็อกปัจจุบัน และ (ทางเลือก) ราคากับส่วนลดที่อยากลอง
          </p>

          <div className="form-grid">
            {/* เลือกสินค้า */}
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

            {/* horizon */}
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

            {/* stock ปัจจุบัน */}
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

            {/* ราคาจำลอง */}
            <div className="form-group">
              <label className="form-label">ราคาจำลอง (ต่อชิ้น)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                step="0.01"
                value={scenarioPrice}
                onChange={(e) => setScenarioPrice(e.target.value)}
                placeholder="เช่น 299 (เว้นว่างหากใช้ราคาปัจจุบัน)"
              />
              <p className="muted small">
                ถ้าเว้นว่าง ระบบจะใช้ current_price จากฐานข้อมูล
              </p>
            </div>

            {/* ส่วนลดจำลอง */}
            <div className="form-group">
              <label className="form-label">ส่วนลดจำลอง (%)</label>
              <input
                className="form-input"
                type="number"
                min="0"
                max="100"
                step="1"
                value={scenarioDiscount}
                onChange={(e) => setScenarioDiscount(e.target.value)}
                placeholder="เช่น 20 (เว้นว่างหากใช้ส่วนลดปัจจุบัน)"
              />
              <p className="muted small">
                เช่น 20 = ลด 20% จากราคาจำลอง / ราคาปัจจุบัน
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
                <strong>ราคาในฐานข้อมูล:</strong>{" "}
                {selectedProduct.current_price != null
                  ? selectedProduct.current_price.toFixed(2)
                  : "-"}{" "}
                | <strong>ส่วนลดในฐานข้อมูล:</strong>{" "}
                {selectedProduct.markdown_percentage != null
                  ? `${selectedProduct.markdown_percentage.toFixed(0)}%`
                  : "-"}
                {" | "}
                <strong>สต็อกในฐานข้อมูล:</strong>{" "}
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
                ช่วงเวลาที่พยากรณ์:{" "}
                <strong>{predictionResult.horizon_days}</strong> วัน
              </p>
              <p>
                สต็อกเริ่มต้นที่ใช้คำนวณ:{" "}
                <strong>{predictionResult.base_stock.toFixed(0)}</strong> ชิ้น
              </p>

              <p>
                ราคาที่ใช้ใน scenario:{" "}
                <strong>
                  {predictionResult.scenario_price != null
                    ? predictionResult.scenario_price.toFixed(2)
                    : selectedProduct && selectedProduct.current_price != null
                    ? selectedProduct.current_price.toFixed(2)
                    : "-"}
                </strong>
              </p>
              <p>
                ส่วนลดที่ใช้ใน scenario:{" "}
                <strong>
                  {predictionResult.scenario_discount != null
                    ? `${predictionResult.scenario_discount.toFixed(0)}%`
                    : selectedProduct &&
                      selectedProduct.markdown_percentage != null
                    ? `${selectedProduct.markdown_percentage.toFixed(0)}%`
                    : "-"}
                </strong>
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

        {/* การ์ด: ข้อมูลยอดขายรวม WINDOW_SIZE วันล่าสุด */}
        <section className="card">
          <div className="card-header">
            <div>
              <h2>ข้อมูลยอดขายรวม {series.length} วันล่าสุดของร้าน</h2>
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
                      <td>{Number(row.total_qty).toFixed(0)}</td>
                      <td>{Number(row.total_revenue).toFixed(2)}</td>
                      <td>{Number(row.avg_discount).toFixed(2)}</td>
                      <td>{Number(row.avg_rating).toFixed(2)}</td>
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
