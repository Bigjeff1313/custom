import { supabase } from "@/integrations/supabase/client";

// API helper functions for edge functions

// Links API
export const linksApi = {
  create: async (data: {
    originalUrl: string;
    customDomain?: string;
    planType?: 'basic' | 'pro';
    customCode?: string;
  }) => {
    const { data: result, error } = await supabase.functions.invoke('links-api', {
      body: { action: 'create', data }
    });
    if (error) throw error;
    return result;
  },

  get: async (shortCode: string) => {
    const { data: result, error } = await supabase.functions.invoke('links-api', {
      body: { action: 'get', data: { shortCode } }
    });
    if (error) throw error;
    return result;
  },

  list: async (options?: { status?: string; limit?: number }) => {
    const { data: result, error } = await supabase.functions.invoke('links-api', {
      body: { action: 'list', data: options || {} }
    });
    if (error) throw error;
    return result;
  },

  update: async (id: string, data: { status?: string; customDomain?: string; originalUrl?: string }) => {
    const { data: result, error } = await supabase.functions.invoke('links-api', {
      body: { action: 'update', data: { id, ...data } }
    });
    if (error) throw error;
    return result;
  },

  delete: async (id: string) => {
    const { data: result, error } = await supabase.functions.invoke('links-api', {
      body: { action: 'delete', data: { id } }
    });
    if (error) throw error;
    return result;
  },

  activate: async (shortCode: string) => {
    const { data: result, error } = await supabase.functions.invoke('links-api', {
      body: { action: 'activate', data: { shortCode } }
    });
    if (error) throw error;
    return result;
  },
};

// Payments API
export const paymentsApi = {
  create: async (data: {
    linkId: string;
    amount: number;
    currency: string;
    walletAddress: string;
  }) => {
    const { data: result, error } = await supabase.functions.invoke('payments-api', {
      body: { action: 'create', data }
    });
    if (error) throw error;
    return result;
  },

  verify: async (paymentId: string, transactionHash?: string) => {
    const { data: result, error } = await supabase.functions.invoke('payments-api', {
      body: { action: 'verify', data: { paymentId, transactionHash } }
    });
    if (error) throw error;
    return result;
  },

  get: async (paymentId: string) => {
    const { data: result, error } = await supabase.functions.invoke('payments-api', {
      body: { action: 'get', data: { paymentId } }
    });
    if (error) throw error;
    return result;
  },

  list: async (options?: { status?: string; limit?: number }) => {
    const { data: result, error } = await supabase.functions.invoke('payments-api', {
      body: { action: 'list', data: options || {} }
    });
    if (error) throw error;
    return result;
  },

  updateStatus: async (paymentId: string, status: string, transactionHash?: string) => {
    const { data: result, error } = await supabase.functions.invoke('payments-api', {
      body: { action: 'update-status', data: { paymentId, status, transactionHash } }
    });
    if (error) throw error;
    return result;
  },

  checkExpired: async () => {
    const { data: result, error } = await supabase.functions.invoke('payments-api', {
      body: { action: 'check-expired', data: {} }
    });
    if (error) throw error;
    return result;
  },
};

// Wallets API
export const walletsApi = {
  create: async (data: { currency: string; walletAddress: string; isActive?: boolean }) => {
    const { data: result, error } = await supabase.functions.invoke('wallets-api', {
      body: { action: 'create', data }
    });
    if (error) throw error;
    return result;
  },

  get: async (id: string) => {
    const { data: result, error } = await supabase.functions.invoke('wallets-api', {
      body: { action: 'get', data: { id } }
    });
    if (error) throw error;
    return result;
  },

  list: async (activeOnly?: boolean) => {
    const { data: result, error } = await supabase.functions.invoke('wallets-api', {
      body: { action: 'list', data: { activeOnly } }
    });
    if (error) throw error;
    return result;
  },

  update: async (id: string, data: { currency?: string; walletAddress?: string; isActive?: boolean }) => {
    const { data: result, error } = await supabase.functions.invoke('wallets-api', {
      body: { action: 'update', data: { id, ...data } }
    });
    if (error) throw error;
    return result;
  },

  delete: async (id: string) => {
    const { data: result, error } = await supabase.functions.invoke('wallets-api', {
      body: { action: 'delete', data: { id } }
    });
    if (error) throw error;
    return result;
  },

  toggleActive: async (id: string) => {
    const { data: result, error } = await supabase.functions.invoke('wallets-api', {
      body: { action: 'toggle-active', data: { id } }
    });
    if (error) throw error;
    return result;
  },
};

// Redirect API
export const redirectApi = {
  resolve: async (shortCode: string, domain?: string) => {
    const { data: result, error } = await supabase.functions.invoke('redirect', {
      body: { shortCode, domain }
    });
    if (error) throw error;
    return result;
  },
};

// Stats API
export const statsApi = {
  dashboard: async () => {
    const { data: result, error } = await supabase.functions.invoke('stats-api', {
      body: { action: 'dashboard' }
    });
    if (error) throw error;
    return result;
  },

  linkAnalytics: async () => {
    const { data: result, error } = await supabase.functions.invoke('stats-api', {
      body: { action: 'link-analytics' }
    });
    if (error) throw error;
    return result;
  },

  paymentAnalytics: async () => {
    const { data: result, error } = await supabase.functions.invoke('stats-api', {
      body: { action: 'payment-analytics' }
    });
    if (error) throw error;
    return result;
  },
};
