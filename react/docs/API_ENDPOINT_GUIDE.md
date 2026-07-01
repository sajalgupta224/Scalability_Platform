# API Endpoint Creation Guide

## Table of Contents
1. [Overview](#overview)
2. [Why Use the Centralized API Pattern?](#why-use-the-centralized-api-pattern)
3. [Architecture Overview](#architecture-overview)
4. [Using API Endpoints in Components](#using-api-endpoints-in-components)
5. [Error Handling](#error-handling)
6. [Advanced Patterns](#advanced-patterns)
7. [Common Mistakes to Avoid](#common-mistakes-to-avoid)
8. [Migration Guide](#migration-guide)

---

## Overview

This guide explains how to create and use API endpoints in our React application using our centralized API pattern. **Always use the established pattern instead of direct `fetch()` or `axios` calls.**

### Current State of the Codebase

Our codebase has a well-designed centralized API architecture, but some developers have been using `fetch()` directly. This creates:
- Inconsistent error handling
- Duplicated code
- Harder maintenance
- Missing features (auth, retry logic, notifications)

**Files using the correct pattern:**
- [src/context/AppContext.tsx](../src/context/AppContext.tsx)
- [src/context/ChatbotContext.tsx](../src/context/ChatbotContext.tsx)
- [src/components/ui/ModelDeployDialog/ModelDeployDialog.tsx](../src/components/ui/ModelDeployDialog/ModelDeployDialog.tsx)

**Files that need refactoring (using `fetch()` directly):**
- [src/hooks/useTemplates.ts](../src/hooks/useTemplates.ts)
- [src/pages/ServiceMonitoring/ServiceMonitoring.tsx](../src/pages/ServiceMonitoring/ServiceMonitoring.tsx)
- [src/pages/CreatePipeline/CreatePipeline.tsx](../src/pages/CreatePipeline/CreatePipeline.tsx)
- [src/pages/TalkToDocument/TalkToDocument.tsx](../src/pages/TalkToDocument/TalkToDocument.tsx)
- [src/components/ui/ModelComparisonPanel/ModelComparisonPanel.tsx](../src/components/ui/ModelComparisonPanel/ModelComparisonPanel.tsx)
- [src/pages/ErrorMonitoring/ErrorMonitoring.tsx](../src/pages/ErrorMonitoring/ErrorMonitoring.tsx)
- [src/pages/PromptGenerator/PromptGenerator.tsx](../src/pages/PromptGenerator/PromptGenerator.tsx)

---

## Why Use the Centralized API Pattern?

### Benefits

1. **Consistent Error Handling**: All API errors are automatically transformed to user-friendly messages
2. **Automatic Notifications**: Users see toast notifications for errors without manual setup
3. **Type Safety**: Full TypeScript support with proper typing
4. **Authentication Ready**: Token management in one place (when enabled)
5. **Request/Response Logging**: Development mode logging for debugging
6. **Timeout Management**: Configurable timeouts (default 30s)
7. **Error Recovery**: Built-in retry logic support
8. **Easier Testing**: Mock once, works everywhere
9. **Maintainability**: Change API behavior globally from one location

### What You Get for Free

When you use `apiClient`:
- 401 redirect handling
- Network error detection
- Timeout error handling
- User-friendly error messages
- Automatic error notifications
- Development mode error logging
- Request/response interceptors
- Type-safe responses

---

## Architecture Overview

### Directory Structure

```
src/api/
├── index.ts                 # Axios instance with interceptors
├── client.ts                # ApiClient wrapper (use this!)
├── errorHandler.ts          # Error transformation & notification
├── errorMessages.ts         # User-friendly error messages
├── notificationService.ts   # Notification bridge
└── endpoints/
    ├── chatbot.api.ts       # Chatbot endpoints
    ├── prompts.api.ts       # Prompts endpoints
    ├── snowflake.api.ts     # Snowflake endpoints
    └── pipeline.ts          # Pipeline endpoints
```

### Core Components

1. **Axios Instance** ([src/api/index.ts](../src/api/index.ts:17-21))
   - Base URL configuration
   - Request/response interceptors
   - Default headers and timeout

2. **API Client** ([src/api/client.ts](../src/api/client.ts))
   - Wrapper around axios with error handling
   - Methods: `get()`, `post()`, `put()`, `delete()`

3. **Error Handler** ([src/api/errorHandler.ts](../src/api/errorHandler.ts))
   - Transforms errors to `EnhancedApiError`
   - Shows notifications
   - Provides error categorization

---

## Using API Endpoints in Components

### Basic Usage

```typescript
import { UserAPI } from '../api/endpoints/user.api';

function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const data = await UserAPI.getUsers();
        setUsers(data);
      } catch (error) {
        // Error is already handled by apiClient
        // Notification already shown to user
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  return (
    <div>
      {loading && <Spinner />}
      {users.map(user => <UserCard key={user.id} user={user} />)}
    </div>
  );
}
```

### Real-World Example from Context

See how [ChatbotContext](../src/context/ChatbotContext.tsx:66-76) uses the API:

```typescript
const fetchChatbots = useCallback(async () => {
  setIsLoading(true);
  try {
    const data = await ChatbotAPI.getChatbots();
    setChatbots(data);
  } catch (error) {
    console.error("Error fetching chatbots:", error);
  } finally {
    setIsLoading(false);
  }
}, []);
```

---

## Error Handling

### Default Error Handling

By default, all errors show a notification to the user:

```typescript
try {
  const user = await UserAPI.getUserById(userId);
} catch (error) {
  // User already sees: "Failed to fetch data. Please try again."
  // Error is already logged in development mode
}
```

### Custom Error Handling

Use `errorConfig` to customize error behavior:

```typescript
import type { ExtendedAxiosRequestConfig } from '../types/api.types';

// Skip notification
const user = await apiClient.get<User>(`/users/${userId}`, {
  errorConfig: {
    skipNotification: true,
  },
});

// Custom error message
const user = await apiClient.get<User>(`/users/${userId}`, {
  errorConfig: {
    customErrorMessage: 'Unable to load user profile. Please refresh the page.',
  },
});

// Custom error callback
const user = await apiClient.get<User>(`/users/${userId}`, {
  errorConfig: {
    onError: (error) => {
      if (error.status === 404) {
        navigate('/users');
      }
    },
  },
});
```

### Error Types

The `EnhancedApiError` provides detailed error information:

```typescript
interface ApiError {
  name: 'ApiError';
  message: string;           // User-friendly message
  code?: string | number;    // Error code
  status?: number;           // HTTP status code
  data?: unknown;            // Server response data
  isNetworkError?: boolean;  // Network failure
  isTimeout?: boolean;       // Request timeout
  isServerError?: boolean;   // 5xx errors
  isClientError?: boolean;   // 4xx errors
}
```

### Error Handling Best Practices

```typescript
try {
  const user = await UserAPI.updateUser(userId, updates);
  showSuccessNotification('User updated successfully!');
  return user;
} catch (error) {
  // Error notification already shown by apiClient
  // Only handle specific error cases if needed
  if ((error as ApiError).status === 409) {
    console.error('User email already exists');
  }
  throw error; // Re-throw if needed upstream
}
```

---

## Advanced Patterns

### Query Parameters

```typescript
// src/api/endpoints/user.api.ts
export const UserAPI = {
  searchUsers: async (params: { query: string; role?: string }): Promise<User[]> => {
    const searchParams = new URLSearchParams();
    searchParams.append('query', params.query);
    if (params.role) {
      searchParams.append('role', params.role);
    }

    return apiClient.get<User[]>(`/users/search?${searchParams.toString()}`);
  },
};

// Alternative: Let axios handle params
export const UserAPI = {
  searchUsers: async (params: { query: string; role?: string }): Promise<User[]> => {
    return apiClient.get<User[]>('/users/search', { params });
  },
};
```

### File Uploads

```typescript
export const UserAPI = {
  uploadAvatar: async (userId: string, file: File): Promise<User> => {
    const formData = new FormData();
    formData.append('avatar', file);

    return apiClient.post<User>(`/users/${userId}/avatar`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};
```

### Request Cancellation

```typescript
function UserSearch() {
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const searchUsers = async (query: string) => {
    // Cancel previous request
    if (abortController) {
      abortController.abort();
    }

    const newController = new AbortController();
    setAbortController(newController);

    try {
      const users = await apiClient.get<User[]>('/users/search', {
        params: { query },
        signal: newController.signal,
      });
      setResults(users);
    } catch (error) {
      if (error.name !== 'CanceledError') {
        console.error('Search failed:', error);
      }
    }
  };

  return (
    <input onChange={(e) => searchUsers(e.target.value)} />
  );
}
```

### Conditional Error Handling

```typescript
export const UserAPI = {
  deleteUser: async (userId: string, skipConfirmation = false): Promise<void> => {
    return apiClient.delete<void>(`/users/${userId}`, {
      errorConfig: {
        skipNotification: skipConfirmation,
        customErrorMessage: 'Failed to delete user. They may have active sessions.',
        onError: (error) => {
          if (error.status === 409) {
            // Handle conflict (user has dependencies)
            showConfirmDialog('User has active sessions. Force delete?');
          }
        },
      },
    });
  },
};
```

### Retry Logic (Future Enhancement)

The infrastructure supports retry logic (see [src/types/api.types.ts](../src/types/api.types.ts)):

```typescript
// This will work when retry logic is implemented in apiClient
const user = await apiClient.get<User>(`/users/${userId}`, {
  errorConfig: {
    retry: {
      maxAttempts: 3,
      retryableStatuses: [408, 429, 500, 502, 503, 504],
    },
  },
});
```

---

## Common Mistakes to Avoid

### ❌ Don't: Use fetch() directly

```typescript
// WRONG - No error handling, no notifications, hardcoded URL
const response = await fetch('http://localhost:5000/api/users');
const users = await response.json();
```

### ✅ Do: Use apiClient

```typescript
// CORRECT - Error handling, notifications, proper typing
const users = await UserAPI.getUsers();
```

---

### ❌ Don't: Import axios directly

```typescript
// WRONG - Bypasses interceptors, error handling, etc.
import axios from 'axios';

const response = await axios.get('http://localhost:5000/api/users');
```

### ✅ Do: Use apiClient

```typescript
// CORRECT
import { apiClient } from '../api/client';

const users = await apiClient.get<User[]>('/users');
```

---

### ❌ Don't: Hardcode API URLs

```typescript
// WRONG - URL changes won't apply here
const API_BASE = 'http://localhost:5000';
const response = await fetch(`${API_BASE}/api/users`);
```

### ✅ Do: Use relative paths with apiClient

```typescript
// CORRECT - Base URL configured in one place
const users = await UserAPI.getUsers();
// or
const users = await apiClient.get<User[]>('/users');
```

---

### ❌ Don't: Manually show error notifications

```typescript
// WRONG - Duplicated error handling
try {
  const response = await fetch('/api/users');
  if (!response.ok) {
    toast.error('Failed to fetch users');
  }
} catch (error) {
  toast.error('Network error');
}
```

### ✅ Do: Let apiClient handle it

```typescript
// CORRECT - Automatic error notifications
try {
  const users = await UserAPI.getUsers();
} catch (error) {
  // Notification already shown
  // Only handle special cases if needed
}
```

---

### ❌ Don't: Mix error handling patterns

```typescript
// WRONG - Inconsistent across the app
// File 1: manual try-catch with alerts
// File 2: manual try-catch with console.error
// File 3: no error handling
// File 4: using apiClient (correct!)
```

### ✅ Do: Use consistent pattern everywhere

```typescript
// CORRECT - All API calls use apiClient
const users = await UserAPI.getUsers();
const user = await UserAPI.getUserById(id);
const created = await UserAPI.createUser(data);
```

---

### ❌ Don't: Skip TypeScript types

```typescript
// WRONG - No type safety
export const UserAPI = {
  getUsers: async () => {
    return apiClient.get('/users');
  },
};
```

### ✅ Do: Always provide types

```typescript
// CORRECT - Full type safety
export const UserAPI = {
  getUsers: async (): Promise<User[]> => {
    return apiClient.get<User[]>('/users');
  },
};
```

---

## Migration Guide

### Migrating from fetch()

**Before:**
```typescript
// src/hooks/useTemplates.ts (BEFORE)
const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

const fetchTemplates = async () => {
  try {
    const res = await fetch(`${API_BASE}/templates`);
    if (!res.ok) {
      throw new Error('Failed to fetch templates');
    }
    const data = await res.json();
    setTemplates(data);
  } catch (error) {
    toast.error('Unable to load templates');
    console.error(error);
  }
};
```

**After:**
```typescript
// 1. Create endpoint file
// src/api/endpoints/template.api.ts
import { apiClient } from '../client';
import type { Template } from '../../types/template.types';

export const TemplateAPI = {
  getTemplates: async (): Promise<Template[]> => {
    return apiClient.get<Template[]>('/templates');
  },
};

// 2. Update hook
// src/hooks/useTemplates.ts (AFTER)
import { TemplateAPI } from '../api/endpoints/template.api';

const fetchTemplates = async () => {
  try {
    const data = await TemplateAPI.getTemplates();
    setTemplates(data);
  } catch (error) {
    // Error notification already shown
    console.error('Failed to fetch templates:', error);
  }
};
```

### Migrating from axios

**Before:**
```typescript
// src/pages/PromptGenerator/PromptGenerator.tsx (BEFORE)
import axios from 'axios';

const handleGenerate = async () => {
  try {
    const res = await axios.post("http://localhost:5000/api/generate-prompts", {
      topic: promptTopic,
      count: 5,
    });
    setPrompts(res.data);
  } catch (error) {
    alert('Failed to generate prompts');
  }
};
```

**After:**
```typescript
// 1. Create endpoint
// src/api/endpoints/prompt.api.ts
import { apiClient } from '../client';
import type { GeneratePromptsRequest, Prompt } from '../../types/prompt.types';

export const PromptAPI = {
  generatePrompts: async (request: GeneratePromptsRequest): Promise<Prompt[]> => {
    return apiClient.post<Prompt[], GeneratePromptsRequest>('/generate-prompts', request);
  },
};

// 2. Update component
// src/pages/PromptGenerator/PromptGenerator.tsx (AFTER)
import { PromptAPI } from '../../api/endpoints/prompt.api';

const handleGenerate = async () => {
  try {
    const prompts = await PromptAPI.generatePrompts({
      topic: promptTopic,
      count: 5,
    });
    setPrompts(prompts);
  } catch (error) {
    // Error notification already shown
    console.error('Failed to generate prompts:', error);
  }
};
```

### Migration Checklist

- [ ] Create types for request/response in `src/types/`
- [ ] Create endpoint file in `src/api/endpoints/[domain].api.ts`
- [ ] Define API methods using `apiClient.get/post/put/delete`
- [ ] Update component/hook imports
- [ ] Replace `fetch()` or `axios` calls with API methods
- [ ] Remove manual error notification code
- [ ] Remove hardcoded API URLs
- [ ] Test error scenarios (network errors, 4xx, 5xx)
- [ ] Remove `API_BASE` constants from components

---

## Summary

### Quick Reference

**Create an endpoint:**
```typescript
// src/api/endpoints/[domain].api.ts
import { apiClient } from '../client';
import type { MyType } from '../../types/my.types';

export const MyAPI = {
  getData: async (): Promise<MyType[]> => {
    return apiClient.get<MyType[]>('/my-endpoint');
  },

  createData: async (data: MyType): Promise<MyType> => {
    return apiClient.post<MyType, MyType>('/my-endpoint', data);
  },
};
```

**Use in component:**
```typescript
import { MyAPI } from '../api/endpoints/my.api';

try {
  const data = await MyAPI.getData();
  // Handle success
} catch (error) {
  // Error already shown to user
  // Only handle special cases if needed
}
```

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
