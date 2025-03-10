import axios from 'axios';

// API测试函数配置
const API_CONFIG = {
  openai: {
    defaultModel: 'gpt-4o-mini',
    defaultUrl: 'https://api.openai.com/v1/chat/completions',
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }),
    body: (model) => ({
      model: model || 'gpt-4o-mini',
      messages: [{ role: "user", content: "hello" }],
      max_tokens: 50
    })
  },
  claude: {
    defaultModel: 'claude-3.5-sonnet',
    defaultUrl: 'https://api.anthropic.com/v1/messages',
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    }),
    body: (model) => ({
      model: model || 'claude-3.5-sonnet',
      messages: [{ role: "user", content: "hello" }],
      max_tokens: 50
    })
  },
  gemini: {
    defaultModel: 'gemini-2.0-flash',
    defaultUrl: 'https://generativelanguage.googleapis.com',
    headers: () => ({ 'Content-Type': 'application/json' }),
    body: () => ({ contents: [{ parts: [{ text: "hello" }] }] }),
    urlBuilder: (baseUrl, apiKey, model) => 
      `${baseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${model || 'gemini-1.5-flash-latest'}:generateContent?key=${apiKey}`
  },
  custom: {
    defaultModel: 'gpt-4o-mini',
    headers: (apiKey) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }),
    body: (model) => ({
      model: model || 'gpt-4o-mini',
      messages: [{ role: "user", content: "hello" }],
      max_tokens: 50
    })
  }
};

// 统一的API测试函数
async function testApiKey(apiType, baseUrl, apiKey, model) {
  const config = API_CONFIG[apiType];
  if (!config) throw new Error(`不支持的API类型: ${apiType}`);
  
  const headers = config.headers(apiKey);
  const body = config.body(model);
  
  let url;
  if (config.urlBuilder) {
    url = config.urlBuilder(baseUrl, apiKey, model);
  } else {
    url = `${baseUrl || config.defaultUrl}`;
    // 对于Claude，不需要添加v1前缀，因为已经包含在defaultUrl中
    if (apiType !== 'claude' && !url.includes('/v1/')) {
      url = url.endsWith('/') ? `${url}v1/chat/completions` : `${url}/v1/chat/completions`;
    }
  }
  
  return await axios.post(url, body, { headers, timeout: 30000 });
}

// 获取错误信息
const getErrorMessage = (error, apiType) => {
  if (!error.response) {
    return {
      short: '服务器无响应',
      full: error.request ? '服务器无响应，请检查网络连接或API基础URL' : `请求错误: ${error.message}`
    };
  }
  
  const status = error.response.status;
  const errorData = error.response.data;
  
  const commonErrors = {
    400: '请求无效', 401: '认证失败', 403: '权限不足',
    404: '资源不存在', 429: '请求过多', 500: '服务器错误'
  };
  
  let shortMessage = commonErrors[status] || `错误(${status})`;
  let fullMessage = shortMessage;
  
  const prefix = apiType === 'custom' ? '自定义渠道' : apiType;
  
  if (errorData && errorData.error) {
    const detail = errorData.error.message || JSON.stringify(errorData.error);
    fullMessage += `: ${detail}`;
  }
  
  return {
    short: `${prefix}: ${shortMessage}`,
    full: `${prefix}: ${fullMessage}`
  };
};
// 测试不同类型的API Key
export const testApiKeys = async ({ 
  baseUrl, 
  apiKeys, 
  model, 
  apiType, 
  onProgress, 
  interval = 500, 
  startIndex = 0 
}) => {
  const results = [];
  
  for (let i = startIndex; i < apiKeys.length; i++) {
    const apiKey = apiKeys[i];
    try {
      // 使用统一的testApiKey函数
      await testApiKey(apiType, baseUrl, apiKey, model);
      
      // 如果请求成功，则API Key有效
      const result = {
        apiKey,
        status: 'active',
        message: `${apiType === 'custom' ? '自定义渠道' : apiType}: 测试成功`,
        fullMessage: `${apiType === 'custom' ? '自定义渠道' : apiType}: API Key 有效`
      };
      
      // 调用回调函数，更新UI
      if (onProgress) {
        onProgress(result, i);
      }
      
      results.push(result);
    } catch (error) {
      console.error(`测试API Key失败: ${apiKey.substring(0, 5)}...`, error);
      
      const errorInfo = getErrorMessage(error, apiType);
      const errorResult = {
        apiKey,
        status: 'inactive',
        message: errorInfo.short,
        fullMessage: errorInfo.full
      };
      
      // 调用回调函数，更新UI
      if (onProgress) {
        onProgress(errorResult, i);
      }
      
      results.push(errorResult);
    }
    
    // 添加可配置的延迟，避免API限流
    if (i < apiKeys.length - 1) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  
  // 全部测试完成
  return { results, completed: true };
};

// 统一的API调用服务
const apiService = {
  callApi: async (apiType, params) => {
    try {
      const config = buildRequestConfig(apiType, params);
      
      const response = await fetch(config.url, {
        method: config.method || 'POST',
        headers: config.headers,
        body: config.body ? JSON.stringify(config.body) : undefined
      });
      
      const data = await response.json();
      
      return {
        status: response.status,
        data,
        headers: Object.fromEntries([...response.headers]),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
};

// 构建请求配置
function buildRequestConfig(apiType, params) {
  const configs = {
    openai: {
      url: params.endpoint || 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.apiKey}`
      },
      body: {
        model: params.model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: params.prompt || '你好' }],
        max_tokens: parseInt(params.maxTokens) || 100
      }
    },
    gemini: {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${params.model || 'gemini-pro'}:generateContent?key=${params.apiKey}`,
      headers: { 'Content-Type': 'application/json' },
      body: {
        contents: [{ parts: [{ text: params.prompt || '你好' }] }],
        generationConfig: { maxOutputTokens: parseInt(params.maxTokens) || 100 }
      }
    },
    claude: {
      url: params.endpoint || 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': params.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: {
        model: params.model || 'claude-3-opus-20240229',
        messages: [{ role: 'user', content: params.prompt || '你好' }],
        max_tokens: parseInt(params.maxTokens) || 100
      }
    },
    custom: {
      url: params.endpoint,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${params.apiKey}`
      },
      body: {
        model: params.model || 'gpt-4o-mini',
        messages: [{ role: 'user', content: params.prompt || '你好' }],
        max_tokens: parseInt(params.maxTokens) || 100
      }
    }
  };
  
  return configs[apiType] || {};
}

export default apiService;