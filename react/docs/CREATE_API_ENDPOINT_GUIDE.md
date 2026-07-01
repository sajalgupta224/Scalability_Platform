# API Endpoint Creation Guide

## Table of Contents
1. [Creating a New API Endpoint](#creating-a-new-api-endpoint)

---

## Overview

This guide explains how to create and use API endpoints in our React application using our centralized API pattern. **Always use the established pattern instead of direct `fetch()` or `axios` calls.**

## Creating a New API Endpoint

### Step 1: Define Types

Create or update types in [src/types/api.types.ts](../src/types/api.types.ts) or create a dedicated types file:

```typescript
// src/types/user.types.ts
export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  role: string;
}

export interface UpdateUserRequest {
  name?: string;
  role?: string;
}
```

### Step 2: Create Endpoint File

Create a new file in `src/api/endpoints/` following the naming convention: `[domain].api.ts`

```typescript
// src/api/endpoints/user.api.ts
import { apiClient } from '../client';
import type { User, CreateUserRequest, UpdateUserRequest } from '../../types/user.types';

export const UserAPI = {
  /**
   * Get all users
   */
  getUsers: async (): Promise<User[]> => {
    return apiClient.get<User[]>('/users');
  },

  /**
   * Get a single user by ID
   */
  getUserById: async (userId: string): Promise<User> => {
    return apiClient.get<User>(`/users/${userId}`);
  },

  /**
   * Create a new user
   */
  createUser: async (userData: CreateUserRequest): Promise<User> => {
    return apiClient.post<User, CreateUserRequest>('/users', userData);
  },

  /**
   * Update an existing user
   */
  updateUser: async (userId: string, userData: UpdateUserRequest): Promise<User> => {
    return apiClient.put<User, UpdateUserRequest>(`/users/${userId}`, userData);
  },

  /**
   * Delete a user
   */
  deleteUser: async (userId: string): Promise<void> => {
    return apiClient.delete<void>(`/users/${userId}`);
  },
};
```

### Step 3: Export from Index (Optional)

You can optionally export from [src/api/index.ts](../src/api/index.ts) for easier imports:

```typescript
// src/api/index.ts
export { UserAPI } from './endpoints/user.api';
```

### Real-World Example

Here's how the [ChatbotAPI](../src/api/endpoints/chatbot.api.ts:10-89) is implemented:

```typescript
export const ChatbotAPI = {
  createChatbot: async (chatbotObj: ChatbotCreateRequest): Promise<SaveChatbotResponse[]> => {
    const chatbot = sanitizeChatbot(chatbotObj);
    return apiClient.post<SaveChatbotResponse[]>('/chatbots/create', chatbot);
  },

  getChatbots: async (): Promise<ChatbotEntity[]> => {
    return apiClient.get<ChatbotEntity[]>('/chatbots');
  },

  getChatbotById: async (chatbotId: string): Promise<ChatbotEntity> => {
    return apiClient.get<ChatbotEntity>(`/chatbots/${chatbotId}`);
  },

  updateChatbot: async (chatbotId: string, chatbotObj: ChatbotUpdateRequest): Promise<ChatbotEntity> => {
    const chatbot = sanitizeChatbot(chatbotObj);
    return apiClient.put<ChatbotEntity>(`/chatbots/${chatbotId}`, chatbot);
  },

  deleteChatbot: async (chatbotId: string): Promise<void> => {
    return apiClient.delete<void>(`/chatbots/${chatbotId}`);
  },
};
```

---

### Key Principles

1. **Always use `apiClient`** - Never use `fetch()` or raw `axios`
2. **Type everything** - Request, response, and error types
3. **One endpoint file per domain** - Keep related APIs together
4. **Let apiClient handle errors** - Don't duplicate error handling
5. **Use errorConfig for special cases** - Skip notifications when appropriate
6. **Keep URLs relative** - Base URL is configured globally

### Need Help?

- Check existing endpoints: [src/api/endpoints/chatbot.api.ts](../src/api/endpoints/chatbot.api.ts)
- Review error handling: [src/api/errorHandler.ts](../src/api/errorHandler.ts)
- See real usage: [src/context/ChatbotContext.tsx](../src/context/ChatbotContext.tsx)
- API types reference: [src/types/api.types.ts](../src/types/api.types.ts)

---

**Last Updated:** 2025-12-16
