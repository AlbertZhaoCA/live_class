export interface UserAccount {
  id: string;
  email: string;
  name: string;
  role: 'teacher' | 'student' | 'observer';
  token: string;
  lastActive: number;
}

const ACCOUNTS_KEY = 'multi_accounts';
const ACTIVE_ACCOUNT_KEY = 'active_account_id';

export class MultiAccountManager {
  static getAccounts(): UserAccount[] {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem(ACCOUNTS_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  static addAccount(account: UserAccount): void {
    const accounts = this.getAccounts();
    const existing = accounts.findIndex(acc => acc.id === account.id);
    
    if (existing >= 0) {
      accounts[existing] = account;
    } else {
      accounts.push(account);
    }
    
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    this.setActiveAccount(account.id);
  }

  static removeAccount(accountId: string): void {
    const accounts = this.getAccounts().filter(acc => acc.id !== accountId);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    
    const activeId = this.getActiveAccountId();
    if (activeId === accountId) {
      // 如果删除的是当前活跃账户，切换到第一个账户
      if (accounts.length > 0) {
        this.setActiveAccount(accounts[0].id);
      } else {
        localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
      }
    }
  }

  static getActiveAccountId(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
  }

  static setActiveAccount(accountId: string): void {
    localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
    // 更新最后活跃时间
    const accounts = this.getAccounts();
    const account = accounts.find(acc => acc.id === accountId);
    if (account) {
      account.lastActive = Date.now();
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    }
  }

  static getActiveAccount(): UserAccount | null {
    const activeId = this.getActiveAccountId();
    if (!activeId) return null;
    
    const accounts = this.getAccounts();
    return accounts.find(acc => acc.id === activeId) || null;
  }

  static switchAccount(accountId: string): boolean {
    const accounts = this.getAccounts();
    const account = accounts.find(acc => acc.id === accountId);
    
    if (account) {
      this.setActiveAccount(accountId);
      return true;
    }
    return false;
  }

  static clearAll(): void {
    localStorage.removeItem(ACCOUNTS_KEY);
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY);
  }

  static hasAccounts(): boolean {
    return this.getAccounts().length > 0;
  }

  static findAccountByEmail(email: string): UserAccount | null {
    const accounts = this.getAccounts();
    return accounts.find(acc => acc.email === email) || null;
  }
}
