'use client';

import { useState } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import toast from 'react-hot-toast';

interface Account {
  email: string;
  password: string;
  name: string;
  role: string;
}

// 保存的测试账户（实际应用中应该加密存储或使用其他方式）
const SAVED_ACCOUNTS_KEY = 'saved_test_accounts';

export default function AccountSwitcher() {
  const { data: session } = useSession();
  const [showModal, setShowModal] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<Account[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(SAVED_ACCOUNTS_KEY);
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ email: '', password: '', name: '', role: '' });

  const saveAccount = (account: Account) => {
    const accounts = [...savedAccounts, account];
    setSavedAccounts(accounts);
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
  };

  const removeAccount = (email: string) => {
    const accounts = savedAccounts.filter(acc => acc.email !== email);
    setSavedAccounts(accounts);
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(accounts));
  };

  const switchAccount = async (account: Account) => {
    try {
      // 先退出当前账户
      await signOut({ redirect: false });
      
      // 稍微延迟一下确保退出完成
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // 登录新账户
      const result = await signIn('credentials', {
        email: account.email,
        password: account.password,
        redirect: false,
      });

      if (result?.error) {
        toast.error('切换账户失败: ' + result.error);
      } else {
        toast.success(`已切换到 ${account.name} (${account.role})`);
        setShowModal(false);
        window.location.href = '/dashboard';
      }
    } catch (error) {
      toast.error('切换账户出错');
    }
  };

  const addCurrentAccount = () => {
    if (session?.user) {
      const currentAccount = {
        email: session.user.email || '',
        password: '', // 不保存密码，需要用户输入
        name: session.user.name || '',
        role: (session.user as any).role || '',
      };
      setNewAccount(currentAccount);
      setShowAddAccount(true);
    }
  };

  const saveNewAccount = () => {
    if (!newAccount.email || !newAccount.password) {
      toast.error('请填写完整信息');
      return;
    }
    saveAccount(newAccount as Account);
    setNewAccount({ email: '', password: '', name: '', role: '' });
    setShowAddAccount(false);
    toast.success('账户已保存');
  };

  if (!session) return null;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        title="切换账户"
      >
        👤 切换账户
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">账户切换</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            {/* 当前账户 */}
            <div className="mb-6 p-4 bg-green-50 rounded-lg border-2 border-green-500">
              <div className="text-sm text-gray-600 mb-1">当前登录</div>
              <div className="font-semibold">{session.user?.name}</div>
              <div className="text-sm text-gray-600">{session.user?.email}</div>
              <div className="text-xs text-green-700 mt-1">
                {(session.user as any).role === 'teacher' ? '👨‍🏫 教师' : 
                 (session.user as any).role === 'student' ? '👨‍🎓 学生' : '👁️ 旁听'}
              </div>
            </div>

            {/* 保存的账户列表 */}
            {savedAccounts.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">已保存的账户</div>
                <div className="space-y-2">
                  {savedAccounts.map((account, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-gray-50 rounded-lg border hover:border-primary-500 transition"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-medium">{account.name}</div>
                          <div className="text-sm text-gray-600">{account.email}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {account.role === 'teacher' ? '👨‍🏫 教师' : 
                             account.role === 'student' ? '👨‍🎓 学生' : '👁️ 旁听'}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => switchAccount(account)}
                            className="px-3 py-1 text-sm bg-primary-600 text-white rounded hover:bg-primary-700"
                          >
                            切换
                          </button>
                          <button
                            onClick={() => removeAccount(account.email)}
                            className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 添加账户表单 */}
            {showAddAccount ? (
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="text-sm font-medium mb-3">添加新账户</div>
                <div className="space-y-3">
                  <input
                    type="email"
                    placeholder="邮箱"
                    value={newAccount.email}
                    onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <input
                    type="password"
                    placeholder="密码"
                    value={newAccount.password}
                    onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <input
                    type="text"
                    placeholder="姓名"
                    value={newAccount.name}
                    onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                  <select
                    value={newAccount.role}
                    onChange={(e) => setNewAccount({ ...newAccount, role: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  >
                    <option value="">选择角色</option>
                    <option value="teacher">教师</option>
                    <option value="student">学生</option>
                    <option value="observer">旁听</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={saveNewAccount}
                      className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setShowAddAccount(false)}
                      className="flex-1 py-2 border rounded-lg hover:bg-gray-50 text-sm"
                    >
                      取消
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={addCurrentAccount}
                className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-primary-500 hover:text-primary-600 text-sm"
              >
                + 添加账户到快速切换
              </button>
            )}

            <div className="mt-4 text-xs text-gray-500 text-center">
              💡 提示：保存账户后可以快速切换，方便测试
            </div>
          </div>
        </div>
      )}
    </>
  );
}
