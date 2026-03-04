'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, CalendarDays, Ticket, Users,
    CheckSquare, ReceiptText } from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navLinks = [
    { name: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Transactions', href: '/dashboard/orders', icon: ReceiptText },
    { name: 'Manage Events', href: '/dashboard/events', icon: CalendarDays },
    { name: 'Promo Codes', href: '/dashboard/coupons', icon: Ticket },
    { name: 'Users & Agents', href: '/dashboard/users', icon: Users },
    { name: 'Gate Check-In', href: '/dashboard/checkin', icon: CheckSquare },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden text-gray-900">
      
      {/* 🧭 STATIC SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shadow-sm">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-black text-blue-600 tracking-tighter">NEPTUNE'S<br/>TIX.</h2>
          <p className="text-xs text-gray-400 mt-1 font-bold tracking-widest uppercase">Admin Portal</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;

            return (
              <Link 
                key={link.name} 
                href={link.href}
                className={`flex items-center gap-3 p-3 rounded-xl transition font-medium ${
                  isActive 
                    ? 'bg-blue-50 text-blue-700' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-blue-600'
                }`}
              >
                <Icon size={20} className={isActive ? "text-blue-600" : "text-gray-400"} />
                {link.name}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Snippet at the bottom */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
              A
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Admin User</p>
              <p className="text-xs text-gray-500">System Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* 📄 DYNAMIC MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
      
    </div>
  );
}