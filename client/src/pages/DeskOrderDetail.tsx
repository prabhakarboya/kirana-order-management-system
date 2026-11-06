import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Download,
  Sparkles,
  Edit3,
  Save,
  Plus,
  Trash2,
  AlertTriangle,
  FileCode,
  FileSpreadsheet,
  Building2,
  Clock,
  History,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { OrderRecord, RetailerProfile } from '../types';

export const DeskOrderDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [retailer, setRetailer] = useState<RetailerProfile | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editableLines, setEditableLines] = useState<Array<{ skuCode: string; qtyCases: number }>>([]);
  const [learnAlias, setLearnAlias] = useState(true);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchOrderDetail();
  }, [id]);

  const fetchOrderDetail = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/desk/orders/${id}`);
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
        setRetailer(data.retailer);
        setAuditLogs(data.auditLogs);
        setEditableLines(
          data.order.lines.map((l: any) => ({
            skuCode: l.skuCode,
            qtyCases: l.qtyCases,
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    try {
      const res = await fetch(`/api/desk/orders/${id}/approve`, { method: 'POST' });
      if (res.ok) {
        setActionMessage('Order approved successfully! Ready for warehouse packing.');
        fetchOrderDetail();
      }
    } catch {
      alert('Failed to approve order');
    }
  };

  const handleReject = async () => {
    const reason = window.prompt('Enter rejection reason (e.g. stock-out, retailer cancelled):');
    if (!reason) return;

    try {
      const res = await fetch(`/api/desk/orders/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        setActionMessage(`Order rejected: ${reason}`);
        fetchOrderDetail();
      }
    } catch {
      alert('Failed to reject order');
    }
  };

  const handleSaveLineEdits = async () => {
    try {
      const aliasesToLearn: Array<{ phrase: string; skuCode: string }> = [];
      if (learnAlias && order?.rawMessage) {
        // Automatically link raw message keywords as learned aliases
        aliasesToLearn.push({
          phrase: order.rawMessage.slice(0, 30),
          skuCode: editableLines[0]?.skuCode || 'SKU-BS-075',
        });
      }

      const res = await fetch(`/api/desk/orders/${id}/update-lines`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lines: editableLines,
          learnAliases: aliasesToLearn,
        }),
      });

      if (res.ok) {
        setIsEditing(false);
        setActionMessage('Lines updated and schemes recalculated. Retailer alias learned!');
        fetchOrderDetail();
      }
    } catch {
      alert('Failed to update order lines');
    }
  };

  const handleDownloadTally = (format: 'xml' | 'csv') => {
    window.open(`/api/desk/orders/${id}/export-tally?format=${format}`, '_blank');
    // Refresh to show tally exported badge
    setTimeout(fetchOrderDetail, 1000);
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500 animate-pulse">Loading order details...</div>;
  }

  if (!order) {
    return <div className="p-8 text-center text-xs text-rose-500">Order not found.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24">
      {/* Back button */}
      <Link
        to="/desk"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 mb-4 transition"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Order Queue</span>
      </Link>

      {actionMessage && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center justify-between">
          <span>{actionMessage}</span>
          <button onClick={() => setActionMessage(null)} className="text-emerald-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Order Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold font-mono text-slate-900">
                {order.orderNumber}
              </h1>
              <span
                className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                  order.status === 'APPROVED'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : order.status === 'PENDING_DESK_REVIEW'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-rose-100 text-rose-800 border border-rose-200'
                }`}
              >
                {order.status}
              </span>
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                Source: {order.source}
              </span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Received on {new Date(order.createdAt).toLocaleString('en-IN')}
            </div>
          </div>

          {/* Tally Export Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDownloadTally('xml')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm"
              title="Download Tally ERP 9 / TallyPrime XML Voucher"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>{t('exportTallyXml')}</span>
            </button>
            <button
              onClick={() => handleDownloadTally('csv')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition"
              title="Download CSV for Excel / ERP"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{t('exportTallyCsv')}</span>
            </button>
          </div>
        </div>

        {/* Retailer Details & Credit Exposure */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">Retailer Store</div>
            <div className="font-bold text-slate-900 text-sm">{order.retailerName}</div>
            <div className="text-slate-500 mt-0.5">{retailer?.address}</div>
            <div className="text-slate-500 mt-0.5">Contact: +91 {retailer?.phone}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
            <div className="text-[10px] uppercase font-bold text-slate-400 mb-1">
              Credit Limit & Exposure
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500">Credit Limit:</span>
              <span className="font-semibold text-slate-800">
                ₹{retailer?.creditLimit.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-500">Current Outstanding:</span>
              <span className="font-semibold text-slate-800">
                ₹{retailer?.creditUsed.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="flex justify-between py-0.5 border-t border-slate-200 mt-1 pt-1 font-bold">
              <span>Available Margin:</span>
              <span
                className={
                  (retailer?.creditLimit || 0) - (retailer?.creditUsed || 0) >= 0
                    ? 'text-emerald-700'
                    : 'text-rose-600'
                }
              >
                ₹{((retailer?.creditLimit || 0) - (retailer?.creditUsed || 0)).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>

        {/* AI Raw Message & Interpretation Section */}
        {order.rawMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-xs">
            <div className="flex items-center gap-1.5 text-amber-900 font-bold mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>AI Message Capture Transcript</span>
            </div>
            <div className="font-mono text-slate-800 italic bg-white/80 p-2 rounded-lg border border-amber-100">
              "{order.rawMessage}"
            </div>
            <div className="text-[11px] text-amber-800 mt-1.5">
              AI automatically normalized Hinglish slang, verified scheme slabs, and queued for human desk authorization.
            </div>
          </div>
        )}
      </div>

      {/* Order Lines & Scheme Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-slate-900 text-base">Order Items & Scheme Application</h2>
          {order.status === 'PENDING_DESK_REVIEW' && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditing ? 'Cancel Edit' : 'Edit Order Lines'}</span>
            </button>
          )}
        </div>

        {isEditing ? (
          /* Line Edit Mode */
          <div className="space-y-3">
            {editableLines.map((line, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <select
                  value={line.skuCode}
                  onChange={(e) => {
                    const newSku = e.target.value;
                    setEditableLines((prev) =>
                      prev.map((l, i) => (i === idx ? { ...l, skuCode: newSku } : l))
                    );
                  }}
                  className="flex-1 p-2 border border-slate-200 rounded-lg text-xs font-semibold"
                >
                  <option value="SKU-BS-075">SKU-BS-075: Glucose biscuit 75 g, case of 96</option>
                  <option value="SKU-DT-1KG">SKU-DT-1KG: Detergent powder 1 kg, case of 20</option>
                  <option value="SKU-TE-250">SKU-TE-250: Tea leaf 250 g, case of 40</option>
                </select>

                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    value={line.qtyCases}
                    onChange={(e) => {
                      const qty = parseInt(e.target.value) || 0;
                      setEditableLines((prev) =>
                        prev.map((l, i) => (i === idx ? { ...l, qtyCases: qty } : l))
                      );
                    }}
                    className="w-16 p-2 border border-slate-200 rounded-lg text-xs font-bold text-center"
                  />
                  <span className="text-xs text-slate-500">{t('cases')}</span>
                </div>

                <button
                  onClick={() => setEditableLines((prev) => prev.filter((_, i) => i !== idx))}
                  className="text-rose-500 hover:text-rose-700 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="learnAlias"
                checked={learnAlias}
                onChange={(e) => setLearnAlias(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded"
              />
              <label htmlFor="learnAlias" className="text-xs text-slate-700 font-medium">
                Save correction as learned alias for this retailer (improves future AI capture accuracy)
              </label>
            </div>

            <div className="flex gap-2 pt-3">
              <button
                onClick={handleSaveLineEdits}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Lines & Recalculate Schemes</span>
              </button>
            </div>
          </div>
        ) : (
          /* View Mode */
          <div className="space-y-3">
            {order.lines.map((line, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between sm:items-center gap-2"
              >
                <div>
                  <div className="font-bold text-slate-900 text-xs sm:text-sm">
                    {line.skuName}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    {line.qtyCases} {t('cases')} @ ₹{line.unitPrice.toFixed(2)} / case
                    {line.freeCases > 0 && (
                      <span className="font-bold text-emerald-700 ml-2">
                        +{line.freeCases} Free Goods
                      </span>
                    )}
                  </div>
                  {line.schemeApplied && (
                    <div className="text-[10px] text-emerald-800 font-medium mt-1 bg-emerald-50 inline-block px-2 py-0.5 rounded border border-emerald-200">
                      {line.schemeApplied}
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900">
                    ₹{line.lineTotal.toFixed(2)}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    GST ({line.gstRate}%): ₹{line.gstAmount.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}

            {/* Totals Summary */}
            <div className="mt-4 pt-4 border-t border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal (Excl. Tax):</span>
                <span>₹{order.subtotal.toFixed(2)}</span>
              </div>
              {order.discountTotal > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Distributor Scheme Discount:</span>
                  <span>-₹{order.discountTotal.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>GST (CGST + SGST):</span>
                <span>+₹{order.gstTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 pt-2 border-t border-slate-100">
                <span>Grand Total:</span>
                <span>₹{order.grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Desk Action Buttons (Approve / Reject) */}
        {order.status === 'PENDING_DESK_REVIEW' && (
          <div className="mt-6 pt-4 border-t border-slate-200 flex flex-wrap gap-3 justify-end">
            <button
              onClick={handleReject}
              className="px-5 py-2.5 rounded-xl border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold transition flex items-center gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              <span>{t('reject')} Order</span>
            </button>
            <button
              onClick={handleApprove}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{t('approve')} Order for Dispatch</span>
            </button>
          </div>
        )}
      </div>

      {/* Audit Log Trail */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
          <History className="w-3.5 h-3.5 text-slate-400" />
          <span>Audit Log & Traceability</span>
        </h3>
        <div className="space-y-2 text-xs">
          {auditLogs.length === 0 ? (
            <div className="text-slate-400">No modifications logged yet.</div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 flex justify-between">
                <div>
                  <span className="font-bold text-slate-800">{log.action}: </span>
                  <span className="text-slate-600">{log.details}</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">By {log.userName}</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
