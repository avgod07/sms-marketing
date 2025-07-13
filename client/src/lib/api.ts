import { apiRequest, apiMutation } from "./queryClient";

export const api = {
  get: async (url: string) => {
    const response = await apiRequest({ method: "GET", url });
    return response.json();
  },

  post: async (url: string, data?: any) => {
    return apiMutation({ method: "POST", url, data });
  },

  put: async (url: string, data?: any) => {
    return apiMutation({ method: "PUT", url, data });
  },

  delete: async (url: string) => {
    const response = await apiRequest({ method: "DELETE", url });
    return response.json();
  },
};
