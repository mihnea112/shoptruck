export default function AdminDashboardPage() {
  const kpis = [
    {
      label: "Comenzi azi",
      value: "12",
      sub: "+3 față de ieri",
    },
    {
      label: "Venit azi",
      value: "7.430 RON",
      sub: "+18% vs săptămâna trecută",
    },
    {
      label: "Produse în promoție",
      value: "24",
      sub: "Lichidări stoc · Etrifix / Breckner",
    },
    {
      label: "Stoc critic",
      value: "9",
      sub: "Sub limita minimă setată",
    },
  ];

  const latestOrders = [
    {
      id: "#AT-2025-0012",
      customer: "SC TransLogistic SRL",
      total: "3.210 RON",
      status: "Plătită",
    },
    {
      id: "#AT-2025-0011",
      customer: "Popescu Ion",
      total: "780 RON",
      status: "În curs de procesare",
    },
    {
      id: "#AT-2025-0010",
      customer: "Rapid Cargo SRL",
      total: "1.980 RON",
      status: "Expediată",
    },
  ];

  return (
    <div className="space-y-8">
      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-5 shadow-sm"
          >
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {kpi.label}
            </div>
            <div className="mt-3 text-2xl font-semibold text-slate-900">
              {kpi.value}
            </div>
            <div className="mt-1 text-xs font-medium text-orange-500">
              {kpi.sub}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Comenzi recente
            </h2>
            <p className="text-xs text-slate-500">
              Ultimele comenzi intrate în sistem.
            </p>
          </div>
          <button className="rounded-full border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:border-slate-900 hover:text-slate-900 transition">
            Vezi toate
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
              <tr>
                <th className="px-3 py-2 font-medium">Comandă</th>
                <th className="px-3 py-2 font-medium">Client</th>
                <th className="px-3 py-2 font-medium">Total</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {latestOrders.map((order) => (
                <tr key={order.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-3 font-medium text-slate-900">
                    {order.id}
                  </td>
                  <td className="px-3 py-3 text-slate-700">{order.customer}</td>
                  <td className="px-3 py-3 text-slate-800">{order.total}</td>
                  <td className="px-3 py-3">
                    <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700">
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}