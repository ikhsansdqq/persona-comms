import { getMonthlyExpenses, getRecords } from '@/lib/storage/d1';

export const dynamic = 'force-dynamic';

const CHAT_ID = Number(process.env.TELEGRAM_ALLOWED_CHAT_IDS?.split(',')[0] ?? '0');

export default async function Dashboard() {
  const [monthly, recent] = await Promise.all([
    getMonthlyExpenses(CHAT_ID),
    getRecords(CHAT_ID),
  ]);

  const counts = { todo: 0, task: 0, expense: 0, unknown: 0 };
  for (const r of recent) counts[r.type] = (counts[r.type] ?? 0) + 1;

  return (
    <main className="max-w-2xl mx-auto py-12 px-6 font-sans">
      <h1 className="text-2xl font-semibold mb-8">Personal Comms</h1>

      <section className="mb-10">
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3">All time</h2>
        <div className="grid grid-cols-4 gap-3">
          {(Object.entries(counts) as [string, number][]).map(([type, count]) => (
            <div key={type} className="rounded-lg border border-zinc-200 p-4 text-center">
              <p className="text-2xl font-semibold">{count}</p>
              <p className="text-sm text-zinc-500 capitalize mt-1">{type}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-zinc-500 uppercase tracking-wide mb-3">
          Expenses by month
        </h2>
        {monthly.length === 0 ? (
          <p className="text-zinc-400 text-sm">No expenses logged yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200">
                <th className="text-left py-2 font-medium text-zinc-500">Month</th>
                <th className="text-right py-2 font-medium text-zinc-500">Count</th>
                <th className="text-right py-2 font-medium text-zinc-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {monthly.map((row) => (
                <tr key={row.month} className="border-b border-zinc-100">
                  <td className="py-2">{row.month}</td>
                  <td className="py-2 text-right text-zinc-500">{row.count}</td>
                  <td className="py-2 text-right font-medium">
                    {row.total != null ? row.total.toFixed(2) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
