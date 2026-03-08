'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/apiClient';
import { Search, Shield, User, MoreHorizontal, ShieldCheck,
  UserCheck, Loader2, ReceiptText, Ticket } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';

interface UserData {
  ID: number;
  name: string;
  email: string;
  role: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const response = await apiClient.get(`/agent/search-customer?name=${searchTerm}`);
        setUsers(response.data || []);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchUsers();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // 🚀 The new role update handler
  const handleUpdateRole = async (userId: number, newRole: string) => {
    try {
      await apiClient.put(`/admin/users/${userId}/role`, { role: newRole });
      
      // Update the local state instantly so the UI feels snappy
      setUsers(users.map(u => u.ID === userId ? { ...u, role: newRole } : u));
      
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to update user role');
    }
  };

  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [userOrders, setUserOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const handleViewProfile = async (user: UserData) => {
    setSelectedUser(user);
    setIsSheetOpen(true);
    setOrdersLoading(true);
    
    try {
      const response = await apiClient.get(`/admin/users/${user.ID}/orders`);
      setUserOrders(response.data || []);
    } catch (error) {
      console.error('Failed to fetch user orders:', error);
    } finally {
      setOrdersLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">User Directory</h1>
          <p className="text-gray-500 mt-1">Manage customers, agents, and administrators.</p>
        </div>
        
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input 
            placeholder="Search by name..." 
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden min-h-[400px]">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 border-b">
            <tr>
              <th className="px-6 py-4 font-medium">Name</th>
              <th className="px-6 py-4 font-medium">Email</th>
              <th className="px-6 py-4 font-medium">Role</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
               <tr>
                 <td colSpan={4} className="p-8 text-center text-gray-500">
                   <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                 </td>
               </tr>
            ) : users.length > 0 ? (
              users.map((user) => (
                <tr key={user.ID} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-semibold text-gray-900 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold">
                        {user.name.charAt(0).toUpperCase()}
                    </div>
                    {user.name}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{user.email}</td>
                  <td className="px-6 py-4">
                    {user.role === 'admin' ? (
                        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 border-none flex w-min items-center gap-1">
                            <Shield className="w-3 h-3" /> Admin
                        </Badge>
                    ) : user.role === 'agent' ? (
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-none flex w-min items-center gap-1">
                            <ShieldCheck className="w-3 h-3" /> Agent
                        </Badge>
                    ) : (
                        <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 border-none flex w-min items-center gap-1">
                            <User className="w-3 h-3" /> Customer
                        </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    
                    {/* 🚀 THE NEW DROPDOWN MENU */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-gray-400 hover:text-blue-600">
                          <MoreHorizontal className="w-5 h-5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>Account Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {/* 🚀 Add this new item right after the Separator */}
                        <DropdownMenuItem onClick={() => handleViewProfile(user)} className="cursor-pointer font-medium">
                          <User className="w-4 h-4 mr-2 text-gray-700" /> View Profile & Orders
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        
                        {/* Only show promotion options if they aren't already that role */}
                        {user.role !== 'admin' && (
                          <DropdownMenuItem onClick={() => handleUpdateRole(user.ID, 'admin')} className="cursor-pointer">
                            <Shield className="w-4 h-4 mr-2 text-purple-600" /> Make Admin
                          </DropdownMenuItem>
                        )}
                        {user.role !== 'agent' && (
                          <DropdownMenuItem onClick={() => handleUpdateRole(user.ID, 'agent')} className="cursor-pointer">
                            <ShieldCheck className="w-4 h-4 mr-2 text-blue-600" /> Make Agent
                          </DropdownMenuItem>
                        )}
                        {user.role !== 'customer' && (
                          <DropdownMenuItem onClick={() => handleUpdateRole(user.ID, 'customer')} className="cursor-pointer">
                            <UserCheck className="w-4 h-4 mr-2 text-gray-600" /> Revoke to Customer
                          </DropdownMenuItem>
                        )}
                        
                      </DropdownMenuContent>
                    </DropdownMenu>

                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">
                  No users found matching "{searchTerm}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* 🟢 USER PROFILE SLIDE-OUT PANEL */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto bg-white px-4">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                  {selectedUser?.name?.charAt(0).toUpperCase()}
              </div>
              <div>
                {selectedUser?.name}
                <div className="text-sm font-normal text-gray-500">{selectedUser?.email}</div>
              </div>
            </SheetTitle>
            <SheetDescription>Account Role: <span className="uppercase font-bold text-gray-700">{selectedUser?.role}</span></SheetDescription>
          </SheetHeader>

          {ordersLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
          ) : (
            <div className="space-y-6 text-gray-800 mt-4">
              <h3 className="font-bold text-lg flex items-center gap-2 border-b pb-2">
                <ReceiptText className="w-5 h-5 text-gray-400" /> Order History ({userOrders.length})
              </h3>
              
              <div className="space-y-4">
                {userOrders.map((order: any) => (
                  <div key={order.id} className="p-4 bg-gray-50 border border-gray-100 rounded-xl space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-mono text-gray-500">Order #{order.id}</span>
                        <div className="font-bold text-green-600">RM {order.total_amount?.toFixed(2)}</div>
                      </div>
                      <Badge className={order.status === 'paid' ? 'bg-green-100 text-green-700 hover:bg-green-100 border-none' : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-none'}>
                        {order.status.toUpperCase()}
                      </Badge>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-gray-200">
                      {order.tickets?.map((ticket: any) => (
                        <div key={ticket.id} className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2">
                            <Ticket className="w-3 h-3 text-blue-500" />
                            <span className="font-medium">{ticket.event?.name || 'Unknown Event'}</span>
                          </div>
                          <span className="text-gray-500 text-xs">{ticket.category}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {userOrders.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-8">This user hasn't purchased any tickets yet.</p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}