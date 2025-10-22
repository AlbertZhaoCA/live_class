'use client';

import { useEffect, useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { MultiAccountManager, UserAccount } from '@/lib/multiAccountManager';

export default function MultiAccountSwitcher() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [accounts, setAccounts] = useState<UserAccount[]>([]);
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newCredentials, setNewCredentials] = useState({ email: '', password: '' });
  const [switchingAccount, setSwitchingAccount] = useState<UserAccount | null>(null);
  const [switchPassword, setSwitchPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    if (session?.user && status === 'authenticated') {
      const user = session.user as any;
      const account: UserAccount = {
        id: user.id,
        email: user.email || '',
        name: user.name || '',
        role: user.role,
        token: '', // NextAuth 会管理 token
        lastActive: Date.now(),
      };
      MultiAccountManager.addAccount(account);
      loadAccounts();
    }
  }, [session, status]);

  const loadAccounts = () => {
    const accs = MultiAccountManager.getAccounts();
    const activeId = MultiAccountManager.getActiveAccountId();
    setAccounts(accs);
    setActiveAccountId(activeId);
  };

  const handleAddAccount = async () => {
    if (!newCredentials.email || !newCredentials.password) {
      toast.error('Please enter email and password');
      return;
    }

    setIsLoading(true);
    try {
      const result = await signIn('credentials', {
        email: newCredentials.email,
        password: newCredentials.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error('Login failed: ' + result.error);
      } else {
        toast.success('Account added!');
        setNewCredentials({ email: '', password: '' });
        setShowAddAccount(false);
        setTimeout(() => {
          loadAccounts();
          router.refresh();
        }, 500);
      }
    } catch (error) {
      toast.error('Failed to add account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchAccount = (accountId: string) => {
    const targetAccount = accounts.find(acc => acc.id === accountId);
    if (!targetAccount) return;

    setSwitchingAccount(targetAccount);
    setSwitchPassword('');
  };

  const handleConfirmSwitch = async () => {
    if (!switchingAccount || !switchPassword) {
      toast.error('Please enter password');
      return;
    }

    setIsLoading(true);
    
    try {
      const testResult = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: switchingAccount.email,
          password: switchPassword,
        }),
      });

      if (!testResult.ok) {
        toast.error('Password incorrect');
        setSwitchPassword('');
        setIsLoading(false);
        return;
      }

      await signOut({ redirect: false });
      
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const result = await signIn('credentials', {
        email: switchingAccount.email,
        password: switchPassword,
        redirect: false,
      });

      if (result?.error) {
        toast.error('Login failed, please try again');
        setSwitchPassword('');
        setTimeout(() => router.push('/login'), 1000);
      } else {
        MultiAccountManager.setActiveAccount(switchingAccount.id);
        setActiveAccountId(switchingAccount.id);
        
        toast.success(`Switched to ${switchingAccount.name}`);
        setSwitchingAccount(null);
        setSwitchPassword('');
        setShowSwitcher(false);
        
        router.push('/dashboard');
        setTimeout(() => router.refresh(), 100);
      }
    } catch (error) {
      toast.error('Switch failed');
      setSwitchPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveAccount = (accountId: string) => {
    if (accounts.length === 1) {
      toast.error('Cannot remove the only account');
      return;
    }
    
    MultiAccountManager.removeAccount(accountId);
    loadAccounts();
    toast.success('Account removed');
    
    if (accountId === activeAccountId) {
      router.refresh();
    }
  };

  const getAccountIcon = (role: string) => {
    switch (role) {
      case 'administrator': return '👑';
      case 'teacher': return '👨‍🏫';
      case 'student': return '👨‍🎓';
      case 'observer': return '👁️';
      default: return '👤';
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'administrator': return 'Administrator';
      case 'teacher': return 'Teacher';
      case 'student': return 'Student';
      case 'observer': return 'Observer';
      default: return 'Unknown';
    }
  };

  if (status === 'loading' || !session) return null;

  const currentUser = session.user as any;
  const activeAccount = accounts.find(acc => acc.id === activeAccountId) || accounts[0];

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowSwitcher(!showSwitcher)}
          className="flex items-center gap-2 px-3 py-2 bg-white border-2 border-gray-200 rounded-lg hover:border-primary-500 transition"
        >
          <div className="w-8 h-8 bg-primary-500 rounded-full flex items-center justify-center text-white font-semibold">
            {getAccountIcon(currentUser.role)}
          </div>
          <div className="text-left">
            <div className="text-sm font-medium">{currentUser.name}</div>
            <div className="text-xs text-gray-500">{getRoleText(currentUser.role)}</div>
          </div>
          {accounts.length > 1 && (
            <div className="ml-2 px-2 py-0.5 bg-primary-100 text-primary-700 text-xs rounded-full">
              {accounts.length}
            </div>
          )}
          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showSwitcher && (
          <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border-2 border-gray-100 z-50">
            <div className="p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold text-gray-800">Logged in Accounts</h3>
                <button
                  onClick={() => setShowSwitcher(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {/* 账户列表 */}
              <div className="space-y-2 mb-3">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className={`p-3 rounded-lg border-2 transition cursor-pointer ${
                      account.id === currentUser.id
                        ? 'bg-primary-50 border-primary-500'
                        : 'bg-gray-50 border-gray-200 hover:border-primary-300'
                    }`}
                    onClick={() => account.id !== currentUser.id && handleSwitchAccount(account.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center text-white text-lg">
                        {getAccountIcon(account.role)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{account.name}</div>
                        <div className="text-xs text-gray-500">{account.email}</div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          {getRoleText(account.role)}
                          {account.id === currentUser.id && (
                            <span className="ml-2 text-green-600">● Current</span>
                          )}
                        </div>
                      </div>
                      {account.id !== currentUser.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveAccount(account.id);
                          }}
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50 rounded"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Account */}
              {showAddAccount ? (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm font-medium mb-2">Add New Account</div>
                  <input
                    type="email"
                    placeholder="Email"
                    value={newCredentials.email}
                    onChange={(e) => setNewCredentials({ ...newCredentials, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={newCredentials.password}
                    onChange={(e) => setNewCredentials({ ...newCredentials, password: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddAccount}
                      disabled={isLoading}
                      className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm disabled:opacity-50"
                    >
                      {isLoading ? 'Adding...' : 'Add'}
                    </button>
                    <button
                      onClick={() => setShowAddAccount(false)}
                      className="flex-1 py-2 border rounded-lg hover:bg-gray-50 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddAccount(true)}
                  className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary-500 hover:text-primary-600 text-sm"
                >
                  + Add Another Account
                </button>
              )}

              <div className="mt-3 pt-3 border-t">
                <button
                  onClick={async () => {
                    await signOut({ redirect: true, callbackUrl: '/login' });
                    MultiAccountManager.clearAll();
                  }}
                  className="w-full py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Sign Out All Accounts
                </button>
              </div>

              <div className="mt-2 text-xs text-gray-400 text-center">
                💡 Login to multiple accounts and switch quickly
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 切换账户密码确认对话框 */}
      {switchingAccount && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Switch Account</h3>
            <p className="text-sm text-gray-600 mb-4">
              Switching to <span className="font-medium">{switchingAccount.name}</span> ({switchingAccount.email})
            </p>
            <p className="text-sm text-gray-600 mb-4">
              Please enter the password for this account:
            </p>
            <input
              type="password"
              placeholder="Password"
              value={switchPassword}
              onChange={(e) => setSwitchPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirmSwitch()}
              className="w-full px-4 py-2 border rounded-lg mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSwitchingAccount(null);
                  setSwitchPassword('');
                }}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSwitch}
                disabled={isLoading || !switchPassword}
                className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {isLoading ? 'Switching...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
