import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-xl shadow-xl p-8 space-y-8 text-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Restaurant Scheduler
          </h1>
          <p className="mt-2 text-slate-500">Select your portal to continue</p>
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          <Link href="/manager/schedule" className="block w-full py-4 px-6 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg">
            Manager Portal
          </Link>
          <Link href="/employee" className="block w-full py-4 px-6 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-900 transition-colors shadow-md hover:shadow-lg">
            Employee Portal
          </Link>
        </div>
      </div>
    </div>
  )
}
