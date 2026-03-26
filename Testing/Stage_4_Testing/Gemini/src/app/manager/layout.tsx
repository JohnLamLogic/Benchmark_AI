import Link from 'next/link'

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-200 text-white min-h-screen shadow-xl">
        <div className="p-6">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">Manager Portal</h2>
        </div>
        <nav className="flex flex-col gap-2 px-4 mt-6">
          <Link href="/manager/schedule" className="px-4 py-3 rounded hover:bg-slate-800 transition-colors">
            Weekly Schedule
          </Link>
          <Link href="/manager/employees" className="px-4 py-3 rounded hover:bg-slate-800 transition-colors">
            Manage Employees
          </Link>
          <Link href="/manager/requests" className="px-4 py-3 rounded hover:bg-slate-800 transition-colors">
            Time Off Requests
          </Link>
          <Link href="/manager/hours" className="px-4 py-3 rounded hover:bg-slate-800 transition-colors">
            Hours & Pay Tracker
          </Link>
        </nav>
        <div className="p-6 mt-auto absolute bottom-0">
          <Link href="/" className="text-slate-400 hover:text-white transition-colors">
            &larr; Exit to Home
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto w-full">
        {children}
      </main>
    </div>
  )
}
