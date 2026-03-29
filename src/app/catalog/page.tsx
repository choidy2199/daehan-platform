"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { DB, KEYS, save, findStock, getOrderHistory, getPoHistory } from "@/lib/db";
import { fmt, pct, marginBadge, sortProducts, recalcAll } from "@/lib/calc";
import { useToast } from "@/components/common/Toast";
import ProductModal from "@/components/catalog/ProductModal";
import ImportModal from "@/components/catalog/ImportModal";
import SettingsModal from "@/components/catalog/SettingsModal";

export default function CatalogPage() {
  const { toast } = useToast();
  const tableRef = useRef<HTMLTableElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [filterMode, setFilterMode] = useState("all");
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [subFilter, setSubFilter] = useState("");
  const [showProductModal, setShowProductModal] = useState(false);
  const [editProductIdx, setEditProductIdx] = useState<number | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Force DB init on mount
  useEffect(() => {
    DB.init();
    setRefreshKey((k) => k + 1);
  }, []);

  // Column resize + sticky header
  useEffect(() => {
    if (!tableRef.current) return;
    initColumnResize(tableRef.current);
    initStickyHeader(tableRef.current, scrollRef.current);
  });

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  // --- DATA ---
  const products = DB.products || [];
  const inventory = DB.inventory || [];

  // Categories for filter selects
  const categories = [...new Set(products.map((p) => p.category).filter(Boolean))].sort();
  const subcategories = [...new Set(products.map((p) => p.subcategory).filter(Boolean))].sort();

  // KPI counts
  const totalProducts = products.length;
  const inStockCount = inventory.filter((i) => i.stock > 0).length;
  const outStockCount = inventory.filter((i) => i.stock <= 0).length;
  const disconCount = products.filter((p) => p.discontinued).length;
  const noCodeCount = products.filter(
    (p) => !p.manageCode || p.manageCode.trim() === "" || p.manageCode === "-"
  ).length;
  const noSkuCount = products.filter(
    (p) => !p.code || p.code.trim() === "" || p.code === "-"
  ).length;

  // Filter
  let filtered = products.filter((p) => {
    if (catFilter && p.category !== catFilter) return false;
    if (subFilter && p.subcategory !== subFilter) return false;
    if (search) {
      const s = `${p.code} ${p.manageCode || ""} ${p.model} ${p.description} ${p.subcategory} ${p.detail} ${p.ttiNum}`.toLowerCase();
      return s.includes(search.toLowerCase());
    }
    return true;
  });

  if (filterMode === "instock") {
    filtered = filtered.filter((p) => {
      const s = findStock(p.code);
      return s != null && s > 0;
    });
  } else if (filterMode === "outstock") {
    filtered = filtered.filter((p) => {
      const s = findStock(p.code);
      return s != null && s <= 0;
    });
  } else if (filterMode === "discontinued") {
    filtered = filtered.filter((p) => !!p.discontinued);
  } else if (filterMode === "nocode") {
    filtered = filtered.filter(
      (p) => !p.manageCode || p.manageCode.trim() === "" || p.manageCode === "-"
    );
  } else if (filterMode === "nosku") {
    filtered = filtered.filter(
      (p) => !p.code || p.code.trim() === "" || p.code === "-"
    );
  }

  const active = sortProducts(filtered.filter((p) => !p.discontinued));
  const discontinued = sortProducts(filtered.filter((p) => p.discontinued));

  // --- BUILD ROWS HTML ---
  function buildRow(p: any): string {
    const idx = DB.products.indexOf(p);
    const stock = findStock(p.code);
    const stockBadge =
      stock == null
        ? '<span class="badge badge-gray">-</span>'
        : stock > 0
        ? `<span class="badge badge-green">${stock}</span>`
        : stock === 0
        ? '<span class="badge badge-amber">0</span>'
        : `<span class="badge badge-red">${stock}</span>`;
    const dcDisplay = p.productDC ? pct(p.productDC) : "-";
    const isD = !!p.discontinued;

    // TTI Stock SVG
    const ttiStockSVG = (() => {
      const s = (p.ttiStock || "").trim();
      if (!s || s === "-")
        return '<svg width="18" height="18" viewBox="0 0 18 18"><rect x="4" y="8" width="10" height="2" rx="1" fill="#B4B2A9"/></svg>';
      if (s === "\uC801\uC815" || s === "O")
        return '<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6" fill="#4A90D9"/></svg>';
      if (s === "\uC784\uBC15" || s === "\uC138\uBAA8")
        return '<svg width="18" height="18" viewBox="0 0 18 18"><polygon points="9,3 15,14 3,14" fill="#F5A623"/></svg>';
      if (s === "\uC18C\uC9C4" || s === "X")
        return '<svg width="18" height="18" viewBox="0 0 18 18"><line x1="4" y1="4" x2="14" y2="14" stroke="#E24B4A" stroke-width="2.5" stroke-linecap="round"/><line x1="14" y1="4" x2="4" y2="14" stroke="#E24B4A" stroke-width="2.5" stroke-linecap="round"/></svg>';
      return `<span style="font-size:11px;color:#5A6070">${s}</span>`;
    })();

    // 원가P column
    const costPCell = (() => {
      const code = String(p.code);
      const results: { cost: number }[] = [];
      const now = Date.now();
      const weekMs = 7 * 24 * 60 * 60 * 1000;
      const orderHistory = getOrderHistory();
      const poHistory = getPoHistory();
      (orderHistory || []).forEach((record: any) => {
        if (now - new Date(record.date).getTime() < weekMs) {
          (record.items || []).forEach((it: any) => {
            if (String(it.code) === code) results.push({ cost: it.cost });
          });
        }
      });
      (poHistory || []).forEach((record: any) => {
        if (now - new Date(record.date).getTime() < weekMs) {
          (record.items || []).forEach((it: any) => {
            if (String(it.code) === code) results.push({ cost: it.cost });
          });
        }
      });
      if (!results.length) {
        return '<td class="num" style="background:#FEFAFA;color:#9BA3B2">-</td>';
      }
      const latest = results[results.length - 1];
      return `<td class="num" style="background:#FEFAFA"><span style="color:#CC2222;font-weight:700">${fmt(latest.cost)}</span> <span data-action="showPromoPop" data-code="${code}" style="display:inline-block;background:#CC2222;color:white;font-size:9px;font-weight:700;padding:1px 4px;border-radius:3px;cursor:pointer;vertical-align:middle">P</span></td>`;
    })();

    // inDate display
    const inDate = p.inDate
      ? `<span style="color:#CC2222;margin-right:4px">\u25CF</span>${p.inDate}`
      : "-";

    // Margin badges
    const naverMargin = isD
      ? ""
      : marginBadge(p.priceNaver, p.cost, DB.settings.naverFee || 0.0663);
    const openFee =
      p.category === "\uD30C\uC6CC\uD234"
        ? DB.settings.openElecFee || 0.13
        : DB.settings.openHandFee || 0.176;
    const openMargin = isD ? "" : marginBadge(p.priceOpen, p.cost, openFee);

    return `<tr class="${isD ? "row-discontinued" : ""}">
      <td style="font-weight:500">${p.code}</td>
      <td>${p.manageCode || "-"}</td>
      <td><span class="badge badge-blue">${p.category || "-"}</span></td>
      <td>${p.subcategory || "-"}</td>
      <td>${p.detail || "-"}</td>
      <td class="center">${p.orderNum || "-"}</td>
      <td>${p.ttiNum || "-"}</td>
      <td style="font-weight:500">${p.model || "-"}</td>
      <td title="${p.description || ""}">${p.description || "-"}</td>
      <td class="num">${fmt(p.supplyPrice)}</td>
      <td class="center">${dcDisplay}</td>
      <td class="num">${fmt(p.cost)}</td>
      ${costPCell}
      <td class="num">${fmt(p.priceA)}</td>
      <td class="num">${fmt(p.priceRetail)}</td>
      <td class="num" style="background:${isD ? "transparent" : "#F8FBFF"}">${fmt(p.priceNaver)}${naverMargin}</td>
      <td class="num" style="background:${isD ? "transparent" : "#FEFCF5"}">${fmt(p.priceOpen)}${openMargin}</td>
      <td class="center">${stockBadge}</td>
      <td class="center">${ttiStockSVG}</td>
      <td style="text-align:left;font-size:12px;cursor:pointer;white-space:nowrap;padding-left:8px" data-action="editInDate" data-idx="${idx}" title="\uD074\uB9AD\uD558\uC5EC \uC785\uACE0\uB0A0\uC9DC \uBA54\uBAA8 \uD3B8\uC9D1">${inDate}</td>
      <td class="center" style="white-space:nowrap"><button class="btn-edit" data-action="edit" data-idx="${idx}">\uC218\uC815</button> <button class="btn-danger btn-sm" data-action="delete" data-idx="${idx}" style="padding:2px 6px;font-size:11px">\uC0AD\uC81C</button> <button class="btn-edit" data-action="toggleDiscon" data-idx="${idx}" data-isdiscon="${isD}" style="padding:2px 6px;font-size:11px;${isD ? "background:#CC2222" : "background:#9BA3B2"}">${isD ? "\uB2E8\uC885\uB428" : "\uB2E8\uC885"}</button></td>
    </tr>`;
  }

  let tableHTML = "";
  active.slice(0, 500).forEach((p) => {
    tableHTML += buildRow(p);
  });
  if (discontinued.length > 0) {
    tableHTML += `<tr class="discontinued-divider"><td colspan="21">\uB2E8\uC885 \uD488\uBAA9 (${discontinued.length}\uAC74)</td></tr>`;
    tableHTML += discontinued
      .slice(0, 200)
      .map(buildRow)
      .join("");
  }

  if (!filtered.length && !products.length) {
    tableHTML = `<tr><td colspan="21"><div class="empty-state"><p>\uC81C\uD488 \uB370\uC774\uD130\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4</p><p style="font-size:12px">\uC5D1\uC140 \uAC00\uC838\uC624\uAE30 \uB610\uB294 \uC81C\uD488 \uCD94\uAC00\uB97C \uC2DC\uC791\uD558\uC138\uC694.</p></div></td></tr>`;
  }

  // --- EVENT DELEGATION ---
  function handleTableClick(e: React.MouseEvent) {
    const target = e.target as HTMLElement;
    const action = target.getAttribute("data-action");
    if (!action) {
      // check parent
      const parent = target.closest("[data-action]") as HTMLElement | null;
      if (!parent) return;
      handleAction(parent);
      return;
    }
    handleAction(target);
  }

  function handleAction(el: HTMLElement) {
    const action = el.getAttribute("data-action");
    const idx = parseInt(el.getAttribute("data-idx") || "-1");

    if (action === "edit" && idx >= 0) {
      setEditProductIdx(idx);
      setShowProductModal(true);
    } else if (action === "delete" && idx >= 0) {
      const p = DB.products[idx];
      if (!confirm(`"${p.model || p.code}" \uC81C\uD488\uC744 \uC0AD\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?`)) return;
      DB.products.splice(idx, 1);
      save(KEYS.products, DB.products);
      refresh();
      toast("\uC81C\uD488 \uC0AD\uC81C \uC644\uB8CC");
    } else if (action === "toggleDiscon" && idx >= 0) {
      const isD = el.getAttribute("data-isdiscon") === "true";
      DB.products[idx].discontinued = isD ? "" : "\uB2E8\uC885";
      save(KEYS.products, DB.products);
      refresh();
    } else if (action === "editInDate" && idx >= 0) {
      const p = DB.products[idx];
      const current = p.inDate || "";
      const val = prompt("\uC785\uACE0\uB0A0\uC9DC \uBA54\uBAA8 (\uC0AD\uC81C\uD558\uB824\uBA74 \uBE44\uC6CC\uB450\uC138\uC694):", current);
      if (val === null) return;
      DB.products[idx].inDate = val.trim();
      save(KEYS.products, DB.products);
      refresh();
      toast(val.trim() ? "\uC785\uACE0\uB0A0\uC9DC \uBA54\uBAA8 \uC800\uC7A5" : "\uC785\uACE0\uB0A0\uC9DC \uBA54\uBAA8 \uC0AD\uC81C");
    }
  }

  // --- EXPORT ---
  function exportAll() {
    import("xlsx").then((XLSX) => {
      const wb = XLSX.utils.book_new();

      if (DB.products.length) {
        const pData: any[][] = [
          [
            "\uB2E8\uC885",
            "\uCF54\uB4DC",
            "\uAD00\uB9AC\uCF54\uB4DC",
            "\uB300\uBD84\uB958",
            "\uC911\uBD84\uB958",
            "\uC18C\uBD84\uB958",
            "\uC21C\uBC88",
            "TTI#",
            "\uBAA8\uB378\uBA85",
            "\uC81C\uD488\uC124\uBA85",
            "\uACF5\uAE09\uAC00",
            "\uC81C\uD488DC",
            "\uC6D0\uAC00",
            "A(\uB3C4\uB9E4)",
            "\uC18C\uB9E4",
            "\uC2A4\uD1A0\uC5B4\uD31C",
            "\uC624\uD508\uB9C8\uCF13",
          ],
        ];
        DB.products.forEach((p) =>
          pData.push([
            p.discontinued,
            p.code,
            p.manageCode || "",
            p.category,
            p.subcategory,
            p.detail,
            p.orderNum,
            p.ttiNum,
            p.model,
            p.description,
            p.supplyPrice,
            p.productDC,
            p.cost,
            p.priceA,
            p.priceRetail,
            p.priceNaver,
            p.priceOpen,
          ])
        );
        const ws = XLSX.utils.aoa_to_sheet(pData);
        ws["!cols"] = [
          { wch: 6 },
          { wch: 10 },
          { wch: 15 },
          { wch: 10 },
          { wch: 15 },
          { wch: 15 },
          { wch: 8 },
          { wch: 12 },
          { wch: 25 },
          { wch: 40 },
          { wch: 12 },
          { wch: 8 },
          { wch: 12 },
          { wch: 12 },
          { wch: 12 },
          { wch: 12 },
          { wch: 12 },
        ];
        XLSX.utils.book_append_sheet(wb, ws, "\uC804\uCCB4\uAC00\uACA9\uD45C");
      }

      if (DB.inventory.length) {
        const iData: any[][] = [["\uCF54\uB4DC", "\uC7AC\uACE0", "\uBE44\uACE01", "\uBE44\uACE02"]];
        DB.inventory.forEach((i) => iData.push([i.code, i.stock, i.note1, i.note2]));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(iData), "\uC7AC\uACE0");
      }

      if (DB.promotions.length) {
        const prData: any[][] = [
          [
            "\uCF54\uB4DC",
            "\uAD6C\uBD84",
            "\uD504\uB85C\uBAA8\uC158\uBA85",
            "\uBAA8\uB378\uBA85",
            "\uC21C\uBC88",
            "\uB300\uB9AC\uC810\uAC00\uACA9",
            "\uD504\uB85C\uBAA8\uC158\uAE08\uC561",
            "\uD560\uC778\uC728",
            "\uAE30\uAC04",
          ],
        ];
        DB.promotions.forEach((p) =>
          prData.push([
            p.code,
            p.promoCode,
            p.promoName,
            p.model,
            p.orderNum,
            p.dealerPrice,
            p.promoPrice,
            p.discountRate,
            p.period,
          ])
        );
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(prData), "\uD504\uB85C\uBAA8\uC158");
      }

      XLSX.writeFile(
        wb,
        `\uBC00\uC6CC\uD0A4_\uC804\uCCB4\uB370\uC774\uD130_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      toast("\uC804\uCCB4 \uB370\uC774\uD130 \uC5D1\uC140 \uD30C\uC77C \uB2E4\uC6B4\uB85C\uB4DC \uC644\uB8CC");
    });
  }

  // --- FILTER TAB CLICK ---
  function handleFilterClick(mode: string) {
    setFilterMode(mode);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "visible" }}>
      {/* KPI Row */}
      <div className="kpi-row" id="catalog-kpi">
        <div className="kpi-card">
          <div className="kpi-label">{"\uC804\uCCB4 \uC81C\uD488"}</div>
          <div className="kpi-value">{totalProducts.toLocaleString()}{"\uAC74"}</div>
        </div>
        <div className="kpi-card-light">
          <div className="kpi-label">{"\uC7AC\uACE0 \uC788\uC74C"}</div>
          <div className="kpi-value">{inStockCount.toLocaleString()}{"\uAC74"}</div>
        </div>
        <div className="kpi-card-light">
          <div className="kpi-label">{"\uC7AC\uACE0\uC5C6\uC74C"}</div>
          <div className="kpi-value">{outStockCount.toLocaleString()}{"\uAC74"}</div>
        </div>
        <div className="kpi-card-light">
          <div className="kpi-label">{"\uB2E8\uC885"}</div>
          <div className="kpi-value" style={{ color: "#CC2222" }}>
            {disconCount.toLocaleString()}{"\uAC74"}
          </div>
        </div>
        <div className="kpi-card-light">
          <div className="kpi-label">{"\uAD00\uB9AC\uCF54\uB4DC\uC5C6\uC74C"}</div>
          <div className="kpi-value" style={{ color: "#EF9F27" }}>
            {noCodeCount.toLocaleString()}{"\uAC74"}
          </div>
        </div>
      </div>

      {/* Filter Sub-tabs */}
      <div className="sub-tabs" id="catalog-filter-tabs">
        <button
          className={`sub-tab ${filterMode === "all" ? "active" : ""}`}
          onClick={() => handleFilterClick("all")}
        >
          {"\uC804\uCCB4\uC81C\uD488"}({totalProducts})
        </button>
        <button
          className={`sub-tab ${filterMode === "instock" ? "active" : ""}`}
          onClick={() => handleFilterClick("instock")}
        >
          {"\uC7AC\uACE0\uC788\uC74C"}({inStockCount})
        </button>
        <button
          className={`sub-tab ${filterMode === "outstock" ? "active" : ""}`}
          onClick={() => handleFilterClick("outstock")}
        >
          {"\uC7AC\uACE0\uC5C6\uC74C"}({outStockCount})
        </button>
        <button
          className={`sub-tab ${filterMode === "discontinued" ? "active" : ""}`}
          onClick={() => handleFilterClick("discontinued")}
        >
          {"\uB2E8\uC885"}({disconCount})
        </button>
        <button
          className={`sub-tab ${filterMode === "nocode" ? "active" : ""}`}
          onClick={() => handleFilterClick("nocode")}
        >
          {"\uAD00\uB9AC\uCF54\uB4DC\uC5C6\uC74C"}({noCodeCount})
        </button>
        <button
          className={`sub-tab ${filterMode === "nosku" ? "active" : ""}`}
          onClick={() => handleFilterClick("nosku")}
        >
          {"\uCF54\uB4DC\uC5C6\uC74C"}({noSkuCount})
        </button>
      </div>

      {/* Section */}
      <div className="section" style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "visible" }}>
        <div className="section-header">
          <span>{"\uBC00\uC6CC\uD0A4 \uC804\uCCB4 \uAC00\uACA9\uD45C"}</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span id="catalog-count" style={{ fontSize: 12, fontWeight: 400, opacity: 0.7 }}>
              {filtered.length}{"\uAC74"} ({"\uB2E8\uC885"} {discontinued.length}{"\uAC74"})
            </span>
            <button
              id="btn-delete-selected"
              className="btn-danger btn-sm"
              style={{ display: "none" }}
            >
              {"\uC120\uD0DD\uC0AD\uC81C"}
            </button>
            <button
              className="btn-setting"
              onClick={() => setShowSettingsModal(true)}
            >
              {"\u2699 \uC124\uC815"}
            </button>
            <button
              className="btn-action"
              onClick={() => {
                setEditProductIdx(null);
                setShowProductModal(true);
              }}
            >
              + {"\uC81C\uD488 \uCD94\uAC00"}
            </button>
            <button
              className="btn-action-sub"
              onClick={() => setShowImportModal(true)}
            >
              {"\uD83D\uDCE5 \uAC00\uC838\uC624\uAE30"}
            </button>
            <button className="btn-export" onClick={exportAll}>
              {"\uD83D\uDCE4 \uB0B4\uBCF4\uB0B4\uAE30"}
            </button>
          </div>
        </div>
        <div
          className="section-body"
          style={{ padding: 12, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
        >
          {/* Search Bar */}
          <div className="search-bar">
            <input
              id="catalog-search"
              className="input"
              placeholder={"\uCF54\uB4DC, \uBAA8\uB378\uBA85, \uC81C\uD488\uC124\uBA85 \uAC80\uC0C9..."}
              style={{ maxWidth: 300 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              id="catalog-cat"
              className="select"
              style={{ maxWidth: 180 }}
              value={catFilter}
              onChange={(e) => {
                setCatFilter(e.target.value);
                setSubFilter("");
              }}
            >
              <option value="">{"\uC804\uCCB4 \uB300\uBD84\uB958"}</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              id="catalog-sub"
              className="select"
              style={{ maxWidth: 180 }}
              value={subFilter}
              onChange={(e) => setSubFilter(e.target.value)}
            >
              <option value="">{"\uC804\uCCB4 \uC911\uBD84\uB958"}</option>
              {subcategories.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div
            className="table-scroll"
            ref={scrollRef}
            style={{ flex: 1, overflowY: "auto", overflowX: "auto", minHeight: 0 }}
          >
            <table className="data-table" id="catalog-table" ref={tableRef}>
              <thead>
                <tr>
                  <th>{"\uCF54\uB4DC"}</th>
                  <th>{"\uAD00\uB9AC\uCF54\uB4DC"}</th>
                  <th>{"\uB300\uBD84\uB958"}</th>
                  <th>{"\uC911\uBD84\uB958"}</th>
                  <th>{"\uC18C\uBD84\uB958"}</th>
                  <th className="center">{"\uC21C\uBC88"}</th>
                  <th>TTI#</th>
                  <th>{"\uBAA8\uB378\uBA85"}</th>
                  <th>{"\uC81C\uD488\uC124\uBA85"}</th>
                  <th className="num">{"\uACF5\uAE09\uAC00"}</th>
                  <th className="center">{"\uC81C\uD488DC"}</th>
                  <th className="num">{"\uC6D0\uAC00"}</th>
                  <th className="num" style={{ background: "#FCEBEB", color: "#CC2222" }}>
                    {"\uC6D0\uAC00P"}
                  </th>
                  <th className="num">A({"\uB3C4\uB9E4"})</th>
                  <th className="num">{"\uC18C\uB9E4"}</th>
                  <th className="num" style={{ background: "#E6F1FB", color: "#0C447C" }}>
                    {"\uC2A4\uD1A0\uC5B4\uD31C"}
                  </th>
                  <th className="num" style={{ background: "#FAEEDA", color: "#412402" }}>
                    {"\uC624\uD508\uB9C8\uCF13"}
                  </th>
                  <th className="center">{"\uC7AC\uACE0"}</th>
                  <th className="center">{"\uBCF8\uC0AC"}</th>
                  <th className="center">{"\uC785\uACE0\uB0A0\uC9DC"}</th>
                  <th className="center" style={{ width: 90 }}></th>
                </tr>
              </thead>
              <tbody
                id="catalog-body"
                onClick={handleTableClick}
                dangerouslySetInnerHTML={{ __html: tableHTML }}
              />
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ProductModal
        show={showProductModal}
        onClose={() => setShowProductModal(false)}
        editIdx={editProductIdx}
        onSave={refresh}
      />
      <ImportModal
        show={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={refresh}
      />
      <SettingsModal
        show={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        onApply={refresh}
      />
    </div>
  );
}

// --- initStickyHeader (ported from original) ---
function initStickyHeader(
  table: HTMLTableElement | null,
  scrollContainer: HTMLDivElement | null
) {
  if (!table || !scrollContainer) return;
  const thead = table.querySelector("thead");
  if (!thead) return;

  // Remove old listener if any
  const handler = function (this: HTMLDivElement) {
    const scrollTop = this.scrollTop;
    (thead as HTMLElement).style.transform = "translateY(" + scrollTop + "px)";
    (thead as HTMLElement).style.zIndex = "5";
  };
  scrollContainer.removeEventListener("scroll", handler);
  scrollContainer.addEventListener("scroll", handler);

  thead.querySelectorAll("th").forEach((th) => {
    if (!th.style.background) {
      th.style.background = "#EAECF2";
    }
  });
}

// --- initColumnResize (ported from original) ---
function initColumnResize(table: HTMLTableElement | null) {
  if (!table) return;
  const ths = table.querySelectorAll("thead th");
  if (!ths.length) return;

  // Skip if already initialized
  if (table.querySelector(".col-resize")) return;

  const storageKey = "mw_colwidths_" + (table.id || "catalog-table");
  let W: number[] | null = null;

  function initCols() {
    if (W) return;
    W = Array.from(ths).map((t) => (t as HTMLElement).offsetWidth);
    applyCols();
  }

  function applyCols() {
    if (!W || !table) return;
    table.style.tableLayout = "fixed";
    let cg = table.querySelector("colgroup.resize-cg");
    if (!cg) {
      cg = document.createElement("colgroup");
      cg.className = "resize-cg";
      table.insertBefore(cg, table.firstChild);
    }
    cg.innerHTML = W.map((w) => '<col style="width:' + w + 'px">').join("");
    table.style.width = W.reduce((a, b) => a + b, 0) + "px";
  }

  // Restore saved widths
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved && saved.length === ths.length) {
      W = saved;
      applyCols();
    }
  } catch (e) {}

  // Auto-fit column
  function autoFitColumn(colIdx: number) {
    initCols();
    const PAD = 24;
    const measurer = document.createElement("span");
    measurer.style.cssText =
      "position:absolute;visibility:hidden;white-space:nowrap;font:inherit;";
    document.body.appendChild(measurer);

    let maxW = 0;
    const thEl = ths[colIdx] as HTMLElement;
    measurer.style.font = getComputedStyle(thEl).font;
    measurer.textContent = thEl.textContent?.trim() || "";
    maxW = Math.max(maxW, measurer.offsetWidth);

    const rows = table!.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      const cell = (row as HTMLTableRowElement).cells[colIdx];
      if (!cell) return;
      const input = cell.querySelector("input") as HTMLInputElement | null;
      if (input) {
        measurer.style.font = getComputedStyle(input).font;
        measurer.textContent = input.value || input.placeholder || "";
      } else {
        measurer.style.font = getComputedStyle(cell).font;
        measurer.textContent = cell.textContent?.trim() || "";
      }
      maxW = Math.max(maxW, measurer.offsetWidth);
    });
    measurer.remove();

    W![colIdx] = Math.max(30, maxW + PAD);
    applyCols();
    localStorage.setItem(storageKey, JSON.stringify(W));
  }

  ths.forEach((th, thIdx) => {
    (th as HTMLElement).classList.add("resizable");
    const handle = document.createElement("div");
    handle.className = "col-resize";
    th.appendChild(handle);

    let startX: number,
      startW: number,
      clickTimer: ReturnType<typeof setTimeout> | null = null,
      clickCount = 0;

    handle.addEventListener("mousedown", function (e) {
      e.preventDefault();
      e.stopPropagation();

      clickCount++;
      if (clickCount === 1) {
        clickTimer = setTimeout(() => {
          clickCount = 0;
        }, 300);
      }
      if (clickCount >= 2) {
        if (clickTimer) clearTimeout(clickTimer);
        clickCount = 0;
        autoFitColumn(thIdx);
        return;
      }

      initCols();
      startX = e.pageX;
      startW = W![thIdx];
      handle.classList.add("active");
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      const tableRect = table!.getBoundingClientRect();
      const guideLine = document.createElement("div");
      guideLine.style.cssText =
        "position:fixed;top:" +
        tableRect.top +
        "px;width:1px;height:" +
        tableRect.height +
        "px;background:var(--tl-primary, #185FA5);z-index:9999;pointer-events:none;";
      guideLine.style.left =
        (th as HTMLElement).getBoundingClientRect().right + "px";
      document.body.appendChild(guideLine);

      function onMove(e2: MouseEvent) {
        const newW = Math.max(30, startW + e2.pageX - startX);
        guideLine.style.left =
          ((th as HTMLElement).getBoundingClientRect().left + newW) + "px";
      }
      function onUp(e2: MouseEvent) {
        guideLine.remove();
        W![thIdx] = Math.max(30, startW + e2.pageX - startX);
        applyCols();
        handle.classList.remove("active");
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        localStorage.setItem(storageKey, JSON.stringify(W));
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    });
  });
}
